/**
 * game/src/core/logger.ts — Logger MathKombat (évacuation des logs par socket).
 *
 * Règles (AGENTS.md §5) :
 *  - Aucune fonction de jeu n'écrit directement en console ou en socket : tout passe
 *    par ce module.
 *  - Mode DEBUG  : enregistrements envoyés par WebSocket (ou TCP) au collecteur
 *    scripts/log-collector.js + console locale, file tampon si déconnecté.
 *  - Mode RELEASE : no-op compilé — aucun appel réseau, aucune chaîne de log.
 *
 * Aucune dépendance (ni Phaser, ni npm) : utilisable depuis core/ comme depuis ui/.
 */

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'silent';
export type BuildMode = 'debug' | 'release';

export interface LogRecord {
  ts: string;        // horodatage ISO 8601
  seq: number;       // compteur monotone par session
  session: string;   // identifiant de session/partie
  build: BuildMode;
  level: LogLevel;
  scene: string;     // scène Phaser ou module émetteur
  event: string;     // <domaine>.<action> — nomenclature docs/architecture.md §4
  data?: Record<string, unknown>;
}

export interface LoggerOptions {
  /** Niveau minimal émis (défaut : 'trace' en debug, 'silent' en release). */
  level?: LogLevel;
  /** URL du collecteur (défaut : ws://127.0.0.1:8765). */
  sinkUrl?: string;
  /** Identifiant de session (défaut : fight-<horodatage>). */
  session?: string;
  /** Module émetteur par défaut. */
  scene?: string;
}

/** Injectée par Vite (`define`) : "debug" ou "release". Repli : "debug". */
declare const __BUILD_MODE__: BuildMode | undefined;

const NIVEAUX: Record<LogLevel, number> = {
  trace: 0, debug: 1, info: 2, warn: 3, error: 4, silent: 5,
};

const MODE: BuildMode =
  typeof __BUILD_MODE__ !== 'undefined' && __BUILD_MODE__ === 'release' ? 'release' : 'debug';

const TAMPON_MAX = 500; // file tampon hors-connexion (débordement : on oublie les plus anciens)

export class Logger {
  private readonly niveau: number;
  private readonly scene: string;
  private seq = 0;
  private socket: WebSocket | null = null;
  private tampon: string[] = [];
  private ferme = false;

  constructor(private readonly opts: LoggerOptions = {}) {
    this.niveau = NIVEAUX[opts.level ?? (MODE === 'release' ? 'silent' : 'trace')];
    this.scene = opts.scene ?? 'App';
    if (MODE === 'debug' && this.niveau < NIVEAUX.silent) this.connecter();
  }

  // --- cycle de vie -------------------------------------------------------

  private get session(): string {
    return this.opts.session ?? `fight-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`;
  }

  private connecter(): void {
    if (typeof WebSocket === 'undefined') return; // exécution Node (tests) : console seule
    const url = this.opts.sinkUrl ?? 'ws://127.0.0.1:8765';
    try {
      this.socket = new WebSocket(url);
      this.socket.onopen = () => {
        for (const l of this.tampon.splice(0)) this.socket?.send(l);
      };
      this.socket.onerror = () => { this.socket = null; };
      this.socket.onclose = () => {
        this.socket = null;
        // reconnexion différée (simple, non bloquant)
        if (!this.ferme && typeof setTimeout !== 'undefined') setTimeout(() => this.connecter(), 3000);
      };
    } catch {
      this.socket = null; // jamais d'exception côté jeu
    }
  }

  /** Logger enfant portant un module/scène différent. */
  child(scene: string): Logger {
    const enfant = new Logger({ ...this.opts, scene });
    // partager la connexion du parent (simple : chacun a la sienne en debug)
    return enfant;
  }

  close(): void {
    this.ferme = true;
    this.socket?.close();
    this.socket = null;
  }

  // --- émission -----------------------------------------------------------

  trace(event: string, data?: Record<string, unknown>): void { this.emettre('trace', event, data); }
  debug(event: string, data?: Record<string, unknown>): void { this.emettre('debug', event, data); }
  info(event: string, data?: Record<string, unknown>): void { this.emettre('info', event, data); }
  warn(event: string, data?: Record<string, unknown>): void { this.emettre('warn', event, data); }
  error(event: string, data?: Record<string, unknown>): void { this.emettre('error', event, data); }

  private emettre(level: LogLevel, event: string, data?: Record<string, unknown>): void {
    if (this.niveau >= NIVEAUX.silent || NIVEAUX[level] < this.niveau) return; // no-op RELEASE

    const rec: LogRecord = {
      ts: new Date().toISOString(),
      seq: this.seq++,
      session: this.session,
      build: MODE,
      level,
      scene: this.scene,
      event,
      ...(data !== undefined ? { data } : {}),
    };
    const ligne = JSON.stringify(rec);

    // console locale (debug uniquement)
    if (MODE === 'debug') {
      const prefixe = `${rec.ts.slice(11, 23)} ${level.toUpperCase().padEnd(5)} ${this.scene}/${event}`;
      const methode = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
      console[methode](prefixe, data ?? '');
    }

    // évacuation par socket avec file tampon
    if (this.socket && this.socket.readyState === 1) {
      this.socket.send(ligne);
    } else {
      this.tampon.push(ligne);
      if (this.tampon.length > TAMPON_MAX) this.tampon.shift();
    }
  }
}

// --- instance globale ------------------------------------------------------

let instance: Logger | null = null;

/** Initialise le logger global (une fois au bootstrap de l'application). */
export function initLogger(opts: LoggerOptions = {}): Logger {
  instance = new Logger(opts);
  return instance;
}

/** Récupère le logger global (ou un no-op silencieux si non initialisé). */
export function getLogger(scene?: string): Logger {
  if (!instance) instance = new Logger({ scene: scene ?? 'App' });
  return scene ? instance.child(scene) : instance;
}
