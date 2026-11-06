// Sécurité de la connexion Microsoft 365 (lot 1)
// - state : protège le retour Microsoft contre la falsification (CSRF OAuth)
// - ticket : code à usage unique, valable 60 s, échangé contre le JWT par un POST.
//   Le JWT ne transite donc plus jamais dans l'adresse (historique, journaux, Referer).
// Stockage en mémoire : suffisant pour une instance unique (Render). Un redémarrage
// pendant une connexion oblige simplement l'utilisateur à recliquer sur « Se connecter ».
const crypto = require('crypto');

const STATE_TTL_MS = 10 * 60 * 1000;
const TICKET_TTL_MS = 60 * 1000;
const states = new Map();
const tickets = new Map();

function sweep(map) {
  const now = Date.now();
  for (const [key, value] of map) if (value.exp < now) map.delete(key);
}

function newState() {
  sweep(states);
  const state = crypto.randomBytes(24).toString('base64url');
  states.set(state, { exp: Date.now() + STATE_TTL_MS });
  return state;
}

function consumeState(state) {
  if (!state || typeof state !== 'string') return false;
  const entry = states.get(state);
  states.delete(state);
  return !!entry && entry.exp >= Date.now();
}

function issueTicket(token) {
  sweep(tickets);
  const ticket = crypto.randomBytes(32).toString('base64url');
  tickets.set(ticket, { token, exp: Date.now() + TICKET_TTL_MS });
  return ticket;
}

function redeemTicket(ticket) {
  if (!ticket || typeof ticket !== 'string') return null;
  const entry = tickets.get(ticket);
  tickets.delete(ticket);
  return entry && entry.exp >= Date.now() ? entry.token : null;
}

// Comparaison en temps constant (évite de deviner un secret caractère par caractère)
function safeEqual(a, b) {
  const x = Buffer.from(String(a || ''));
  const y = Buffer.from(String(b || ''));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

module.exports = { newState, consumeState, issueTicket, redeemTicket, safeEqual };
