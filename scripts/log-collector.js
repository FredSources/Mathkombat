#!/usr/bin/env node
/**
 * scripts/log-collector.js — Collecteur de logs MathKombat (zéro dépendance).
 *
 * Évacuation des logs par socket : un seul port TCP accepte
 *   - WebSocket (RFC 6455)  → client navigateur / WebView (jeu en mode DEBUG)
 *   - TCP brut JSONL        → sondes, scripts, clients non-navigateur
 * (détection au premier octet : une requête HTTP "GET " démarre l'upgrade WS).
 *
 * Sorties :
 *   - fichier JSONL : output/logs/<session>.jsonl  (source de vérité, tout conservé)
 *   - console       : format lisible, filtrée par --level / --grep
 *
 * Usage :
 *   node scripts/log-collector.js [--port 8765] [--host 127.0.0.1]
 *                                 [--dir output/logs] [--level trace|debug|info|warn|error]
 *                                 [--grep motif] [--quiet]
 */
'use strict';

const net = require('node:net');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

// ---------- arguments ----------
const args = process.argv.slice(2);
function opt(name, defaut) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : defaut;
}
const PORT = parseInt(opt('port', '8765'), 10);
const HOST = opt('host', '127.0.0.1');
const DIR = path.resolve(opt('dir', path.join(__dirname, '..', 'output', 'logs')));
const LEVEL = opt('level', 'trace');
const GREP = opt('grep', null);
const QUIET = args.includes('--quiet');

const NIVEAUX = { trace: 0, debug: 1, info: 2, warn: 3, error: 4 };
const SEUIL = NIVEAUX[LEVEL] ?? 0;
const COULEURS = { trace: '\x1b[90m', debug: '\x1b[36m', info: '\x1b[32m', warn: '\x1b[33m', error: '\x1b[31m' };
const RESET = '\x1b[0m';

fs.mkdirSync(DIR, { recursive: true });

// ---------- journaux par session ----------
const flux = new Map(); // session -> WriteStream
const stats = { recus: 0, invalides: 0, parNiveau: {}, parSession: {} };

function sessionDe(r) {
  const s = String(r.session || 'sans-session').replace(/[^a-zA-Z0-9_.-]/g, '_').slice(0, 64);
  return s || 'sans-session';
}

function ecrire(session, ligne) {
  let f = flux.get(session);
  if (!f) {
    f = fs.createWriteStream(path.join(DIR, `${session}.jsonl`), { flags: 'a' });
    flux.set(session, f);
  }
  f.write(ligne + '\n');
}

function normaliser(brut) {
  const maintenant = new Date().toISOString();
  return {
    ts: typeof brut.ts === 'string' ? brut.ts : maintenant,
    seq: Number.isFinite(brut.seq) ? brut.seq : stats.recus,
    session: sessionDe(brut),
    build: brut.build === 'release' ? 'release' : 'debug',
    level: NIVEAUX[brut.level] !== undefined ? brut.level : 'info',
    scene: typeof brut.scene === 'string' ? brut.scene : '?',
    event: typeof brut.event === 'string' ? brut.event : 'inconnu.sans_event',
    ...(brut.data !== undefined ? { data: brut.data } : {}),
  };
}

function afficher(r) {
  if (QUIET) return;
  if ((NIVEAUX[r.level] ?? 2) < SEUIL) return;
  const ligne = `${r.ts.slice(11, 23)} ${r.level.toUpperCase().padEnd(5)} ${r.scene}/${r.event}` +
    (r.data !== undefined ? '  ' + JSON.stringify(r.data) : '');
  if (GREP && !new RegExp(GREP).test(ligne)) return;
  process.stdout.write(`${COULEURS[r.level] || ''}${ligne}${RESET}\n`);
}

function traiterMessage(texte) {
  for (const ligneBrute of texte.split('\n')) {
    const ligne = ligneBrute.trim();
    if (!ligne) continue;
    stats.recus++;
    let brut;
    try {
      brut = JSON.parse(ligne);
      if (typeof brut !== 'object' || brut === null) throw new TypeError('pas un objet');
    } catch {
      stats.invalides++;
      if (!QUIET) process.stdout.write(`\x1b[33m[ligne JSON invalide ignorée] ${ligne.slice(0, 120)}\x1b[0m\n`);
      continue;
    }
    const r = normaliser(brut);
    ecrire(r.session, JSON.stringify(r));
    stats.parNiveau[r.level] = (stats.parNiveau[r.level] || 0) + 1;
    stats.parSession[r.session] = (stats.parSession[r.session] || 0) + 1;
    afficher(r);
  }
}

// ---------- WebSocket (RFC 6455, minimal) ----------
const GUID_WS = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

function trameServeur(opcode, payload) {
  const p = Buffer.from(payload);
  const tete = [0x80 | opcode];
  if (p.length < 126) tete.push(p.length);
  else if (p.length < 65536) tete.push(126, (p.length >> 8) & 0xff, p.length & 0xff);
  else tete.push(127, 0, 0, 0, 0, (p.length / 2 ** 32) | 0, (p.length >>> 24) & 0xff, (p.length >>> 16) & 0xff, (p.length >>> 8) & 0xff, p.length & 0xff);
  return Buffer.concat([Buffer.from(tete), p]);
}

function parserTrames(etat) {
  // Retourne les messages (opcode 1/2) et commande (close/ping/pong) ; gère fragmentation.
  const sorties = [];
  for (;;) {
    const buf = etat.buf;
    if (buf.length < 2) break;
    const fin = (buf[0] & 0x80) !== 0;
    const opcode = buf[0] & 0x0f;
    const masque = (buf[1] & 0x80) !== 0;
    let len = buf[1] & 0x7f;
    let off = 2;
    if (len === 126) {
      if (buf.length < 4) break;
      len = buf.readUInt16BE(2); off = 4;
    } else if (len === 127) {
      if (buf.length < 10) break;
      len = Number(buf.readBigUInt64BE(2)); off = 10;
    }
    if (masque && buf.length < off + 4) break;
    const cle = masque ? buf.subarray(off, off + 4) : null;
    if (masque) off += 4;
    if (buf.length < off + len) break;
    const charge = Buffer.from(buf.subarray(off, off + len));
    if (cle) for (let i = 0; i < charge.length; i++) charge[i] ^= cle[i % 4];
    etat.buf = buf.subarray(off + len);

    if (opcode === 0x8) { sorties.push({ type: 'close' }); continue; }
    if (opcode === 0x9) { sorties.push({ type: 'ping', charge }); continue; }
    if (opcode === 0xA) { sorties.push({ type: 'pong' }); continue; }

    if (opcode === 0x0) { // continuation
      etat.fragments.push(charge);
      if (fin) {
        sorties.push({ type: 'message', texte: Buffer.concat(etat.fragments).toString('utf8') });
        etat.fragments = [];
      }
      continue;
    }
    if (opcode === 0x1 || opcode === 0x2) {
      if (fin) sorties.push({ type: 'message', texte: charge.toString('utf8') });
      else etat.fragments = [charge];
    }
  }
  return sorties;
}

// ---------- serveur TCP ----------
const serveur = net.createServer((socket) => {
  const etat = { buf: Buffer.alloc(0), mode: 'reniflage', fragments: [] };
  socket.on('error', () => { /* client parti */ });
  socket.setNoDelay(true);

  socket.on('data', (d) => {
    etat.buf = Buffer.concat([etat.buf, d]);

    if (etat.mode === 'reniflage') {
      if (etat.buf.length < 4) return;
      if (etat.buf.subarray(0, 4).toString('latin1') === 'GET ') {
        const finHttp = etat.buf.indexOf('\r\n\r\n');
        if (finHttp < 0) return;
        const requete = etat.buf.subarray(0, finHttp).toString('latin1');
        etat.buf = etat.buf.subarray(finHttp + 4);
        const m = /^sec-websocket-key:\s*(.+)\r$/im.exec(requete);
        if (!m) { socket.end('HTTP/1.1 400 Bad Request\r\n\r\n'); return; }
        const accept = crypto.createHash('sha1').update(m[1].trim() + GUID_WS).digest('base64');
        socket.write(
          'HTTP/1.1 101 Switching Protocols\r\n' +
          'Upgrade: websocket\r\nConnection: Upgrade\r\n' +
          `Sec-WebSocket-Accept: ${accept}\r\n\r\n`
        );
        etat.mode = 'ws';
      } else {
        etat.mode = 'tcp';
      }
    }

    if (etat.mode === 'ws') {
      for (const ev of parserTrames(etat)) {
        if (ev.type === 'message') traiterMessage(ev.texte);
        else if (ev.type === 'ping') socket.write(trameServeur(0xA, ev.charge));
        else if (ev.type === 'close') { socket.write(trameServeur(0x8, '')); socket.end(); }
      }
    } else { // tcp brut : flux JSONL
      for (;;) {
        const nl = etat.buf.indexOf(0x0a);
        if (nl < 0) break;
        traiterMessage(etat.buf.subarray(0, nl).toString('utf8'));
        etat.buf = etat.buf.subarray(nl + 1);
      }
    }
  });
});

serveur.listen(PORT, HOST, () => {
  process.stdout.write(
    `\x1b[1;34m[collecteur]\x1b[0m en écoute sur ${HOST}:${PORT} ` +
    `(WebSocket + TCP brut) → ${DIR}\n`
  );
});

// ---------- arrêt propre ----------
function arreter() {
  process.stdout.write(`\n\x1b[1;34m[collecteur]\x1b[0m arrêt — résumé :\n`);
  process.stdout.write(`  enregistrements reçus : ${stats.recus} (invalides : ${stats.invalides})\n`);
  process.stdout.write(`  par niveau : ${JSON.stringify(stats.parNiveau)}\n`);
  process.stdout.write(`  par session : ${JSON.stringify(stats.parSession)}\n`);
  for (const [session, f] of flux) {
    process.stdout.write(`  fichier : ${path.join(DIR, session + '.jsonl')}\n`);
    f.end();
  }
  serveur.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 500).unref();
}
process.on('SIGINT', arreter);
process.on('SIGTERM', arreter);
