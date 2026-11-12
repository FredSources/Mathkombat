#!/usr/bin/env node
/**
 * scripts/ws-probe.mjs — Sonde de smoke test pour scripts/log-collector.js (zéro dépendance).
 *
 * Vérifie l'évacuation des logs par socket dans les deux protocoles :
 *   1. WebSocket : handshake RFC 6455 vérifié (Sec-WebSocket-Accept), 3 enregistrements
 *      masqués, ping → pong, close propre.
 *   2. TCP brut  : 2 enregistrements JSONL.
 *
 * Usage : node scripts/ws-probe.mjs [--port 8765] [--host 127.0.0.1] [--session nom]
 * Sortie : code 0 si tout est envoyé ET pong reçu ; 1 sinon.
 */
import net from 'node:net';
import crypto from 'node:crypto';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const PORT = parseInt(opt('port', '8765'), 10);
const HOST = opt('host', '127.0.0.1');
const SESSION = opt('session', `smoke-${Date.now()}`);

const GUID_WS = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

function trameClient(opcode, texte) {
  const p = Buffer.from(texte);
  const cle = crypto.randomBytes(4);
  const tete = [0x80 | opcode];
  if (p.length < 126) tete.push(0x80 | p.length);
  else if (p.length < 65536) tete.push(0x80 | 126, (p.length >> 8) & 0xff, p.length & 0xff);
  else throw new Error('charge trop longue pour la sonde');
  const charge = Buffer.from(p);
  for (let i = 0; i < charge.length; i++) charge[i] ^= cle[i % 4];
  return Buffer.concat([Buffer.from(tete), cle, charge]);
}

function enregistrement(niveau, event, data) {
  return JSON.stringify({
    ts: new Date().toISOString(), session: SESSION, build: 'debug',
    level: niveau, scene: 'Smoke', event, data,
  });
}

const attendus = {
  'smoke.ws_1': false, 'smoke.ws_2': false, 'smoke.ws_3': false,
  'smoke.tcp_1': false, 'smoke.tcp_2': false,
};
let pongRecu = false;
let fini = false;
let echec = '';

// ---------- 1) WebSocket ----------
function testWebSocket() {
  return new Promise((resolve) => {
    const sock = net.createConnection({ host: HOST, port: PORT }, () => {
      const cle = crypto.randomBytes(16).toString('base64');
      sock.write(
        `GET /logs HTTP/1.1\r\nHost: ${HOST}:${PORT}\r\nUpgrade: websocket\r\n` +
        `Connection: Upgrade\r\nSec-WebSocket-Key: ${cle}\r\nSec-WebSocket-Version: 13\r\n\r\n`
      );
      sock.once('data', (d) => {
        const reponse = d.toString('latin1');
        const attendu = crypto.createHash('sha1').update(cle + GUID_WS).digest('base64');
        if (!reponse.includes('101') || !reponse.includes(`Sec-WebSocket-Accept: ${attendu}`)) {
          echec = 'handshake WebSocket invalide';
          sock.destroy(); resolve(); return;
        }
        sock.write(trameClient(0x1, enregistrement('info', 'smoke.ws_1', { n: 1 })));
        sock.write(trameClient(0x1, enregistrement('debug', 'smoke.ws_2', { n: 2 })));
        sock.write(trameClient(0x1, enregistrement('warn', 'smoke.ws_3', { n: 3 })));
        sock.write(trameClient(0x9, 'ping-test'));
      });
      sock.on('data', (d) => {
        if ((d[0] & 0x0f) === 0xA) pongRecu = true; // pong
        if (pongRecu && !fini) {
          fini = true;
          sock.write(trameClient(0x8, ''));
          sock.end();
          resolve();
        }
      });
      sock.on('error', (e) => { echec = echec || `socket WS : ${e.message}`; resolve(); });
      sock.on('close', () => resolve());
    });
    setTimeout(() => { echec = echec || 'timeout WebSocket'; sock.destroy(); resolve(); }, 5000);
  });
}

// ---------- 2) TCP brut ----------
function testTCP() {
  return new Promise((resolve) => {
    const sock = net.createConnection({ host: HOST, port: PORT }, () => {
      sock.write(enregistrement('info', 'smoke.tcp_1', { n: 4 }) + '\n');
      sock.write(enregistrement('error', 'smoke.tcp_2', { n: 5 }) + '\n');
      setTimeout(() => { sock.end(); resolve(); }, 200);
    });
    sock.on('error', (e) => { echec = echec || `socket TCP : ${e.message}`; resolve(); });
    setTimeout(() => { sock.end(); resolve(); }, 5000);
  });
}

await testWebSocket();
await testTCP();

const envoyes = Object.keys(attendus);
console.log(`[sonde] session=${SESSION}`);
console.log(`[sonde] pong WebSocket : ${pongRecu ? 'OK' : 'MANQUANT'}`);
console.log(`[sonde] 5 enregistrements émis (${envoyes.join(', ')})`);

const okWS = pongRecu && !echec;
if (!okWS) {
  console.error(`[sonde] ÉCHEC : ${echec || 'pong non reçu'}`);
  process.exit(1);
}
console.log('[sonde] SUCCÈS — vérifier le fichier JSONL du collecteur avec :');
console.log(`        grep -c '"session":"${SESSION}"' output/logs/${SESSION}.jsonl`);
