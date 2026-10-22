// ============================================================
// VIRUS!
//
// Online version of the Virus! card game, built the same way as UNO Mentiroso:
// plain HTML/CSS/JS + Firebase (anonymous auth, Firestore for the game state,
// Realtime Database for presence, voice-chat signalling and now-playing).
//
// It reuses the unomentiroso Firebase project. That project's security rules only
// allow the 'rooms' collection, so Virus rooms live there too, tagged with
// game: 'virus' (GAME_TAG). Joining checks the tag, so a UNO code never opens here.
// ============================================================

const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyDD88huoZNmnG8HKPb0aYYFUl5L_-tjVzQ",
  authDomain:        "unomentiroso-b5742.firebaseapp.com",
  projectId:         "unomentiroso-b5742",
  storageBucket:     "unomentiroso-b5742.firebasestorage.app",
  messagingSenderId: "771588309649",
  appId:             "1:771588309649:web:f2e1f4450a2975f1d7f530"
};

// Firestore collection that holds the rooms (shared with UNO Mentiroso)
const ROOMS    = 'rooms';
const GAME_TAG = 'virus';

// True when a room document belongs to this game
function isVirusRoom(data) {
  return data?.game === GAME_TAG;
}

// ============================================================
// CONSTANTS
// ============================================================

const COLORS      = ['red', 'blue', 'green', 'yellow'];
const BODY_ORDER  = ['red', 'blue', 'green', 'yellow', 'multi']; // order organs are drawn in a body
const MAX_PLAYERS = 6;
const HAND_SIZE   = 3;
const ORGANS_TO_WIN = 4;

const COLOR_NAME = { red:'Rojo', blue:'Azul', green:'Verde', yellow:'Amarillo', multi:'Multicolor' };
const ORGAN_NAME = { red:'Corazón', blue:'Cerebro', green:'Estómago', yellow:'Hueso', multi:'Órgano multicolor' };
const TYPE_LABEL = { organ:'Órgano', virus:'Virus', medicine:'Medicina', treatment:'Tratamiento' };
const COLOR_HEX  = { red:'#E53935', blue:'#1E88E5', green:'#43A047', yellow:'#F9B800' };

// Treatment cards: how many of each are in the deck and what they do
const TREATMENTS = {
  transplant: { name:'Trasplante',        icon:'🔄', count:3, desc:'Intercambia un órgano entre dos jugadores cualesquiera (no inmunes, sin repetir colores).' },
  thief:      { name:'Ladrón de órganos', icon:'🦹', count:3, desc:'Roba un órgano no inmune de otro jugador (de un color que no tengas).' },
  contagion:  { name:'Contagio',          icon:'🤧', count:2, desc:'Pasa todos los virus que puedas de tus órganos a órganos libres de los demás.' },
  glove:      { name:'Guante de látex',   icon:'🧤', count:1, desc:'Todos los demás descartan su mano y pierden su próximo turno.' },
  error:      { name:'Error médico',      icon:'🔀', count:1, desc:'Intercambia todo tu cuerpo con el de otro jugador (incluidos los órganos inmunes).' }
};

// Declared here (not in the Spotify section below) because handleSpotifyCallback()
// is called from init() before the Spotify section is reached, and const is not hoisted.
// NOTE: this redirect URI must also be added to the Spotify app's dashboard.
const SPOTIFY_CLIENT_ID    = '3b539ada3a4b43f48efdb4a790ced26c';
const SPOTIFY_REDIRECT_URI = 'https://erwindank.github.io/virusgame/';
const SPOTIFY_SCOPES       = 'user-read-currently-playing user-read-playback-state';

// ============================================================
// CARD ART — small inline SVGs (48×48 viewBox)
// ============================================================

const ORGAN_PATHS = {
  // Heart
  red:    '<path d="M24 41s-17-10.5-17-22a9 9 0 0 1 17-4.2A9 9 0 0 1 41 19c0 11.5-17 22-17 22z"/>',
  // Brain: two lobes
  blue:   '<path d="M19 7a7 7 0 0 0-7 6.2A7 7 0 0 0 7.5 25 7 7 0 0 0 12 37a6.5 6.5 0 0 0 10 3.5V9.6A5 5 0 0 0 19 7zm10 0a5 5 0 0 0-3 2.6v30.9A6.5 6.5 0 0 0 36 37a7 7 0 0 0 4.5-12A7 7 0 0 0 36 13.2 7 7 0 0 0 29 7z"/>',
  // Stomach: tube on top, bean-shaped bag
  green:  '<path d="M17 3h6v8c10 0 19 7 19 17 0 9-7 16-16 16-5 0-8-3-11-5H5v-6h9c-2-3-3-6-3-9 0-7 3-11 6-13z"/>',
  // Bone, drawn diagonally
  yellow: '<g transform="rotate(-45 24 24)"><rect x="11" y="20" width="26" height="8" rx="3"/><circle cx="11" cy="19" r="5.5"/><circle cx="11" cy="29" r="5.5"/><circle cx="37" cy="19" r="5.5"/><circle cx="37" cy="29" r="5.5"/></g>'
};

// Virus: round body with 8 knobbed spikes and a little face
const VIRUS_PATH = (() => {
  let s = '';
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4 + Math.PI / 8;
    const x1 = (24 + Math.cos(a) * 11).toFixed(1), y1 = (24 + Math.sin(a) * 11).toFixed(1);
    const x2 = (24 + Math.cos(a) * 19).toFixed(1), y2 = (24 + Math.sin(a) * 19).toFixed(1);
    s += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke-width="3.2" stroke-linecap="round"/><circle cx="${x2}" cy="${y2}" r="3.4" stroke="none"/>`;
  }
  return s + '<circle cx="24" cy="24" r="12.5" stroke="none"/>'
           + '<circle cx="19.5" cy="22" r="2.6" fill="#fff" stroke="none"/><circle cx="28.5" cy="22" r="2.6" fill="#fff" stroke="none"/>'
           + '<circle cx="20" cy="22.6" r="1.2" fill="#111" stroke="none"/><circle cx="29" cy="22.6" r="1.2" fill="#111" stroke="none"/>'
           + '<path d="M19 30q5-4 10 0" stroke="#fff" stroke-width="2.2" fill="none" stroke-linecap="round"/>';
})();

// Medicine: a capsule, one half filled
const MEDICINE_PATH = '<g transform="rotate(-45 24 24)"><rect x="6" y="16" width="36" height="16" rx="8" fill="none" stroke-width="3.4"/><path d="M24 16h10a8 8 0 0 1 0 16H24z" stroke="none"/><path d="M12 21.5h6" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".7"/></g>';

// ============================================================
// FIREBASE INIT
// ============================================================

firebase.initializeApp(FIREBASE_CONFIG);
const auth = firebase.auth();
const db   = firebase.firestore();
const rtdb = firebase.database();

let localUid  = null;
let localName = null;
let currentRoomId = null;
let selectedEmoji = '';
let _emojiPicker  = null;
let roomUnsub     = null;
let roomState     = null;

// Presence state
let presenceRef    = null;
let rtdbRoomRef    = null;
const disconnectTimers = {};

// Re-establish RTDB presence when the tab becomes visible again (mobile bg/fg)
function refreshPresence() {
  if (presenceRef && localUid) {
    presenceRef.set({ name: localName, t: firebase.database.ServerValue.TIMESTAMP });
    presenceRef.onDisconnect().remove();
  }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') refreshPresence();
});
window.addEventListener('focus', refreshPresence);
// iOS/Android page lifecycle freeze/resume
window.addEventListener('resume', refreshPresence);

// AI state
let aiThinking = false;

// Chat state
let chatOpen = false;
let chatUnreadCount = 0;
const seenMessageIds = new Set();

// Notification state
let notifEnabled = localStorage.getItem('notifEnabled') === 'true';
let prevNotifState = null;
let notifAudioCtx = null;

function ensureNotifAudioCtx() {
  if (notifAudioCtx) return;
  try { notifAudioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (_) {}
}
document.addEventListener('click', ensureNotifAudioCtx, { once: true });

// Music state
const _savedMusicPref = localStorage.getItem('musicEnabled');
let musicEnabled = _savedMusicPref === null ? null : _savedMusicPref === 'true';
let musicMasterGain = null;
let musicPlaying = false;
let musicLoopTimer = null;

// ============================================================
// INIT — sign in anonymously, restore session
// ============================================================

async function init() {
  await handleSpotifyCallback();

  try {
    await auth.signInAnonymously();
    localUid = auth.currentUser.uid;
  } catch (e) {
    console.error('Auth failed:', e);
  }

  const savedRoom  = sessionStorage.getItem('roomId');
  const savedName  = sessionStorage.getItem('playerName');
  const savedEmoji = sessionStorage.getItem('playerEmoji');
  if (savedEmoji) {
    selectedEmoji = savedEmoji;
    const btn = document.getElementById('emoji-trigger-btn');
    if (btn) {
      btn.querySelector('.emoji-face').textContent = savedEmoji;
      btn.classList.add('has-emoji');
    }
  }
  if (savedRoom && savedName && localUid) {
    localName = savedName;
    await tryRejoin(savedRoom);
  }

  if (musicEnabled === true) {
    document.addEventListener('click', function startMusicOnInteraction() {
      ensureNotifAudioCtx();
      if (!musicPlaying) startMusic();
    }, { once: true });
  } else if (musicEnabled === null && !savedRoom) {
    setTimeout(showMusicPrompt, 700);
  }
}

init();
updateNotifButton();
updateMusicButton();

// ============================================================
// HELPERS
// ============================================================

function esc(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function stripLeadingEmoji(s) {
  return s.replace(/^\p{Emoji_Presentation}\s*/u, '').trim();
}

// Brighter versions of the card colours so they read well on the dark log
const LOG_COLOR_HEX = { red:'#ff6b6b', blue:'#64b5ff', green:'#6ee07a', yellow:'#ffd54a' };

function rainbowHTML(text) {
  const colors = [LOG_COLOR_HEX.red, LOG_COLOR_HEX.yellow, LOG_COLOR_HEX.green, LOG_COLOR_HEX.blue];
  return text.split('').map((ch, i) =>
    `<span style="color:${colors[i % 4]};font-weight:700">${ch}</span>`
  ).join('');
}

// Colours organ names in their own colour and "multicolor" as a rainbow
function colorizeLog(msg) {
  let s = esc(msg);
  s = s.replace(/Órgano multicolor/g, () => rainbowHTML('Órgano multicolor'));
  s = s.replace(/Corazón|Cerebro|Estómago|Hueso/g, name => {
    const key = Object.entries(ORGAN_NAME).find(([, v]) => v === name)?.[0];
    return `<span style="color:${LOG_COLOR_HEX[key]};font-weight:700">${name}</span>`;
  });
  return s;
}

function genRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function addLog(log, msg) {
  if (!msg) return log || [];
  return [...(log || []), msg].slice(-20);
}

function isMyTurn(state) {
  if (!state?.players?.length) return false;
  return state.players[state.currentPlayerIndex]?.id === localUid;
}

function nextPlayerIndex(state) {
  const n = state.players.length;
  return (state.currentPlayerIndex + 1) % n;
}

function showScreen(id) {
  if (id !== 'game') {
    if (chatOpen) {
      chatOpen = false;
      document.getElementById('chat-panel')?.classList.add('hidden');
    }
    leaveVoice();
    stopSpotifyPolling();
    stopLastfmPolling();
    stopListeningSpotifyTracks();
  }
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + id).classList.add('active');
  const gameCodeText = document.getElementById('game-room-code-text');
  if (gameCodeText) gameCodeText.textContent = currentRoomId || '';
  if (id === 'game') {
    listenSpotifyTracks();
    if (isSpotifyConnected()) startSpotifyPolling();
    if (isLastfmConnected()) startLastfmPolling();
    updateSpotifyButton();
    updateLastfmButton();
    const cbOk  = sessionStorage.getItem('spotify_callback_ok');
    const cbErr = sessionStorage.getItem('spotify_callback_error');
    if (cbOk) {
      sessionStorage.removeItem('spotify_callback_ok');
      setTimeout(openSpotifyModal, 400);
    } else if (cbErr) {
      sessionStorage.removeItem('spotify_callback_error');
      const msg = cbErr === 'access_denied'   ? 'Cancelaste la conexión con Spotify.'
                : cbErr === 'verifier_missing' ? 'Error de sesión Spotify. Intenta de nuevo.'
                : cbErr === 'fetch_failed'     ? 'No se pudo contactar Spotify. Revisa tu conexión.'
                :                               `Error de Spotify: ${cbErr}`;
      setTimeout(() => showSpotifyError(msg), 400);
    }
  }
}

function showLandingError(msg) {
  const el = document.getElementById('landing-error');
  el.textContent = msg;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 3500);
}

// ============================================================
// EMOJI PICKER
// ============================================================

function toggleEmojiPicker(e) {
  e && e.stopPropagation();
  if (selectedEmoji) {
    clearEmoji();
    return;
  }
  const wrap = document.getElementById('emoji-picker-wrap');
  if (!wrap.classList.contains('hidden')) {
    wrap.classList.add('hidden');
    return;
  }
  if (!_emojiPicker) {
    EmojiMart.init({
      data: async () => {
        const r = await fetch('https://cdn.jsdelivr.net/npm/@emoji-mart/data');
        return r.json();
      }
    });
    _emojiPicker = new EmojiMart.Picker({
      theme: 'dark',
      locale: 'en',
      set: 'native',
      onEmojiSelect(emoji) {
        selectedEmoji = emoji.native;
        const btn = document.getElementById('emoji-trigger-btn');
        btn.querySelector('.emoji-face').textContent = emoji.native;
        btn.classList.add('has-emoji');
        sessionStorage.setItem('playerEmoji', selectedEmoji);
        document.getElementById('emoji-picker-wrap').classList.add('hidden');
      }
    });
    wrap.appendChild(_emojiPicker);
  }
  wrap.classList.remove('hidden');
}

function clearEmoji() {
  selectedEmoji = '';
  sessionStorage.removeItem('playerEmoji');
  const btn = document.getElementById('emoji-trigger-btn');
  btn.querySelector('.emoji-face').textContent = '🙂';
  btn.classList.remove('has-emoji');
}

document.addEventListener('click', (e) => {
  const wrap = document.getElementById('emoji-picker-wrap');
  if (!wrap || wrap.classList.contains('hidden')) return;
  const btn = document.getElementById('emoji-trigger-btn');
  if (!wrap.contains(e.target) && !btn.contains(e.target)) {
    wrap.classList.add('hidden');
  }
});

// ============================================================
// LANDING
// ============================================================

function showJoin() {
  document.getElementById('join-form').classList.toggle('hidden');
}

async function handleCreate() {
  const rawName = document.getElementById('player-name').value.trim();
  if (!rawName) { showLandingError('Escribe tu nombre primero'); return; }
  if (!localUid) { showLandingError('Aún conectando… intenta de nuevo'); return; }
  const name = selectedEmoji ? selectedEmoji + ' ' + rawName : rawName;
  localName = name;

  const roomId = genRoomCode();
  await db.collection(ROOMS).doc(roomId).set({
    game: GAME_TAG,
    status: 'lobby',
    hostId: localUid,
    players: [{ id: localUid, name, cardCount: 0 }],
    currentPlayerIndex: 0,
    hands: {},
    bodies: {},
    drawPile: [],
    discardPile: [],
    lastAction: null,
    log: [],
    winner: null,
    winnerName: null,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    lastActivity: firebase.firestore.FieldValue.serverTimestamp()
  });

  currentRoomId = roomId;
  sessionStorage.setItem('roomId', roomId);
  sessionStorage.setItem('playerName', name);
  sessionStorage.setItem('playerEmoji', selectedEmoji);
  subscribeToRoom(roomId);
  showScreen('lobby');
}

function getUniqueName(desiredName, players) {
  if (!players.some(p => p.name === desiredName)) return desiredName;
  let n = 2;
  while (players.some(p => p.name === desiredName + n)) n++;
  return desiredName + n;
}

async function handleJoin() {
  const rawName = document.getElementById('player-name').value.trim();
  const code = document.getElementById('room-code-input').value.trim().toUpperCase();
  if (!rawName) { showLandingError('Escribe tu nombre primero'); return; }
  if (code.length !== 6) { showLandingError('Introduce el código de sala de 6 caracteres'); return; }
  if (!localUid) { showLandingError('Aún conectando… intenta de nuevo'); return; }
  const name = selectedEmoji ? selectedEmoji + ' ' + rawName : rawName;

  const snap = await db.collection(ROOMS).doc(code).get();
  if (!snap.exists || !isVirusRoom(snap.data())) { showLandingError('Sala no encontrada'); return; }
  const data = snap.data();
  if (data.status === 'ended') { showLandingError('La partida ya terminó'); return; }

  if (data.status === 'lobby') {
    if (data.players.length >= MAX_PLAYERS) { showLandingError(`Sala llena (máximo ${MAX_PLAYERS})`); return; }

    if (!data.players.find(p => p.id === localUid)) {
      const uniqueName = getUniqueName(name, data.players);
      localName = uniqueName;
      await db.collection(ROOMS).doc(code).update({
        players: firebase.firestore.FieldValue.arrayUnion({ id: localUid, name: uniqueName, cardCount: 0 })
      });
    } else {
      localName = data.players.find(p => p.id === localUid).name;
    }

    currentRoomId = code;
    sessionStorage.setItem('roomId', code);
    sessionStorage.setItem('playerName', localName);
    sessionStorage.setItem('playerEmoji', selectedEmoji);
    subscribeToRoom(code);
    showScreen('lobby');

  } else if (data.status === 'playing') {
    // Try exact match, then match ignoring emoji prefix (for cross-device reconnect)
    const existingPlayer = data.players.find(p =>
      p.name === name || p.name === rawName || stripLeadingEmoji(p.name) === rawName
    );

    if (existingPlayer) {
      // Reconnect: take over that player's slot, clear disconnected flag
      const oldUid = existingPlayer.id;
      const wasDisconnected = !!existingPlayer.disconnected;

      if (oldUid !== localUid || wasDisconnected) {
        const newPlayers = data.players.map(p =>
          p.id === oldUid ? { ...p, id: localUid, disconnected: false } : p
        );
        const updates = {
          players: newPlayers,
          lastActivity: firebase.firestore.FieldValue.serverTimestamp()
        };
        if (oldUid !== localUid) {
          // Move the hand and the body over to the new uid
          updates[`hands.${localUid}`]  = data.hands?.[oldUid] || [];
          updates[`hands.${oldUid}`]    = firebase.firestore.FieldValue.delete();
          updates[`bodies.${localUid}`] = data.bodies?.[oldUid] || [];
          updates[`bodies.${oldUid}`]   = firebase.firestore.FieldValue.delete();
        }
        if (wasDisconnected) {
          updates.log = addLog(data.log, `${existingPlayer.name} se reconectó.`);
        }
        await db.collection(ROOMS).doc(code).update(updates);
      }
      localName = existingPlayer.name;
    } else {
      // New player joining mid-game: deal 3 cards and an empty body
      if (data.players.length >= MAX_PLAYERS) { showLandingError(`Sala llena (máximo ${MAX_PLAYERS})`); return; }
      const uniqueName = getUniqueName(name, data.players);
      const g = { drawPile: [...(data.drawPile || [])], discardPile: [...(data.discardPile || [])] };
      const hand = refillHand(g, [], HAND_SIZE);
      localName = uniqueName;
      await db.collection(ROOMS).doc(code).update({
        players: firebase.firestore.FieldValue.arrayUnion({ id: localUid, name: uniqueName, cardCount: hand.length }),
        [`hands.${localUid}`]: hand,
        [`bodies.${localUid}`]: [],
        drawPile: g.drawPile,
        discardPile: g.discardPile,
        log: addLog(data.log, `${uniqueName} se unió a la partida.`),
        lastActivity: firebase.firestore.FieldValue.serverTimestamp()
      });
    }

    currentRoomId = code;
    sessionStorage.setItem('roomId', code);
    sessionStorage.setItem('playerName', localName);
    sessionStorage.setItem('playerEmoji', selectedEmoji);
    subscribeToRoom(code);
    showScreen('game');
  }
}

async function tryRejoin(roomId) {
  try {
    const snap = await db.collection(ROOMS).doc(roomId).get();
    if (!snap.exists || !isVirusRoom(snap.data())) { sessionStorage.clear(); return; }
    const data = snap.data();
    const player = data.players.find(p => p.id === localUid);
    if (!player) { sessionStorage.clear(); return; }

    if (player.disconnected) {
      const newPlayers = data.players.map(p =>
        p.id === localUid ? { ...p, disconnected: false } : p
      );
      await db.collection(ROOMS).doc(roomId).update({
        players: newPlayers,
        log: addLog(data.log, `${player.name} se reconectó.`),
        lastActivity: firebase.firestore.FieldValue.serverTimestamp()
      });
    }

    currentRoomId = roomId;
    subscribeToRoom(roomId);
    if (data.status === 'lobby') showScreen('lobby');
    else if (data.status === 'playing') showScreen('game');
    else if (data.status === 'ended') showScreen('winner');
  } catch (_) { sessionStorage.clear(); }
}

function copyCode() {
  navigator.clipboard.writeText(currentRoomId).catch(() => {});
  const btn = document.querySelector('.btn-copy');
  btn.textContent = '¡Copiado!';
  setTimeout(() => { btn.textContent = 'Copiar'; }, 1500);
}

function copyGameCode(el) {
  navigator.clipboard.writeText(currentRoomId).catch(() => {});
  const textEl = el.querySelector('#game-room-code-text');
  const original = textEl.textContent;
  textEl.textContent = '¡Copiado!';
  el.querySelector('svg').style.display = 'none';
  setTimeout(() => {
    textEl.textContent = original;
    el.querySelector('svg').style.display = '';
  }, 1500);
}

// ============================================================
// PRESENCE — disconnect detection via RTDB + beforeunload
// ============================================================

function setupPresence(roomId) {
  teardownPresence();

  presenceRef  = rtdb.ref(`presence/${roomId}/${localUid}`);
  rtdbRoomRef  = rtdb.ref(`presence/${roomId}`);

  presenceRef.set({ name: localName, t: firebase.database.ServerValue.TIMESTAMP });
  presenceRef.onDisconnect().remove();

  rtdbRoomRef.on('value', snap => {
    if (!roomState || !currentRoomId) return;
    const present = snap.val() || {};

    for (const player of roomState.players) {
      if (player.id === localUid) continue;
      if (player.isAI) continue;

      if (!present[player.id]) {
        if (!disconnectTimers[player.id]) {
          const pid  = player.id;
          const pname = player.name;
          disconnectTimers[pid] = setTimeout(async () => {
            delete disconnectTimers[pid];
            if (roomState?.players.find(p => p.id === pid)) {
              await markPlayerDisconnected(pid, pname);
            }
          }, 180000);
        }
      } else {
        if (disconnectTimers[player.id]) {
          clearTimeout(disconnectTimers[player.id]);
          delete disconnectTimers[player.id];
        }
      }
    }
  });
}

function teardownPresence() {
  if (presenceRef) {
    presenceRef.onDisconnect().cancel();
    presenceRef.remove();
    presenceRef = null;
  }
  if (rtdbRoomRef) {
    rtdbRoomRef.off();
    rtdbRoomRef = null;
  }
  Object.keys(disconnectTimers).forEach(uid => {
    clearTimeout(disconnectTimers[uid]);
    delete disconnectTimers[uid];
  });
  if (voiceActivityRef) { voiceActivityRef.off(); voiceActivityRef = null; }
  voiceActivityLoaded = false;
}

function setupVoiceActivityListener(roomId) {
  if (voiceActivityRef) { voiceActivityRef.off(); voiceActivityRef = null; }
  voiceActivityLoaded = false;
  const ref = rtdb.ref(`voice/${roomId}/active`);
  voiceActivityRef = ref;
  ref.on('child_added', snap => {
    if (!voiceActivityLoaded) return;
    const uid = snap.key;
    if (uid === localUid) return;
    const player = roomState?.players?.find(p => p.id === uid);
    const name = player?.name || 'Alguien';
    notify('🎤 Chat de voz', `${name} abrió el micrófono.`);
    showVoiceJoinToast(`🎤 ${name} abrió el micrófono`);
  });
  ref.on('child_removed', snap => {
    const uid = snap.key;
    if (uid === localUid) return;
    const player = roomState?.players?.find(p => p.id === uid);
    const name = player?.name || 'Alguien';
    showVoiceJoinToast(`📵 ${name} dejó el chat de voz`);
  });
  ref.on('child_changed', snap => {
    const uid = snap.key;
    if (uid === localUid) return;
    const player = roomState?.players?.find(p => p.id === uid);
    const name = player?.name || 'Alguien';
    if (snap.val()?.muted) {
      showVoiceJoinToast(`🔇 ${name} silenció el micrófono`);
    } else {
      showVoiceJoinToast(`🎤 ${name} activó el micrófono`);
    }
  });
  ref.once('value', () => { voiceActivityLoaded = true; });
}

async function markPlayerDisconnected(uid, name) {
  if (!currentRoomId) return;
  try {
    await db.runTransaction(async tx => {
      const ref  = db.collection(ROOMS).doc(currentRoomId);
      const snap = await tx.get(ref);
      if (!snap.exists) return;

      const state  = snap.data();
      const player = state.players.find(p => p.id === uid);
      if (!player || player.disconnected) return; // not found or already marked

      const newPlayers = state.players.map(p =>
        p.id === uid ? { ...p, disconnected: true } : p
      );
      tx.update(ref, {
        players: newPlayers,
        log: addLog(state.log, `${name} se desconectó.`),
        lastActivity: firebase.firestore.FieldValue.serverTimestamp()
      });
    });
  } catch (e) {
    console.error('markPlayerDisconnected failed:', e);
  }
}

function removeDisconnectedFromLobby(state) {
  const newPlayers = state.players.filter(p => !p.disconnected);
  if (newPlayers.length === 0) {
    db.collection(ROOMS).doc(currentRoomId).delete().catch(() => {});
    return;
  }
  const removedIds = state.players.filter(p => p.disconnected).map(p => p.id);
  const update = {
    players: newPlayers,
    lastActivity: firebase.firestore.FieldValue.serverTimestamp()
  };
  if (removedIds.includes(state.hostId)) update.hostId = (newPlayers.find(p => !p.isAI) || newPlayers[0]).id;
  db.collection(ROOMS).doc(currentRoomId).update(update).catch(() => {});
}

function skipDisconnectedTurn(state) {
  const current = state.players[state.currentPlayerIndex];
  db.collection(ROOMS).doc(currentRoomId).update({
    currentPlayerIndex: nextPlayerIndex(state),
    log: addLog(state.log, `Se saltó el turno de ${current.name} (desconectado).`),
    lastActivity: firebase.firestore.FieldValue.serverTimestamp()
  }).catch(() => {});
}

// ============================================================
// ROOM SUBSCRIPTION
// ============================================================

function subscribeToRoom(roomId) {
  if (roomUnsub) roomUnsub();
  prevNotifState = null;
  roomUnsub = db.collection(ROOMS).doc(roomId).onSnapshot(snap => {
    if (!snap.exists) return;
    roomState = snap.data();
    onRoomUpdate(roomState);
  });
  setupPresence(roomId);
  setupVoiceActivityListener(roomId);
}

function onRoomUpdate(state) {
  checkNotifications(state);
  if (state.status === 'lobby') {
    const hasDisconnected = state.players.some(p => p.disconnected);
    if (hasDisconnected) removeDisconnectedFromLobby(state);
    showScreen('lobby');
    renderLobby(state);
  } else if (state.status === 'playing') {
    // Check if all players agreed to end — any client that detects it triggers the update;
    // Firestore's atomic write means duplicate triggers just overwrite with the same result.
    const votes = state.endVotes || [];
    const connectedPlayers = state.players.filter(p => !p.disconnected);
    if (connectedPlayers.length > 0 && connectedPlayers.every(p => votes.includes(p.id))) {
      const result = determineWinner(state);
      db.collection(ROOMS).doc(currentRoomId).update({
        status: 'ended',
        winner: result.winner,
        winnerName: result.winnerName,
        winCondition: result.winCondition,
        winnerReason: 'vote',
        log: addLog(state.log, `Partida terminada por acuerdo. ¡${result.winnerName} gana!`)
      }).catch(() => {});
      return;
    }
    // Auto-skip disconnected players' turns (any client can trigger; same result from all)
    const currentPlayer = state.players[state.currentPlayerIndex];
    const activePlayers = state.players.filter(p => !p.disconnected);
    if (currentPlayer?.disconnected && activePlayers.length > 0) {
      skipDisconnectedTurn(state);
    }
    showScreen('game');
    renderGame(state);
    maybeRunAI(state);
  } else if (state.status === 'ended') {
    showScreen('winner');
    renderWinner(state);
  }
}

// ============================================================
// LOBBY RENDER
// ============================================================

function renderLobby(state) {
  document.getElementById('lobby-code').textContent = currentRoomId;

  const prevNames  = state.prevPlayerNames || [];
  const readyVotes = state.readyVotes || [];
  const isRematch  = prevNames.length > 0;

  const isHost = state.hostId === localUid;
  document.getElementById('player-list').innerHTML = state.players.map(p => {
    const isReady   = readyVotes.includes(p.id);
    const wasHere   = isRematch && prevNames.includes(p.name);
    const removeBtn = (isHost && p.isAI)
      ? `<button class="btn-remove-bot" onclick="handleRemoveBot('${p.id}')" title="Eliminar bot">×</button>`
      : '';
    return `<div class="player-item ${p.id === localUid ? 'me' : ''} ${p.disconnected ? 'player-disconnected' : ''} ${p.isAI ? 'ai-player' : ''}">
      ${p.id === state.hostId ? '👑 ' : ''}${esc(p.name)}
      ${wasHere ? '<span class="prev-badge">vuelve</span>' : ''}
      ${isReady  ? '<span class="ready-badge">✓ listo</span>' : ''}
      ${p.disconnected ? ' <span class="dc-badge">desconectado</span>' : ''}
      ${removeBtn}
    </div>`;
  }).join('');

  // Ready-up button (only shown in rematch lobbies)
  let readyArea = document.getElementById('lobby-ready-area');
  if (!readyArea) {
    readyArea = document.createElement('div');
    readyArea.id = 'lobby-ready-area';
    document.querySelector('.lobby-actions').prepend(readyArea);
  }
  if (isRematch) {
    const alreadyReady = readyVotes.includes(localUid);
    readyArea.innerHTML = alreadyReady
      ? '<p class="muted ready-confirmed">✓ Estás listo para jugar</p>'
      : '<button class="btn btn-primary" onclick="handleReadyVote()">¡Quiero jugar de nuevo!</button>';
  } else {
    readyArea.innerHTML = '';
  }

  const canStart = state.players.length >= 2;
  const startBtn = document.getElementById('start-btn');
  const waitMsg  = document.getElementById('waiting-msg');

  startBtn.classList.toggle('hidden', !isHost);
  waitMsg.classList.toggle('hidden', isHost);

  if (isHost) {
    startBtn.disabled = !canStart;
    startBtn.textContent = canStart ? 'Iniciar partida' : 'Esperando jugadores…';
  }

  // Add Bot button (host only)
  let botArea = document.getElementById('lobby-bot-area');
  if (!botArea) {
    botArea = document.createElement('div');
    botArea.id = 'lobby-bot-area';
    document.querySelector('.lobby-actions').appendChild(botArea);
  }
  if (isHost && state.players.length < MAX_PLAYERS) {
    botArea.innerHTML = `<button class="btn btn-bot" onclick="handleAddBot()">+ Agregar Bot 🤖</button>`;
  } else {
    botArea.innerHTML = '';
  }
}

// ============================================================
// START GAME — host deals cards
// ============================================================

async function handleStart() {
  if (!roomState || roomState.players.length < 2) return;

  const g = { drawPile: shuffle(createDeck()), discardPile: [] };
  const players = roomState.players;
  const hands  = {};
  const bodies = {};

  // Everyone gets 3 cards and an empty body
  for (const p of players) {
    hands[p.id]  = refillHand(g, [], HAND_SIZE);
    bodies[p.id] = [];
  }

  // A random player goes first
  const first = Math.floor(Math.random() * players.length);
  const playersWithCounts = players.map(p => ({ ...p, cardCount: HAND_SIZE }));

  await db.collection(ROOMS).doc(currentRoomId).update({
    status: 'playing',
    players: playersWithCounts,
    currentPlayerIndex: first,
    hands,
    bodies,
    drawPile: g.drawPile,
    discardPile: [],
    lastAction: null,
    log: [`¡Partida iniciada! ${players[first].name} va primero.`],
    winner: null,
    winnerName: null,
    winnerReason: null,
    endVotes: [],
    lastActivity: firebase.firestore.FieldValue.serverTimestamp()
  });
}

async function handleAddBot() {
  if (!roomState || roomState.status !== 'lobby') return;
  if (roomState.hostId !== localUid) return;
  if (roomState.players.length >= MAX_PLAYERS) return;
  const botCount = roomState.players.filter(p => p.isAI).length;
  const botName  = botCount === 0 ? '🤖 Bot' : `🤖 Bot ${botCount + 1}`;
  const botId    = 'ai-' + Math.random().toString(36).slice(2, 9);
  await db.collection(ROOMS).doc(currentRoomId).update({
    players: firebase.firestore.FieldValue.arrayUnion(
      { id: botId, name: botName, cardCount: 0, isAI: true }
    ),
    lastActivity: firebase.firestore.FieldValue.serverTimestamp()
  });
}

async function handleRemoveBot(botId) {
  if (!roomState || roomState.hostId !== localUid) return;
  const newPlayers = roomState.players.filter(p => p.id !== botId);
  await db.collection(ROOMS).doc(currentRoomId).update({
    players: newPlayers,
    lastActivity: firebase.firestore.FieldValue.serverTimestamp()
  });
}

// ============================================================
// CHAT
// ============================================================

function toggleChat() {
  chatOpen = !chatOpen;
  const panel = document.getElementById('chat-panel');
  panel.classList.toggle('hidden', !chatOpen);
  if (chatOpen) {
    chatUnreadCount = 0;
    updateChatBadge();
    if (roomState) renderChatPanel(roomState);
    const el = document.getElementById('chat-messages');
    if (el) el.scrollTop = el.scrollHeight;
    setTimeout(() => document.getElementById('chat-input')?.focus(), 50);
  }
}

function updateChatBadge() {
  const badge = document.getElementById('chat-unread');
  if (!badge) return;
  if (chatUnreadCount > 0) {
    badge.textContent = chatUnreadCount > 9 ? '9+' : String(chatUnreadCount);
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

async function sendChatMessage(text) {
  if (!text || !text.trim() || !currentRoomId) return;
  const trimmed = text.trim();
  await db.runTransaction(async tx => {
    const ref  = db.collection(ROOMS).doc(currentRoomId);
    const snap = await tx.get(ref);
    if (!snap.exists) return;
    const msgs = snap.data().messages || [];
    const msg  = {
      id:   Date.now().toString(36) + Math.random().toString(36).slice(2),
      pid:  localUid,
      name: localName,
      text: trimmed,
      ts:   Date.now()
    };
    tx.update(ref, { messages: [...msgs, msg].slice(-50) });
  });
}

function sendEmote(emoji) {
  sendChatMessage(emoji).catch(() => {});
}

async function handleChatSend() {
  const input = document.getElementById('chat-input');
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  await sendChatMessage(text);
}

function handleChatKeydown(e) {
  if (e.key === 'Enter') handleChatSend();
}

function renderChatPanel(state) {
  const msgs = state.messages || [];

  // Count new messages from others and mark all as seen
  let newCount = 0;
  for (const msg of msgs) {
    if (!seenMessageIds.has(msg.id) && msg.pid !== localUid) newCount++;
    seenMessageIds.add(msg.id);
  }
  if (!chatOpen && newCount > 0) {
    chatUnreadCount += newCount;
    updateChatBadge();
    playChatSound();
  }

  if (!chatOpen) return;

  chatUnreadCount = 0;
  updateChatBadge();

  const playersEl = document.getElementById('chat-players');
  if (playersEl) {
    const players = state.players || [];
    playersEl.innerHTML = players.map(p => {
      const isMe = p.id === localUid;
      const dc = p.disconnected;
      return `<span class="chat-player-chip ${dc ? 'dc' : ''}">${esc(p.name)}${isMe ? ' (yo)' : ''}</span>`;
    }).join('');
  }

  const el = document.getElementById('chat-messages');
  if (!el) return;
  const wasAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
  el.innerHTML = msgs.map(msg => {
    const mine = msg.pid === localUid;
    const time = msg.ts ? new Date(msg.ts).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}) : '';
    return `<div class="chat-msg ${mine ? 'mine' : ''}">
      ${!mine ? `<span class="chat-msg-name">${esc(msg.name)}</span>` : ''}
      <div class="chat-msg-bubble">${esc(msg.text)}</div>
      ${time ? `<span class="chat-msg-time">${time}</span>` : ''}
    </div>`;
  }).join('');
  if (wasAtBottom || msgs.length <= 3) el.scrollTop = el.scrollHeight;
}

function renderSpeechBubbles(state) {
  if (chatOpen) return;
  const msgs = state.messages || [];
  const container = document.getElementById('speech-bubbles');
  if (!container) return;
  const now = Date.now();
  for (const msg of msgs) {
    const bubbleKey = 'b_' + msg.id;
    if (seenMessageIds.has(bubbleKey)) continue;
    seenMessageIds.add(bubbleKey);
    if (msg.pid === localUid) continue;
    if (now - msg.ts > 6000) continue;
    const bubble = document.createElement('div');
    bubble.className = 'speech-bubble';
    bubble.innerHTML = `<strong>${esc(msg.name)}:</strong> ${esc(msg.text)}`;
    container.appendChild(bubble);
    setTimeout(() => bubble.remove(), 4000);
  }
}

// ============================================================
// NOTIFICATIONS
// ============================================================

function toggleNotifications() {
  if (!('Notification' in window)) return;
  if (!notifEnabled) {
    Notification.requestPermission().then(perm => {
      notifEnabled = perm === 'granted';
      localStorage.setItem('notifEnabled', notifEnabled ? 'true' : 'false');
      updateNotifButton();
      if (notifEnabled) {
        try {
          notifAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
          notifAudioCtx.resume();
        } catch (_) {}
        try { new Notification('🔔 Notificaciones activadas', { body: 'Recibirás avisos del juego.', tag: 'notif-test' }); } catch (_) {}
        showVoiceToast('🔔 Notificaciones activadas');
      }
    });
  } else {
    notifEnabled = false;
    localStorage.setItem('notifEnabled', 'false');
    updateNotifButton();
  }
}

function updateNotifButton() {
  const btn = document.getElementById('notif-toggle-btn');
  if (!btn) return;
  const active = notifEnabled && Notification.permission === 'granted';
  btn.classList.toggle('notif-active', active);
  btn.title = active ? 'Desactivar notificaciones' : 'Activar notificaciones';
  btn.textContent = active ? '🔔' : '🔕';
}

function playChatSound() {
  ensureNotifAudioCtx();
  if (!notifAudioCtx) return;
  try {
    notifAudioCtx.resume().then(() => {
      const ctx = notifAudioCtx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'triangle';
      osc.frequency.value = 520;
      const t = ctx.currentTime;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.2, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      osc.start(t);
      osc.stop(t + 0.18);
    });
  } catch (_) {}
}

function playNotifSound() {
  ensureNotifAudioCtx();
  if (!notifAudioCtx) return;
  try {
    notifAudioCtx.resume().then(() => {
      const ctx = notifAudioCtx;
      const notes = [880, 1108];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.value = freq;
        const t = ctx.currentTime + i * 0.12;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.3, t + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
        osc.start(t);
        osc.stop(t + 0.25);
      });
    });
  } catch (_) {}
}

// ============================================================
// BACKGROUND MUSIC
// ============================================================

// 4-bar loop in D major at 104 BPM
// Each entry: [beat_offset, duration_beats, freq_Hz, volume, osc_type]
const MUSIC_BPM = 104;
const MUSIC_BEAT = 60 / MUSIC_BPM;
const MUSIC_TOTAL_BEATS = 16;
const MUSIC_SCORE = [
  // Melody (triangle wave)
  [0,    1.0, 293.7, 0.18, 'triangle'], // D4
  [1,    0.5, 329.6, 0.14, 'triangle'], // E4
  [1.5,  0.5, 392.0, 0.16, 'triangle'], // G4
  [2,    1.5, 440.0, 0.20, 'triangle'], // A4
  [3.5,  0.5, 493.9, 0.16, 'triangle'], // B4
  [4,    1.0, 440.0, 0.18, 'triangle'], // A4
  [5,    0.5, 392.0, 0.14, 'triangle'], // G4
  [5.5,  0.5, 369.9, 0.13, 'triangle'], // F#4
  [6,    1.0, 329.6, 0.16, 'triangle'], // E4
  [7,    1.0, 293.7, 0.18, 'triangle'], // D4
  [8,    1.0, 392.0, 0.18, 'triangle'], // G4
  [9,    0.5, 440.0, 0.14, 'triangle'], // A4
  [9.5,  0.5, 493.9, 0.14, 'triangle'], // B4
  [10,   1.0, 587.3, 0.20, 'triangle'], // D5
  [11,   1.0, 554.4, 0.18, 'triangle'], // C#5
  [12,   0.5, 493.9, 0.14, 'triangle'], // B4
  [12.5, 0.5, 440.0, 0.14, 'triangle'], // A4
  [13,   1.0, 392.0, 0.16, 'triangle'], // G4
  [14,   1.0, 369.9, 0.15, 'triangle'], // F#4
  [15,   1.0, 293.7, 0.22, 'triangle'], // D4
  // Bass (sine wave)
  [0,    2,   146.8, 0.14, 'sine'],     // D3
  [2,    2,   110.0, 0.12, 'sine'],     // A2
  [4,    2,   110.0, 0.13, 'sine'],     // A2
  [6,    1,   164.8, 0.11, 'sine'],     // E3
  [7,    1,   146.8, 0.11, 'sine'],     // D3
  [8,    1,   196.0, 0.12, 'sine'],     // G3
  [9,    1,   196.0, 0.11, 'sine'],     // G3
  [10,   2,   146.8, 0.12, 'sine'],     // D3
  [12,   2,   110.0, 0.13, 'sine'],     // A2
  [14,   2,   146.8, 0.12, 'sine'],     // D3
];

function scheduleMusicNote(ctx, startTime, durationBeats, freq, vol, oscType) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(musicMasterGain);
  osc.type = oscType;
  osc.frequency.value = freq;
  const dur = durationBeats * MUSIC_BEAT;
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(vol, startTime + 0.02);
  gain.gain.setValueAtTime(vol, startTime + dur - 0.06);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + dur + 0.04);
  osc.start(startTime);
  osc.stop(startTime + dur + 0.06);
}

function scheduleMusicLoop(loopStartTime) {
  const ctx = notifAudioCtx;
  if (!ctx || !musicPlaying) return;
  MUSIC_SCORE.forEach(([beat, dur, freq, vol, type]) => {
    scheduleMusicNote(ctx, loopStartTime + beat * MUSIC_BEAT, dur, freq, vol, type);
  });
  const loopDuration = MUSIC_TOTAL_BEATS * MUSIC_BEAT;
  musicLoopTimer = setTimeout(() => {
    if (musicPlaying) scheduleMusicLoop(loopStartTime + loopDuration);
  }, (loopDuration - 0.5) * 1000);
}

function startMusic() {
  if (musicPlaying || !notifAudioCtx) return;
  musicPlaying = true;
  notifAudioCtx.resume().then(() => {
    musicMasterGain = notifAudioCtx.createGain();
    musicMasterGain.gain.setValueAtTime(0, notifAudioCtx.currentTime);
    musicMasterGain.gain.linearRampToValueAtTime(0.5, notifAudioCtx.currentTime + 2.0);
    musicMasterGain.connect(notifAudioCtx.destination);
    scheduleMusicLoop(notifAudioCtx.currentTime + 0.15);
    updateMusicButton();
  });
}

function stopMusic() {
  musicPlaying = false;
  clearTimeout(musicLoopTimer);
  if (musicMasterGain && notifAudioCtx) {
    const oldGain = musicMasterGain;
    musicMasterGain = null;
    oldGain.gain.cancelScheduledValues(notifAudioCtx.currentTime);
    oldGain.gain.setTargetAtTime(0, notifAudioCtx.currentTime, 0.2);
    setTimeout(() => { try { oldGain.disconnect(); } catch (_) {} }, 1200);
  }
  updateMusicButton();
}

function toggleMusic() {
  if (musicPlaying) {
    musicEnabled = false;
    localStorage.setItem('musicEnabled', 'false');
    stopMusic();
  } else {
    musicEnabled = true;
    localStorage.setItem('musicEnabled', 'true');
    ensureNotifAudioCtx();
    startMusic();
  }
}

function enableMusic() {
  musicEnabled = true;
  localStorage.setItem('musicEnabled', 'true');
  document.getElementById('music-prompt')?.classList.add('hidden');
  ensureNotifAudioCtx();
  startMusic();
  updateMusicButton();
}

function disableMusic() {
  musicEnabled = false;
  localStorage.setItem('musicEnabled', 'false');
  document.getElementById('music-prompt')?.classList.add('hidden');
  updateMusicButton();
}

function showMusicPrompt() {
  document.getElementById('music-prompt')?.classList.remove('hidden');
}

function updateMusicButton() {
  const btn = document.getElementById('music-toggle-btn');
  if (!btn) return;
  btn.textContent = musicPlaying ? '🎵' : '🔇';
  btn.title = musicPlaying ? 'Silenciar música' : 'Activar música';
  btn.classList.toggle('music-active', musicPlaying);
}

// ============================================================
// SPOTIFY INTEGRATION
// ============================================================

const SPOTIFY_SVG_SMALL    = `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>`;
const SPOTIFY_SVG_LARGE    = `<svg class="spotify-modal-logo" viewBox="0 0 24 24" width="36" height="36" fill="#1DB954"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>`;

let spotifyPollTimer      = null;
let spotifyTracksRef      = null;
let spotifyTracksData     = {};

// ----- PKCE helpers -----

function generateCodeVerifier() {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return btoa(String.fromCharCode(...arr)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
}

async function generateCodeChallenge(verifier) {
  const data   = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
}

// ----- Auth -----

async function initiateSpotifyAuth() {
  const verifier   = generateCodeVerifier();
  const challenge  = await generateCodeChallenge(verifier);
  localStorage.setItem('spotify_code_verifier', verifier);
  const params = new URLSearchParams({
    client_id:             SPOTIFY_CLIENT_ID,
    response_type:         'code',
    redirect_uri:          SPOTIFY_REDIRECT_URI,
    scope:                 SPOTIFY_SCOPES,
    code_challenge_method: 'S256',
    code_challenge:        challenge,
  });
  window.location.href = `https://accounts.spotify.com/authorize?${params}`;
}

async function handleSpotifyCallback() {
  const params = new URLSearchParams(window.location.search);
  const error  = params.get('error');
  const code   = params.get('code');
  if (!code && !error) return;
  window.history.replaceState({}, '', window.location.pathname);
  if (error) {
    localStorage.removeItem('spotify_code_verifier');
    sessionStorage.setItem('spotify_callback_error', error);
    return;
  }
  const verifier = localStorage.getItem('spotify_code_verifier');
  if (!verifier) {
    sessionStorage.setItem('spotify_callback_error', 'verifier_missing');
    return;
  }
  try {
    const res  = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id:     SPOTIFY_CLIENT_ID,
        grant_type:    'authorization_code',
        code,
        redirect_uri:  SPOTIFY_REDIRECT_URI,
        code_verifier: verifier,
      }),
    });
    const data = await res.json();
    if (data.access_token) {
      localStorage.setItem('spotify_access_token',  data.access_token);
      localStorage.setItem('spotify_refresh_token', data.refresh_token);
      localStorage.setItem('spotify_expires_at',    Date.now() + data.expires_in * 1000);
      sessionStorage.setItem('spotify_callback_ok', '1');
    } else {
      console.error('Spotify token error:', data);
      sessionStorage.setItem('spotify_callback_error', data.error || 'unknown');
    }
  } catch (e) {
    console.error('Spotify fetch error:', e);
    sessionStorage.setItem('spotify_callback_error', 'fetch_failed');
  }
  localStorage.removeItem('spotify_code_verifier');
}

async function refreshSpotifyToken() {
  const rt = localStorage.getItem('spotify_refresh_token');
  if (!rt) return false;
  try {
    const res  = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type:    'refresh_token',
        refresh_token: rt,
        client_id:     SPOTIFY_CLIENT_ID,
      }),
    });
    const data = await res.json();
    if (data.access_token) {
      localStorage.setItem('spotify_access_token', data.access_token);
      localStorage.setItem('spotify_expires_at',   Date.now() + data.expires_in * 1000);
      if (data.refresh_token) localStorage.setItem('spotify_refresh_token', data.refresh_token);
      return true;
    }
  } catch (_) {}
  return false;
}

async function getSpotifyToken() {
  const exp = parseInt(localStorage.getItem('spotify_expires_at') || '0');
  if (Date.now() > exp - 60000) {
    const ok = await refreshSpotifyToken();
    if (!ok) return null;
  }
  return localStorage.getItem('spotify_access_token');
}

function isSpotifyConnected() {
  return !!localStorage.getItem('spotify_access_token');
}

function disconnectSpotify() {
  stopSpotifyPolling();
  clearSpotifyTrackFromRoom();
  localStorage.removeItem('spotify_access_token');
  localStorage.removeItem('spotify_refresh_token');
  localStorage.removeItem('spotify_expires_at');
  updateSpotifyButton();
  closeSpotifyModal();
}

// ----- Now Playing -----

async function fetchNowPlaying() {
  const token = await getSpotifyToken();
  if (!token) return;
  try {
    const res = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 204 || res.status === 404) { updateSpotifyTrackInRoom(null); return; }
    if (!res.ok) return;
    const data = await res.json();
    if (!data.is_playing || !data.item) { updateSpotifyTrackInRoom(null); return; }
    updateSpotifyTrackInRoom({
      title:    data.item.name,
      artist:   data.item.artists.map(a => a.name).join(', '),
      albumArt: data.item.album.images.at(-1)?.url || null,
      source:   'spotify',
    });
  } catch (_) {}
}

function startSpotifyPolling() {
  stopSpotifyPolling();
  fetchNowPlaying();
  spotifyPollTimer = setInterval(fetchNowPlaying, 30000);
}

function stopSpotifyPolling() {
  clearInterval(spotifyPollTimer);
  spotifyPollTimer = null;
}

// ----- RTDB track sharing -----

function updateSpotifyTrackInRoom(track) {
  if (!currentRoomId || !localUid) return;
  const ref = rtdb.ref(`rooms/${currentRoomId}/spotifyTracks/${localUid}`);
  if (track) {
    ref.set(track);
    ref.onDisconnect().remove();
  } else {
    ref.remove();
  }
}

function clearSpotifyTrackFromRoom() {
  if (!currentRoomId || !localUid) return;
  rtdb.ref(`rooms/${currentRoomId}/spotifyTracks/${localUid}`).remove();
}

// ----- Carousel -----

function listenSpotifyTracks() {
  stopListeningSpotifyTracks();
  if (!currentRoomId) return;
  spotifyTracksRef = rtdb.ref(`rooms/${currentRoomId}/spotifyTracks`);
  spotifyTracksRef.on('value', snap => {
    spotifyTracksData = snap.val() || {};
    renderNowPlayingCarousel();
  });
}

function stopListeningSpotifyTracks() {
  if (spotifyTracksRef) { spotifyTracksRef.off('value'); spotifyTracksRef = null; }
  spotifyTracksData = {};
  renderNowPlayingCarousel();
}

function renderNowPlayingCarousel() {
  const container = document.getElementById('now-playing-carousel');
  if (!container) return;
  const entries = Object.entries(spotifyTracksData);
  if (!entries.length) { container.classList.add('hidden'); return; }
  container.classList.remove('hidden');
  container.innerHTML = entries.map(([uid, track]) => {
    const player    = roomState?.players?.find(p => p.id === uid);
    const name      = player ? esc(player.name) : '';
    const artHTML   = track.albumArt
      ? `<img class="now-playing-art" src="${esc(track.albumArt)}" alt="" loading="lazy">`
      : `<div class="now-playing-art-placeholder">♪</div>`;
    const sourceLogo = track.source === 'lastfm'
      ? `<svg class="now-playing-service-logo" viewBox="0 0 24 24" width="11" height="11" fill="#d51007"><path d="M10.584 17.21l-.88-2.392s-1.43 1.594-3.573 1.594c-1.897 0-3.244-1.649-3.244-4.288 0-3.382 1.704-4.591 3.381-4.591 2.42 0 3.189 1.567 3.849 3.574l.88 2.749c.88 2.666 2.529 4.81 7.285 4.81 3.409 0 5.718-1.044 5.718-3.793 0-2.227-1.265-3.381-3.63-3.931l-1.758-.385c-1.21-.275-1.567-.77-1.567-1.595 0-.934.742-1.484 1.952-1.484 1.32 0 2.034.495 2.144 1.677l2.749-.33c-.22-2.474-1.924-3.492-4.729-3.492-2.474 0-4.893.935-4.893 3.932 0 1.87.907 3.051 3.189 3.601l1.87.44c1.402.33 1.869.907 1.869 1.704 0 1.017-.99 1.43-2.86 1.43-2.776 0-3.93-1.457-4.59-3.464l-.907-2.75c-1.155-3.573-2.997-4.893-6.653-4.893C2.144 5.333 0 7.89 0 12.233c0 4.18 2.144 6.434 5.993 6.434 3.106 0 4.591-1.457 4.591-1.457z"/></svg>`
      : `<svg class="now-playing-service-logo" viewBox="0 0 24 24" width="10" height="10" fill="#1DB954"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>`;
    return `<div class="now-playing-item">
      ${artHTML}
      <div class="now-playing-text">
        <span class="now-playing-player">${name}</span>
        <span class="now-playing-title">${esc(track.title)}</span>
        <span class="now-playing-artist">${esc(track.artist)}</span>
      </div>
      ${sourceLogo}
    </div>`;
  }).join('');
}

// ----- Modal -----

function openSpotifyModal() {
  const card = document.getElementById('spotify-modal-card');
  if (!card) return;
  if (isSpotifyConnected()) {
    const raw   = spotifyTracksData[localUid];
    const track = raw?.source === 'lastfm' ? null : raw;
    const trackHTML = track
      ? `<div class="spotify-modal-track">
          ${track.albumArt ? `<img class="spotify-modal-art" src="${esc(track.albumArt)}" alt="">` : ''}
          <div style="min-width:0">
            <div class="spotify-modal-track-title">${esc(track.title)}</div>
            <div class="spotify-modal-track-artist">${esc(track.artist)}</div>
          </div>
        </div>`
      : `<p class="spotify-modal-desc">Sin reproducción activa ahora mismo.</p>`;
    card.innerHTML = `
      ${SPOTIFY_SVG_LARGE}
      <div class="spotify-modal-connected">● Conectado a Spotify</div>
      ${trackHTML}
      <div class="spotify-modal-btns">
        <button class="btn btn-ghost btn-sm" onclick="disconnectSpotify()">Desconectar</button>
        <button class="btn btn-primary btn-sm" onclick="closeSpotifyModal()">Cerrar</button>
      </div>`;
  } else {
    card.innerHTML = `
      ${SPOTIFY_SVG_LARGE}
      <h3 class="spotify-modal-title">Conectar Spotify</h3>
      <p class="spotify-modal-desc">Comparte lo que estás escuchando con los demás jugadores. Aparecerá en la barra superior.</p>
      <div class="spotify-modal-btns">
        <button class="btn spotify-connect-btn btn-sm" onclick="initiateSpotifyAuth()">Conectar cuenta</button>
        <button class="btn btn-ghost btn-sm" onclick="closeSpotifyModal()">Cancelar</button>
      </div>`;
  }
  document.getElementById('spotify-modal').classList.remove('hidden');
}

function closeSpotifyModal() {
  document.getElementById('spotify-modal')?.classList.add('hidden');
}

function spotifyModalBackdropClick(e) {
  if (e.target === document.getElementById('spotify-modal')) closeSpotifyModal();
}

function updateSpotifyButton() {
  const btn = document.getElementById('spotify-btn');
  if (!btn) return;
  btn.classList.toggle('spotify-active', isSpotifyConnected());
  btn.title = isSpotifyConnected() ? 'Spotify conectado' : 'Conectar Spotify';
}

function showSpotifyError(msg) {
  const card = document.getElementById('spotify-modal-card');
  if (!card) return;
  card.innerHTML = `
    ${SPOTIFY_SVG_LARGE}
    <h3 class="spotify-modal-title">Error de Spotify</h3>
    <p class="spotify-modal-desc" style="color:var(--color-danger,#e55)">${esc(msg)}</p>
    <div class="spotify-modal-btns">
      <button class="btn spotify-connect-btn btn-sm" onclick="initiateSpotifyAuth()">Reintentar</button>
      <button class="btn btn-ghost btn-sm" onclick="closeSpotifyModal()">Cerrar</button>
    </div>`;
  document.getElementById('spotify-modal').classList.remove('hidden');
}

// ============================================================
// LAST.FM INTEGRATION
// Polls user.getrecenttracks every 30s. Always shows the most recent track;
// uses @attr.nowplaying to distinguish "now playing" from "last played".
// Works with any service the user has connected to Last.fm (Spotify,
// Apple Music, Tidal, etc.) via scrobbling.
// ============================================================

const LASTFM_API_KEY  = '80b47bbd69a91cddc6d615d8078a86d2';
const LASTFM_API_BASE = 'https://ws.audioscrobbler.com/2.0/';
const LASTFM_SVG_SMALL = `<svg viewBox="0 0 24 24" width="12" height="12" fill="#d51007"><path d="M10.584 17.21l-.88-2.392s-1.43 1.594-3.573 1.594c-1.897 0-3.244-1.649-3.244-4.288 0-3.382 1.704-4.591 3.381-4.591 2.42 0 3.189 1.567 3.849 3.574l.88 2.749c.88 2.666 2.529 4.81 7.285 4.81 3.409 0 5.718-1.044 5.718-3.793 0-2.227-1.265-3.381-3.63-3.931l-1.758-.385c-1.21-.275-1.567-.77-1.567-1.595 0-.934.742-1.484 1.952-1.484 1.32 0 2.034.495 2.144 1.677l2.749-.33c-.22-2.474-1.924-3.492-4.729-3.492-2.474 0-4.893.935-4.893 3.932 0 1.87.907 3.051 3.189 3.601l1.87.44c1.402.33 1.869.907 1.869 1.704 0 1.017-.99 1.43-2.86 1.43-2.776 0-3.93-1.457-4.59-3.464l-.907-2.75c-1.155-3.573-2.997-4.893-6.653-4.893C2.144 5.333 0 7.89 0 12.233c0 4.18 2.144 6.434 5.993 6.434 3.106 0 4.591-1.457 4.591-1.457z"/></svg>`;
const LASTFM_SVG_LARGE = `<svg class="lastfm-modal-logo" viewBox="0 0 24 24" width="40" height="40" fill="#d51007"><path d="M10.584 17.21l-.88-2.392s-1.43 1.594-3.573 1.594c-1.897 0-3.244-1.649-3.244-4.288 0-3.382 1.704-4.591 3.381-4.591 2.42 0 3.189 1.567 3.849 3.574l.88 2.749c.88 2.666 2.529 4.81 7.285 4.81 3.409 0 5.718-1.044 5.718-3.793 0-2.227-1.265-3.381-3.63-3.931l-1.758-.385c-1.21-.275-1.567-.77-1.567-1.595 0-.934.742-1.484 1.952-1.484 1.32 0 2.034.495 2.144 1.677l2.749-.33c-.22-2.474-1.924-3.492-4.729-3.492-2.474 0-4.893.935-4.893 3.932 0 1.87.907 3.051 3.189 3.601l1.87.44c1.402.33 1.869.907 1.869 1.704 0 1.017-.99 1.43-2.86 1.43-2.776 0-3.93-1.457-4.59-3.464l-.907-2.75c-1.155-3.573-2.997-4.893-6.653-4.893C2.144 5.333 0 7.89 0 12.233c0 4.18 2.144 6.434 5.993 6.434 3.106 0 4.591-1.457 4.591-1.457z"/></svg>`;

let lastfmPollTimer = null;

function isLastfmConnected() {
  return !!localStorage.getItem('lastfm_username');
}

function disconnectLastfm() {
  stopLastfmPolling();
  clearSpotifyTrackFromRoom();
  localStorage.removeItem('lastfm_username');
  updateLastfmButton();
  closeLastfmModal();
}

async function connectLastfm() {
  const input    = document.getElementById('lastfm-username-input');
  const errEl    = document.getElementById('lastfm-input-error');
  const username = input?.value.trim();
  if (!username) return;
  if (errEl) errEl.textContent = '';
  try {
    const res  = await fetch(`${LASTFM_API_BASE}?method=user.getinfo&user=${encodeURIComponent(username)}&api_key=${LASTFM_API_KEY}&format=json`);
    const data = await res.json();
    if (data.error) {
      if (errEl) errEl.textContent = 'Usuario no encontrado en Last.fm.';
      return;
    }
    localStorage.setItem('lastfm_username', data.user.name);
    startLastfmPolling();
    updateLastfmButton();
    openLastfmModal();
  } catch (e) {
    if (errEl) errEl.textContent = 'Error de conexión. Intenta de nuevo.';
  }
}

async function fetchLastfmNowPlaying() {
  const username = localStorage.getItem('lastfm_username');
  if (!username) return;
  try {
    const res  = await fetch(`${LASTFM_API_BASE}?method=user.getrecenttracks&user=${encodeURIComponent(username)}&api_key=${LASTFM_API_KEY}&format=json&limit=1`);
    const data = await res.json();
    if (data.error) {
      if (data.error === 6) {
        localStorage.removeItem('lastfm_username');
        updateLastfmButton();
      }
      clearSpotifyTrackFromRoom();
      return;
    }
    const tracks = data.recenttracks?.track;
    const track  = Array.isArray(tracks) ? tracks[0] : tracks;
    if (track) {
      const img       = track.image?.find(i => i.size === 'medium')?.['#text'] || '';
      const isPlaying = track?.['@attr']?.nowplaying === 'true';
      updateSpotifyTrackInRoom({
        title:     track.name,
        artist:    track.artist['#text'],
        albumArt:  img.startsWith('http') ? img : null,
        source:    'lastfm',
        isPlaying,
      });
    } else {
      clearSpotifyTrackFromRoom();
    }
  } catch (e) {
    console.error('Last.fm fetch error:', e);
  }
}

function startLastfmPolling() {
  stopLastfmPolling();
  fetchLastfmNowPlaying();
  lastfmPollTimer = setInterval(fetchLastfmNowPlaying, 30000);
}

function stopLastfmPolling() {
  clearInterval(lastfmPollTimer);
  lastfmPollTimer = null;
}

function openLastfmModal() {
  const card = document.getElementById('lastfm-modal-card');
  if (!card) return;
  const username = localStorage.getItem('lastfm_username');
  if (username) {
    const raw   = spotifyTracksData[localUid];
    const track = raw?.source === 'lastfm' ? raw : null;
    const trackLabel = track?.isPlaying ? 'Escuchando ahora' : 'Última escuchada';
    const trackHTML = track
      ? `<div class="lastfm-modal-track">
          ${track.albumArt ? `<img class="lastfm-modal-art" src="${esc(track.albumArt)}" alt="">` : ''}
          <div style="min-width:0">
            <div class="lastfm-modal-track-label">${trackLabel}</div>
            <div class="lastfm-modal-track-title">${esc(track.title)}</div>
            <div class="lastfm-modal-track-artist">${esc(track.artist)}</div>
          </div>
        </div>`
      : `<p class="lastfm-modal-desc">Sin historial de Last.fm.</p>`;
    card.innerHTML = `
      ${LASTFM_SVG_LARGE}
      <div class="lastfm-modal-connected">● Conectado como ${esc(username)}</div>
      ${trackHTML}
      <div class="lastfm-modal-btns">
        <button class="btn btn-ghost btn-sm" onclick="disconnectLastfm()">Desconectar</button>
        <button class="btn btn-primary btn-sm" onclick="closeLastfmModal()">Cerrar</button>
      </div>`;
  } else {
    card.innerHTML = `
      ${LASTFM_SVG_LARGE}
      <h3 class="lastfm-modal-title">Conectar Last.fm</h3>
      <p class="lastfm-modal-desc">Introduce tu usuario de Last.fm para compartir lo que escuchas (funciona con Spotify, Apple Music, Tidal y más).</p>
      <input id="lastfm-username-input" class="lastfm-username-input" type="text" placeholder="Tu usuario de Last.fm" autocomplete="off" onkeydown="if(event.key==='Enter')connectLastfm()">
      <span id="lastfm-input-error" class="lastfm-input-error"></span>
      <div class="lastfm-modal-btns">
        <button class="btn lastfm-connect-btn btn-sm" onclick="connectLastfm()">Conectar</button>
        <button class="btn btn-ghost btn-sm" onclick="closeLastfmModal()">Cancelar</button>
      </div>`;
    setTimeout(() => document.getElementById('lastfm-username-input')?.focus(), 50);
  }
  document.getElementById('lastfm-modal').classList.remove('hidden');
}

function closeLastfmModal() {
  document.getElementById('lastfm-modal')?.classList.add('hidden');
}

function lastfmModalBackdropClick(e) {
  if (e.target === document.getElementById('lastfm-modal')) closeLastfmModal();
}

function updateLastfmButton() {
  const btn = document.getElementById('lastfm-btn');
  if (!btn) return;
  btn.classList.toggle('lastfm-active', isLastfmConnected());
  btn.title = isLastfmConnected()
    ? `Last.fm: ${localStorage.getItem('lastfm_username')}`
    : 'Conectar Last.fm';
}

function notify(title, body) {
  if (!notifEnabled || Notification.permission !== 'granted') return;
  if (!document.hidden && document.hasFocus()) return;
  playNotifSound();
  try { new Notification(title, { body, tag: 'virusgame' }); } catch (_) {}
}

// ============================================================
// DECK — 68 cards: 21 organs, 17 viruses, 20 medicines, 10 treatments
// ============================================================

function createDeck() {
  const deck = [];
  let n = 0;
  const add = (type, color, kind) => deck.push(kind
    ? { id: 'c' + (n++), type, kind }
    : { id: 'c' + (n++), type, color });
  for (const color of COLORS) {
    for (let i = 0; i < 5; i++) add('organ', color);
    for (let i = 0; i < 4; i++) add('virus', color);
    for (let i = 0; i < 4; i++) add('medicine', color);
  }
  add('organ', 'multi');
  add('virus', 'multi');
  for (let i = 0; i < 4; i++) add('medicine', 'multi');
  for (const [kind, t] of Object.entries(TREATMENTS)) {
    for (let i = 0; i < t.count; i++) add('treatment', null, kind);
  }
  return deck;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Draws cards into `hand` until it holds `upTo` cards.
// When the draw pile runs out, the discard pile is shuffled back in.
// `g` is a mutable { drawPile, discardPile } object.
function refillHand(g, hand, upTo) {
  while (hand.length < upTo) {
    if (!g.drawPile.length) {
      if (!g.discardPile.length) break;
      g.drawPile = shuffle(g.discardPile);
      g.discardPile = [];
    }
    hand.push(g.drawPile.pop());
  }
  return hand;
}

// ============================================================
// RULE HELPERS
// ============================================================

// A virus/medicine fits an organ when the colours match; multicolour fits anything.
function colorMatches(cardColor, organColor) {
  return cardColor === 'multi' || organColor === 'multi' || cardColor === organColor;
}

function hasColor(body, color) {
  return (body || []).some(s => s.organ.color === color);
}

function isImmune(slot)   { return slot.medicines.length >= 2; }
function isInfected(slot) { return slot.viruses.length > 0; }

function slotState(slot) {
  if (isImmune(slot)) return 'immune';
  if (slot.medicines.length === 1) return 'vaccinated';
  if (isInfected(slot)) return 'infected';
  return 'free';
}

function healthyCount(body) {
  return (body || []).filter(s => !isInfected(s)).length;
}

// Win: four healthy organs of different colours (the rules never allow repeats,
// so any four healthy organs — the multicolour one included — will do).
function hasWon(body) {
  return healthyCount(body) >= ORGANS_TO_WIN;
}

function playerName(state, pid) {
  return state.players.find(p => p.id === pid)?.name || '?';
}

function cardName(card) {
  if (!card) return '?';
  if (card.type === 'organ')    return ORGAN_NAME[card.color];
  if (card.type === 'virus')    return card.color === 'multi' ? 'Virus multicolor' : `Virus ${COLOR_NAME[card.color]}`;
  if (card.type === 'medicine') return card.color === 'multi' ? 'Medicina multicolor' : `Medicina ${COLOR_NAME[card.color]}`;
  return TREATMENTS[card.kind]?.name || '?';
}

// Short label printed at the bottom of a card
function cardShortName(card) {
  if (card.type === 'organ')     return card.color === 'multi' ? 'Comodín' : ORGAN_NAME[card.color];
  if (card.type === 'treatment') return TREATMENTS[card.kind]?.name || '?';
  return COLOR_NAME[card.color];
}

// "su Corazón" when it is the actor's own organ, "el Corazón de Ana" otherwise
function organRef(state, actorId, pid, organ) {
  const name = ORGAN_NAME[organ.color];
  return pid === actorId ? `su ${name}` : `el ${name} de ${playerName(state, pid)}`;
}

// Every legal place a contagion can send the actor's viruses: each infected organ
// passes its virus to a different free (no virus, no medicine) organ of another
// player with a matching colour. Uses bipartite matching to move as many as possible.
function contagionPlan(bodies, uid, playerIds) {
  const sources = (bodies[uid] || []).filter(s => s.viruses.length === 1);
  const targets = [];
  for (const pid of playerIds) {
    if (pid === uid) continue;
    for (const s of bodies[pid] || []) {
      if (!s.viruses.length && !s.medicines.length) targets.push({ pid, slot: s });
    }
  }
  const matchT = new Array(targets.length).fill(-1);
  const fits = (si, ti) => colorMatches(sources[si].viruses[0].color, targets[ti].slot.organ.color);
  function tryAssign(si, seen) {
    for (let ti = 0; ti < targets.length; ti++) {
      if (seen[ti] || !fits(si, ti)) continue;
      seen[ti] = true;
      if (matchT[ti] === -1 || tryAssign(matchT[ti], seen)) { matchT[ti] = si; return true; }
    }
    return false;
  }
  sources.forEach((_, si) => tryAssign(si, []));
  return matchT
    .map((si, ti) => si === -1 ? null : { fromOid: sources[si].organ.id, toPid: targets[ti].pid, toOid: targets[ti].slot.organ.id })
    .filter(Boolean);
}

// After a transplant both players must still have no repeated colours
function canSwapOrgans(bodyA, slotA, bodyB, slotB) {
  const cA = slotA.organ.color, cB = slotB.organ.color;
  if (cA === cB) return true;
  return !hasColor(bodyA, cB) && !hasColor(bodyB, cA);
}

// ============================================================
// LEGAL MOVES
//
// A move is a plain object:
//   { kind:'organ',      cid }
//   { kind:'virus',      cid, pid, oid }       pid/oid = target player / organ card id
//   { kind:'medicine',   cid, pid, oid }
//   { kind:'thief',      cid, pid, oid }
//   { kind:'transplant', cid, a:{pid,oid}, b:{pid,oid} }
//   { kind:'contagion',  cid }
//   { kind:'glove',      cid }
//   { kind:'error',      cid, pid }
//   { kind:'discard',    cids:[...] }
//   { kind:'pass' }                            only when the hand is empty (after a latex glove)
// ============================================================

function legalMoves(state, uid) {
  const hand   = state.hands?.[uid] || [];
  const bodies = state.bodies || {};
  const mine   = bodies[uid] || [];
  const allIds = state.players.map(p => p.id);
  const others = allIds.filter(id => id !== uid);
  const moves  = [];

  if (!hand.length) return [{ kind: 'pass' }];

  for (const card of hand) {
    const cid = card.id;
    if (card.type === 'organ') {
      if (!hasColor(mine, card.color)) moves.push({ kind: 'organ', cid });

    } else if (card.type === 'virus') {
      for (const pid of others) {
        for (const s of bodies[pid] || []) {
          if (!isImmune(s) && colorMatches(card.color, s.organ.color)) {
            moves.push({ kind: 'virus', cid, pid, oid: s.organ.id });
          }
        }
      }

    } else if (card.type === 'medicine') {
      for (const s of mine) {
        if (!isImmune(s) && colorMatches(card.color, s.organ.color)) {
          moves.push({ kind: 'medicine', cid, pid: uid, oid: s.organ.id });
        }
      }

    } else if (card.kind === 'thief') {
      for (const pid of others) {
        for (const s of bodies[pid] || []) {
          if (!isImmune(s) && !hasColor(mine, s.organ.color)) {
            moves.push({ kind: 'thief', cid, pid, oid: s.organ.id });
          }
        }
      }

    } else if (card.kind === 'transplant') {
      for (let i = 0; i < allIds.length; i++) {
        for (let j = i + 1; j < allIds.length; j++) {
          const pa = allIds[i], pb = allIds[j];
          const ba = bodies[pa] || [], bb = bodies[pb] || [];
          for (const sa of ba) {
            if (isImmune(sa)) continue;
            for (const sb of bb) {
              if (isImmune(sb)) continue;
              if (canSwapOrgans(ba, sa, bb, sb)) {
                moves.push({ kind: 'transplant', cid, a: { pid: pa, oid: sa.organ.id }, b: { pid: pb, oid: sb.organ.id } });
              }
            }
          }
        }
      }

    } else if (card.kind === 'contagion') {
      if (contagionPlan(bodies, uid, allIds).length) moves.push({ kind: 'contagion', cid });

    } else if (card.kind === 'glove') {
      if (others.length) moves.push({ kind: 'glove', cid });

    } else if (card.kind === 'error') {
      for (const pid of others) moves.push({ kind: 'error', cid, pid });
    }
  }
  return moves;
}

// Stable text key for comparing moves (transplant pairs are order-independent)
function moveKey(m) {
  if (m.kind === 'transplant') {
    const ends = [`${m.a.pid}:${m.a.oid}`, `${m.b.pid}:${m.b.oid}`].sort();
    return `transplant|${m.cid}|${ends.join('|')}`;
  }
  if (m.kind === 'discard') return `discard|${[...m.cids].sort().join(',')}`;
  return [m.kind, m.cid || '', m.pid || '', m.oid || ''].join('|');
}

function isMoveLegal(state, uid, move) {
  const hand = state.hands?.[uid] || [];
  if (move.kind === 'discard') {
    const cids = move.cids || [];
    return cids.length >= 1 && cids.length <= HAND_SIZE &&
      new Set(cids).size === cids.length &&
      cids.every(cid => hand.some(c => c.id === cid));
  }
  const key = moveKey(move);
  return legalMoves(state, uid).some(m => moveKey(m) === key);
}

// ============================================================
// APPLYING A MOVE
// ============================================================

const clone = obj => JSON.parse(JSON.stringify(obj));

// Applies the card effect of `move` to the mutable game `g`
// ({ hands, bodies, drawPile, discardPile }). Returns the log line and the organs
// it touched (used to flash them on screen). Shared by real moves and bot look-ahead.
function applyEffect(state, g, uid, move) {
  const name = playerName(state, uid);
  const hand = g.hands[uid] || (g.hands[uid] = []);
  const allIds = state.players.map(p => p.id);
  const touched = [];
  let msg = '';

  const takeFromHand = cid => {
    const i = hand.findIndex(c => c.id === cid);
    return i >= 0 ? hand.splice(i, 1)[0] : null;
  };
  const bodyOf   = pid => g.bodies[pid] || (g.bodies[pid] = []);
  const findSlot = (pid, oid) => bodyOf(pid).find(s => s.organ.id === oid);
  const removeSlot = (pid, oid) => {
    const b = bodyOf(pid);
    const i = b.findIndex(s => s.organ.id === oid);
    return i >= 0 ? b.splice(i, 1)[0] : null;
  };
  const discard = (...cards) => g.discardPile.push(...cards.filter(Boolean));

  switch (move.kind) {
    case 'organ': {
      const card = takeFromHand(move.cid);
      bodyOf(uid).push({ organ: card, viruses: [], medicines: [] });
      touched.push(`${uid}|${card.id}`);
      msg = `🫀 ${name} colocó ${card.color === 'multi' ? 'un Órgano multicolor' : 'un ' + ORGAN_NAME[card.color]}.`;
      break;
    }
    case 'virus': {
      const card = takeFromHand(move.cid);
      const slot = findSlot(move.pid, move.oid);
      const ref  = organRef(state, uid, move.pid, slot.organ);
      if (slot.medicines.length === 1) {
        discard(slot.medicines.pop(), card);
        msg = `🦠 ${name} destruyó la vacuna de ${ref}.`;
      } else if (slot.viruses.length >= 1) {
        removeSlot(move.pid, move.oid);
        discard(slot.organ, ...slot.viruses, card);
        msg = `💀 ${name} extirpó ${ref}.`;
      } else {
        slot.viruses.push(card);
        msg = `🦠 ${name} infectó ${ref}.`;
      }
      touched.push(`${move.pid}|${move.oid}`);
      break;
    }
    case 'medicine': {
      const card = takeFromHand(move.cid);
      const slot = findSlot(uid, move.oid);
      const ref  = organRef(state, uid, uid, slot.organ);
      if (slot.viruses.length) {
        discard(slot.viruses.pop(), card);
        msg = `💊 ${name} curó ${ref}.`;
      } else if (!slot.medicines.length) {
        slot.medicines.push(card);
        msg = `💉 ${name} vacunó ${ref}.`;
      } else {
        slot.medicines.push(card);
        msg = `🛡️ ${name} inmunizó ${ref}.`;
      }
      touched.push(`${uid}|${move.oid}`);
      break;
    }
    case 'thief': {
      discard(takeFromHand(move.cid));
      const slot = removeSlot(move.pid, move.oid);
      const ref  = organRef(state, uid, move.pid, slot.organ);
      bodyOf(uid).push(slot);
      touched.push(`${uid}|${move.oid}`);
      msg = `🦹 ${name} robó ${ref}.`;
      break;
    }
    case 'transplant': {
      discard(takeFromHand(move.cid));
      const refA = organRef(state, uid, move.a.pid, findSlot(move.a.pid, move.a.oid).organ);
      const refB = organRef(state, uid, move.b.pid, findSlot(move.b.pid, move.b.oid).organ);
      const sa = removeSlot(move.a.pid, move.a.oid);
      const sb = removeSlot(move.b.pid, move.b.oid);
      bodyOf(move.a.pid).push(sb);
      bodyOf(move.b.pid).push(sa);
      touched.push(`${move.a.pid}|${move.b.oid}`, `${move.b.pid}|${move.a.oid}`);
      msg = `🔄 ${name} hizo un trasplante: ${refA} ⇄ ${refB}.`;
      break;
    }
    case 'contagion': {
      discard(takeFromHand(move.cid));
      const plan = contagionPlan(g.bodies, uid, allIds);
      const victims = [];
      for (const step of plan) {
        const from = findSlot(uid, step.fromOid);
        const to   = findSlot(step.toPid, step.toOid);
        to.viruses.push(from.viruses.pop());
        touched.push(`${uid}|${step.fromOid}`, `${step.toPid}|${step.toOid}`);
        const vn = playerName(state, step.toPid);
        if (!victims.includes(vn)) victims.push(vn);
      }
      msg = `🤧 ${name} usó Contagio: pasó ${plan.length} virus a ${victims.join(', ') || 'nadie'}.`;
      break;
    }
    case 'glove': {
      discard(takeFromHand(move.cid));
      for (const pid of allIds) {
        if (pid === uid) continue;
        discard(...(g.hands[pid] || []));
        g.hands[pid] = [];
      }
      msg = `🧤 ${name} usó Guante de látex: todos los demás tiran su mano y pierden su próximo turno.`;
      break;
    }
    case 'error': {
      discard(takeFromHand(move.cid));
      const mine = bodyOf(uid), theirs = bodyOf(move.pid);
      g.bodies[uid] = theirs;
      g.bodies[move.pid] = mine;
      for (const s of g.bodies[uid])      touched.push(`${uid}|${s.organ.id}`);
      for (const s of g.bodies[move.pid]) touched.push(`${move.pid}|${s.organ.id}`);
      msg = `🔀 ${name} usó Error médico: cambió su cuerpo con el de ${playerName(state, move.pid)}.`;
      break;
    }
    case 'discard': {
      for (const cid of move.cids) discard(takeFromHand(cid));
      msg = `🗑️ ${name} descartó ${move.cids.length} carta${move.cids.length > 1 ? 's' : ''}.`;
      break;
    }
    case 'pass': {
      msg = `🧤 ${name} no tenía cartas y pierde el turno.`;
      break;
    }
  }
  return { msg, touched };
}

// Builds the full Firestore update for `uid` playing `move`:
// apply the effect, refill the hand to 3, check for a winner, pass the turn.
function buildMoveUpdate(state, uid, move) {
  const g = {
    hands:       clone(state.hands || {}),
    bodies:      clone(state.bodies || {}),
    drawPile:    [...(state.drawPile || [])],
    discardPile: [...(state.discardPile || [])]
  };
  const playedCard = move.cid ? (state.hands?.[uid] || []).find(c => c.id === move.cid) : null;
  const { msg, touched } = applyEffect(state, g, uid, move);

  refillHand(g, g.hands[uid], HAND_SIZE);

  const players = state.players.map(p => ({ ...p, cardCount: (g.hands[p.id] || []).length }));
  let log = addLog(state.log, msg);

  const update = {
    hands:       g.hands,
    bodies:      g.bodies,
    drawPile:    g.drawPile,
    discardPile: g.discardPile,
    players,
    lastAction: {
      id:      Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      by:      uid,
      kind:    move.kind,
      card:    playedCard || null,
      touched,
      text:    msg
    },
    lastActivity: firebase.firestore.FieldValue.serverTimestamp()
  };

  // Winner check — the player who moved gets priority, then everyone in turn order
  // (a transplant or medical error can complete someone else's body).
  const n = players.length;
  const start = state.players.findIndex(p => p.id === uid);
  let winner = null;
  for (let k = 0; k < n; k++) {
    const p = players[(start + k) % n];
    if (hasWon(g.bodies[p.id])) { winner = p; break; }
  }

  if (winner) {
    log = addLog(log, `🏆 ¡${winner.name} completó un cuerpo sano y gana la partida!`);
    Object.assign(update, {
      status: 'ended',
      winner: winner.id,
      winnerName: winner.name,
      winnerReason: 'body'
    });
  } else {
    update.currentPlayerIndex = (state.currentPlayerIndex + 1) % n;
  }
  update.log = log;
  return update;
}

// Runs a move for `actorId` (the local player or, on the host, a bot) inside a
// transaction so it is checked against the freshest state before it is written.
async function runMove(actorId, move) {
  const ref = db.collection(ROOMS).doc(currentRoomId);
  return db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists) return false;
    const state = snap.data();
    if (state.status !== 'playing') return false;
    if (state.players[state.currentPlayerIndex]?.id !== actorId) return false;
    if (!isMoveLegal(state, actorId, move)) return false;
    tx.update(ref, buildMoveUpdate(state, actorId, move));
    return true;
  });
}

// ============================================================
// STANDINGS / WINNER BY VOTE
// ============================================================

function computeStandings(state) {
  return (state.players || [])
    .map(p => {
      const body = state.bodies?.[p.id] || [];
      return {
        id: p.id,
        name: p.name,
        healthy: healthyCount(body),
        organs: body.length,
        infected: body.filter(isInfected).length
      };
    })
    .sort((a, b) => b.healthy - a.healthy || b.organs - a.organs || a.infected - b.infected);
}

function determineWinner(state) {
  const s = computeStandings(state)[0];
  if (!s) return { winner: null, winnerName: null, winCondition: 'healthy' };
  return { winner: s.id, winnerName: s.name, winCondition: 'healthy' };
}

// ============================================================
// NOTIFICATIONS (game-specific triggers)
// ============================================================

function checkNotifications(state) {
  const prev = prevNotifState;
  prevNotifState = {
    status: state.status,
    currentPlayerIndex: state.currentPlayerIndex,
    lastActionId: state.lastAction?.id || null
  };
  if (!prev) return;

  if (prev.status === 'lobby' && state.status === 'playing') {
    const first = state.players[state.currentPlayerIndex];
    notify('¡La partida comenzó!', `${first?.name || '?'} va primero.`);
    return;
  }
  if (prev.status !== 'ended' && state.status === 'ended') {
    const won = state.winner === localUid;
    notify(won ? '🏆 ¡Ganaste!' : '🦠 Partida terminada',
           won ? '¡Felicidades!' : `Ganó ${state.winnerName || '?'}`);
    return;
  }
  if (state.status !== 'playing') return;

  // Someone else's card hit one of my organs
  const la = state.lastAction;
  if (la && la.id !== prev.lastActionId && la.by !== localUid &&
      (la.touched || []).some(k => k.startsWith(localUid + '|'))) {
    notify('🦠 ¡Te atacaron!', la.text);
    return;
  }
  if (prev.currentPlayerIndex !== state.currentPlayerIndex &&
      state.players[state.currentPlayerIndex]?.id === localUid) {
    notify('¡Es tu turno!', 'Juega una carta o descarta.');
  }
}

// ============================================================
// RENDER HELPERS — cards and bodies
// ============================================================

function iconSVG(type, color, cls = '') {
  const fill = color === 'multi' ? 'url(#vg-rainbow)' : COLOR_HEX[color];
  let inner;
  if (type === 'organ') {
    inner = color === 'multi'
      // multicolour organ: the four organs in a 2×2 grid
      ? COLORS.map((c, i) =>
          `<g transform="translate(${(i % 2) * 24} ${Math.floor(i / 2) * 24}) scale(.5)" fill="${COLOR_HEX[c]}">${ORGAN_PATHS[c]}</g>`
        ).join('')
      : `<g fill="${fill}">${ORGAN_PATHS[color]}</g>`;
  } else if (type === 'virus') {
    inner = `<g fill="${fill}" stroke="${fill}">${VIRUS_PATH}</g>`;
  } else {
    inner = `<g fill="${fill}" stroke="${fill}">${MEDICINE_PATH}</g>`;
  }
  return `<svg class="vicon ${cls}" viewBox="0 0 48 48" aria-hidden="true">${inner}</svg>`;
}

function cardHTML(card, extraCls = '', attrs = '') {
  if (!card) return '';
  const t = card.type;
  const art = t === 'treatment'
    ? `<span class="vc-emoji">${TREATMENTS[card.kind]?.icon || '?'}</span>`
    : iconSVG(t, card.color);
  const colorCls = t === 'treatment' ? 'c-none' : `c-${card.color}`;
  return `<div class="vcard vc-${t} ${colorCls} ${extraCls}" ${attrs} title="${esc(cardName(card))}">
    <span class="vc-type">${TYPE_LABEL[t]}</span>
    <span class="vc-art">${art}</span>
    <span class="vc-name">${esc(cardShortName(card))}</span>
  </div>`;
}

// Draws one player's body: a slot per colour (empty ones are faint placeholders),
// plus the multicolour organ when they have it.
//   opts.targets — Set of 'pid|oid' keys that can be clicked right now
//   opts.picked  — 'pid|oid' already chosen (first organ of a transplant)
function bodyHTML(state, pid, opts = {}) {
  const body = state.bodies?.[pid] || [];
  return BODY_ORDER.map(color => {
    const slot = body.find(s => s.organ.color === color);
    if (!slot) {
      return color === 'multi' ? '' : `<div class="organ-slot empty c-${color}">${iconSVG('organ', color)}</div>`;
    }
    const key = `${pid}|${slot.organ.id}`;
    const st = slotState(slot);
    const isTarget = opts.targets?.has(key);
    const isPicked = opts.picked === key;
    const flash = flashKeys.has(key) && Date.now() < flashUntil;
    const tokens = slot.viruses.map(v => iconSVG('virus', v.color, 'tok')).join('')
                 + slot.medicines.map(m => iconSVG('medicine', m.color, 'tok')).join('');
    const label = `${ORGAN_NAME[color]}${st === 'immune' ? ' (inmune)' : st === 'vaccinated' ? ' (vacunado)' : st === 'infected' ? ' (infectado)' : ''}`;
    return `<div class="organ-slot c-${color} st-${st}${isTarget ? ' targetable' : ''}${isPicked ? ' picked' : ''}${flash ? ' flash' : ''}"
      title="${esc(label)}"${isTarget ? ` onclick="event.stopPropagation();handleSlotClick('${esc(pid)}','${esc(slot.organ.id)}')"` : ''}>
      ${iconSVG('organ', color)}
      ${tokens ? `<span class="slot-tokens">${tokens}</span>` : ''}
      ${st === 'immune' ? '<span class="slot-badge">🔒</span>' : ''}
    </div>`;
  }).join('');
}

// ============================================================
// LOCAL SELECTION STATE (never stored in Firestore)
// ============================================================

let selCid      = null;   // id of the hand card the player picked
let selFirst    = null;   // transplant: first organ picked, as 'pid|oid'
let discardMode = false;  // choosing cards to throw away
let discardSel  = [];     // card ids chosen for discarding
let moveInFlight = false;
let flashKeys   = new Set(); // organs touched by the latest action
let flashUntil  = 0;
let lastFlashId = null;

function clearSelection() {
  selCid = null;
  selFirst = null;
  discardMode = false;
  discardSel = [];
}

// Drops a stale selection (turn passed, card no longer in hand…)
function syncSelection(state) {
  const myHand = state.hands?.[localUid] || [];
  if (!isMyTurn(state)) { clearSelection(); return; }
  if (selCid && !myHand.some(c => c.id === selCid)) { selCid = null; selFirst = null; }
  discardSel = discardSel.filter(cid => myHand.some(c => c.id === cid));
}

// Moves for the selected card, or [] when nothing is selected
function selectedMoves(state) {
  if (!selCid || !isMyTurn(state)) return [];
  return legalMoves(state, localUid).filter(m => m.cid === selCid);
}

// Which organs / players can be clicked for the current selection
function currentTargets(state) {
  const slots = new Set(), players = new Set();
  const moves = selectedMoves(state);
  for (const m of moves) {
    if (m.kind === 'virus' || m.kind === 'medicine' || m.kind === 'thief') {
      slots.add(`${m.pid}|${m.oid}`);
    } else if (m.kind === 'transplant') {
      const a = `${m.a.pid}|${m.a.oid}`, b = `${m.b.pid}|${m.b.oid}`;
      if (!selFirst) { slots.add(a); slots.add(b); }
      else if (selFirst === a) slots.add(b);
      else if (selFirst === b) slots.add(a);
    } else if (m.kind === 'error') {
      players.add(m.pid);
    }
  }
  return { slots, players };
}

// ============================================================
// GAME RENDER
// ============================================================

function renderGame(state) {
  syncSelection(state);

  // Flash the organs the latest action touched (once per action)
  const la = state.lastAction;
  if (la && la.id !== lastFlashId) {
    lastFlashId = la.id;
    flashKeys = new Set(la.touched || []);
    flashUntil = Date.now() + 1800;
  }

  const targets = currentTargets(state);
  renderOpponents(state, targets);
  renderPiles(state);
  renderStatus(state);
  renderTurnActions(state);
  renderMyBody(state, targets);
  renderHand(state);
  renderLog(state);
  renderEndVoteStatus(state);
  renderChatPanel(state);
  renderSpeechBubbles(state);
}

function renderOpponents(state, targets) {
  const row = document.getElementById('opponents-row');
  // Opponents listed in turn order, starting after me
  const n = state.players.length;
  const myIdx = state.players.findIndex(p => p.id === localUid);
  const others = [];
  for (let k = 1; k <= n; k++) {
    const p = state.players[((myIdx < 0 ? -1 : myIdx) + k + n) % n];
    if (p && p.id !== localUid && !others.includes(p)) others.push(p);
  }

  row.innerHTML = others.map(p => {
    const isCurrent = state.players[state.currentPlayerIndex]?.id === p.id;
    const isTarget = targets.players.has(p.id);
    const hasVoice = !!peerConns[p.id];
    const backs = Array(Math.min(p.cardCount || 0, HAND_SIZE)).fill('<span class="mini-back"></span>').join('');
    const healthy = Math.min(healthyCount(state.bodies?.[p.id]), ORGANS_TO_WIN);
    return `<div class="opponent ${isCurrent ? 'active-player' : ''} ${p.disconnected ? 'player-disconnected' : ''}
                ${speakingStates[p.id] ? 'voice-speaking' : ''} ${isTarget ? 'targetable-player' : ''}"
                data-uid="${esc(p.id)}"${isTarget ? ` onclick="handlePlayerClick('${esc(p.id)}')"` : ''}>
      <div class="opp-head">
        <span class="opponent-name">${esc(p.name)}</span>
        ${hasVoice ? '<span class="voice-mic-icon">🎤</span>' : ''}
        ${p.disconnected ? '<span class="dc-badge">desconectado</span>' : ''}
      </div>
      <div class="body-row mini">${bodyHTML(state, p.id, { targets: targets.slots, picked: selFirst })}</div>
      <div class="opp-foot">
        <span class="opp-backs">${backs || '<span class="opp-nocards">sin cartas</span>'}</span>
        <span class="opp-health">${healthy}/${ORGANS_TO_WIN} ❤</span>
      </div>
    </div>`;
  }).join('');
}

function renderPiles(state) {
  document.getElementById('draw-count').textContent = `Mazo · ${(state.drawPile || []).length}`;
  const top = (state.discardPile || []).at(-1);
  document.getElementById('discard-top').innerHTML = top
    ? cardHTML(top, 'pile-card')
    : '<div class="vcard-empty">Vacío</div>';
}

function renderStatus(state) {
  const el = document.getElementById('game-status');
  const current = state.players[state.currentPlayerIndex];
  const myTurn = isMyTurn(state);
  el.classList.toggle('my-turn', myTurn);
  el.classList.toggle('other-turn', !myTurn);

  if (!myTurn) {
    el.textContent = `Turno de ${current?.name || '?'}`;
    return;
  }
  const myHand = state.hands?.[localUid] || [];
  if (!myHand.length) { el.textContent = '🧤 Te quedaste sin cartas: pierdes este turno.'; return; }
  if (discardMode)    { el.textContent = '🗑️ Elige de 1 a 3 cartas para descartar.'; return; }

  const card = myHand.find(c => c.id === selCid);
  if (!card) { el.textContent = '✨ ¡Tu turno! Juega una carta o descarta.'; return; }
  const kind = card.type === 'treatment' ? card.kind : card.type;
  el.textContent = {
    virus:      '🦠 Elige un órgano rival para infectar.',
    medicine:   '💊 Elige uno de tus órganos.',
    thief:      '🦹 Elige el órgano que quieres robar.',
    transplant: selFirst ? '🔄 Ahora elige el segundo órgano.' : '🔄 Elige el primer órgano del trasplante.',
    error:      '🔀 Elige con quién cambiar tu cuerpo.'
  }[kind] || '✨ ¡Tu turno!';
}

function renderTurnActions(state) {
  const el = document.getElementById('turn-actions');
  if (!isMyTurn(state)) { el.innerHTML = ''; return; }
  const myHand = state.hands?.[localUid] || [];
  if (!myHand.length) {
    el.innerHTML = `<button class="btn btn-primary btn-sm" onclick="handlePassTurn()">Robar 3 cartas</button>`;
  } else if (discardMode) {
    el.innerHTML = `
      <button class="btn btn-danger btn-sm" onclick="confirmDiscard()" ${discardSel.length ? '' : 'disabled'}>Descartar ${discardSel.length || ''}</button>
      <button class="btn btn-ghost btn-sm" onclick="cancelSelection()">Cancelar</button>`;
  } else if (selCid) {
    el.innerHTML = `<button class="btn btn-ghost btn-sm" onclick="cancelSelection()">Cancelar</button>`;
  } else {
    el.innerHTML = `<button class="btn btn-secondary btn-sm" onclick="startDiscard()">🗑️ Descartar cartas</button>`;
  }
}

function renderMyBody(state, targets) {
  const body = state.bodies?.[localUid] || [];
  document.getElementById('my-body').innerHTML = bodyHTML(state, localUid, { targets: targets.slots, picked: selFirst });
  document.getElementById('my-health').textContent =
    `${Math.min(healthyCount(body), ORGANS_TO_WIN)}/${ORGANS_TO_WIN} órganos sanos`;
}

function renderHand(state) {
  const handEl = document.getElementById('player-hand');
  const myHand = state.hands?.[localUid] || [];
  const myTurn = isMyTurn(state);
  const moves  = myTurn ? legalMoves(state, localUid) : [];

  handEl.innerHTML = myHand.map(card => {
    const playable = moves.some(m => m.cid === card.id);
    const cls = [
      myTurn ? 'clickable' : '',
      myTurn && !discardMode && !playable ? 'no-move' : '',
      selCid === card.id ? 'selected' : '',
      discardSel.includes(card.id) ? 'discard-pick' : ''
    ].join(' ');
    const hint = myTurn && !discardMode && !playable ? '<span class="vc-hint">sin jugada</span>' : '';
    return `<div class="hand-slot">${cardHTML(card, cls, myTurn ? `onclick="handleCardClick('${esc(card.id)}')"` : '')}${hint}</div>`;
  }).join('') || '<p class="muted hand-empty">Sin cartas</p>';

  document.getElementById('hand-label').textContent =
    myTurn ? 'Tu mano — toca una carta' : `Tu mano (${myHand.length})`;
  handEl.closest('.hand-area').classList.toggle('my-turn', myTurn);

  // Turn order bar: previous / current / next
  const toiEl = document.getElementById('turn-order-info');
  const n = state.players.length;
  if (n >= 2) {
    const cur = state.currentPlayerIndex;
    const prevName = esc(state.players[(cur - 1 + n) % n]?.name || '—');
    const nextName = esc(state.players[(cur + 1) % n]?.name || '—');
    const center = myTurn
      ? `<span class="toi-label" style="color:rgba(255,255,255,.3)">tu turno</span>`
      : `<span class="toi-current">${esc(state.players[cur]?.name || '—')}</span>`;
    toiEl.innerHTML =
      `<span class="toi-item"><span class="toi-arrow">←</span><span class="toi-label toi-prev-label">anterior</span><span class="toi-name toi-prev-name">${prevName}</span></span>` +
      center +
      `<span class="toi-item"><span class="toi-name toi-next-name">${nextName}</span><span class="toi-label toi-next-label">siguiente</span><span class="toi-arrow">→</span></span>`;
    toiEl.classList.remove('hidden');
  } else {
    toiEl.classList.add('hidden');
  }
}

function renderLog(state) {
  const el = document.getElementById('game-log');
  el.innerHTML = [...(state.log || [])].reverse()
    .map(msg => {
      const cls = /extirpó|infectó|destruyó la vacuna|Contagio/.test(msg) ? ' log-attack'
                : /curó|vacunó|inmunizó/.test(msg)                      ? ' log-heal'
                : /robó|trasplante|Error médico|Guante/.test(msg)        ? ' log-swap'
                : /gana/.test(msg)                                       ? ' log-win'
                : '';
      return `<div class="log-entry${cls}">${colorizeLog(msg)}</div>`;
    })
    .join('');
  el.scrollTop = 0;
}

// ============================================================
// PLAYER INPUT
// ============================================================

async function handleCardClick(cid) {
  const state = roomState;
  if (!state || !isMyTurn(state) || moveInFlight) return;

  if (discardMode) {
    discardSel = discardSel.includes(cid) ? discardSel.filter(x => x !== cid) : [...discardSel, cid];
    renderGame(state);
    return;
  }
  if (selCid === cid) { cancelSelection(); return; }

  const card  = (state.hands?.[localUid] || []).find(c => c.id === cid);
  const moves = legalMoves(state, localUid).filter(m => m.cid === cid);
  if (!card) return;
  if (!moves.length) {
    showVoiceToast(`${cardName(card)}: no hay dónde jugarla ahora. Puedes descartarla.`);
    return;
  }

  const kind = card.type === 'treatment' ? card.kind : card.type;
  if (kind === 'organ') { submitMove(moves[0]); return; }

  if (kind === 'glove' || kind === 'contagion') {
    selCid = cid;
    renderGame(state);
    const t = TREATMENTS[kind];
    const ok = await showDrawConfirm('white', t.icon, `¿Usar ${t.name}?`, t.desc, 'Usar', 'Cancelar');
    if (ok) submitMove(moves[0]);
    else cancelSelection();
    return;
  }

  // Cards that need a target: highlight them and wait for a click
  selCid = cid;
  selFirst = null;
  renderGame(state);
}

async function handleSlotClick(pid, oid) {
  const state = roomState;
  if (!state || !selCid || moveInFlight) return;
  const key = `${pid}|${oid}`;
  const moves = selectedMoves(state);

  const direct = moves.find(m => m.pid === pid && m.oid === oid &&
    (m.kind === 'virus' || m.kind === 'medicine' || m.kind === 'thief'));
  if (direct) { submitMove(direct); return; }

  // Transplant: first click picks one organ, second click picks the other
  if (moves.some(m => m.kind === 'transplant')) {
    if (!selFirst || selFirst === key) {
      selFirst = selFirst === key ? null : key;
      renderGame(state);
      return;
    }
    const m = moves.find(m => {
      const a = `${m.a.pid}|${m.a.oid}`, b = `${m.b.pid}|${m.b.oid}`;
      return (a === selFirst && b === key) || (b === selFirst && a === key);
    });
    if (m) submitMove(m);
  }
}

async function handlePlayerClick(pid) {
  const state = roomState;
  if (!state || !selCid || moveInFlight) return;
  const m = selectedMoves(state).find(m => m.kind === 'error' && m.pid === pid);
  if (!m) return;
  const ok = await showDrawConfirm('red', '🔀', '¿Usar Error médico?',
    `Cambiarás todo tu cuerpo con el de ${playerName(state, pid)}.`, 'Cambiar', 'Cancelar');
  if (ok) submitMove(m);
}

function startDiscard() {
  clearSelection();
  discardMode = true;
  if (roomState) renderGame(roomState);
}

function cancelSelection() {
  clearSelection();
  if (roomState) renderGame(roomState);
}

function confirmDiscard() {
  if (!discardSel.length) return;
  submitMove({ kind: 'discard', cids: [...discardSel] });
}

function handlePassTurn() {
  submitMove({ kind: 'pass' });
}

async function submitMove(move) {
  if (moveInFlight) return;
  moveInFlight = true;
  clearSelection();
  try {
    const ok = await runMove(localUid, move);
    if (!ok) showVoiceToast('Esa jugada ya no es válida.');
  } catch (e) {
    console.error('submitMove failed:', e);
    showVoiceToast('No se pudo jugar. Intenta de nuevo.');
  } finally {
    moveInFlight = false;
    if (roomState?.status === 'playing') renderGame(roomState);
  }
}

// ============================================================
// RULES MODAL
// ============================================================

function openRules() {
  document.getElementById('rules-modal').classList.remove('hidden');
}
function closeRules() {
  document.getElementById('rules-modal').classList.add('hidden');
}
function rulesBackdropClick(e) {
  if (e.target === document.getElementById('rules-modal')) closeRules();
}

// ============================================================
// CONFIRM DIALOG (resolves true / false / 'third')
// ============================================================

function showDrawConfirm(accent, icon, title, message, okLabel, cancelLabel, thirdLabel) {
  return new Promise(resolve => {
    const card   = document.getElementById('draw-confirm-card');
    card.className = `draw-confirm-card accent-${accent}`;
    document.getElementById('draw-confirm-icon').textContent  = icon;
    document.getElementById('draw-confirm-title').textContent = title;
    document.getElementById('draw-confirm-msg').textContent   = message;
    const modal    = document.getElementById('draw-confirm-modal');
    const okBtn    = document.getElementById('draw-confirm-ok');
    const canBtn   = document.getElementById('draw-confirm-cancel');
    const thirdBtn = document.getElementById('draw-confirm-third');
    okBtn.textContent  = okLabel     || 'Aceptar';
    canBtn.textContent = cancelLabel || 'Cancelar';
    if (thirdLabel) {
      thirdBtn.textContent = thirdLabel;
      thirdBtn.classList.remove('hidden');
    } else {
      thirdBtn.classList.add('hidden');
    }
    modal.classList.remove('hidden');
    function done(result) {
      modal.classList.add('hidden');
      okBtn.removeEventListener('click', onOk);
      canBtn.removeEventListener('click', onCancel);
      thirdBtn.removeEventListener('click', onThird);
      resolve(result);
    }
    function onOk()     { done(true);    }
    function onCancel() { done(false);   }
    function onThird()  { done('third'); }
    okBtn.addEventListener('click', onOk);
    canBtn.addEventListener('click', onCancel);
    thirdBtn.addEventListener('click', onThird);
  });
}

// ============================================================
// BACK TO LOBBY
// ============================================================

async function backToLobby() {
  if (!roomState) return;
  await db.collection(ROOMS).doc(currentRoomId).update({
    status: 'lobby',
    winner: null,
    winnerName: null,
    winnerReason: null,
    endVotes: [],
    hands: {},
    bodies: {},
    drawPile: [],
    discardPile: [],
    lastAction: null,
    log: [],
    prevPlayerNames: roomState.players.map(p => p.name),
    readyVotes: [],
    players: roomState.players.map(p => ({ ...p, cardCount: 0 }))
  });
}

async function handleReadyVote() {
  if (!currentRoomId || !localUid) return;
  await db.collection(ROOMS).doc(currentRoomId).update({
    readyVotes: firebase.firestore.FieldValue.arrayUnion(localUid)
  });
}

// ============================================================
// LEAVE GAME
// ============================================================

async function handleLeaveLobby() {
  if (!roomState || !currentRoomId) { showScreen('landing'); return; }

  const state = roomState;
  const roomId = currentRoomId;
  const newPlayers = state.players.filter(p => p.id !== localUid);
  const newReadyVotes = (state.readyVotes || []).filter(id => id !== localUid);

  clearSpotifyTrackFromRoom();
  teardownPresence();
  if (roomUnsub) { roomUnsub(); roomUnsub = null; }
  sessionStorage.clear();
  currentRoomId = null;
  roomState = null;
  showScreen('landing');

  if (newPlayers.length === 0) {
    await db.collection(ROOMS).doc(roomId).delete().catch(() => {});
    return;
  }

  const update = {
    players: newPlayers,
    readyVotes: newReadyVotes,
    lastActivity: firebase.firestore.FieldValue.serverTimestamp()
  };
  if (state.hostId === localUid) update.hostId = (newPlayers.find(p => !p.isAI) || newPlayers[0]).id;

  await db.collection(ROOMS).doc(roomId).update(update).catch(() => {});
}

async function handleLeaveGame() {
  if (!roomState || !currentRoomId) { showScreen('landing'); return; }
  const ok = await showDrawConfirm(
    'red', '🚪',
    '¿Seguro que quieres salir?',
    'Si sales ahora no podrás ver la puntuación final ni serás incluido en el marcador. Si quieres terminar la partida y ver los resultados, vota para finalizar.',
    'Salir', 'Quedarme', 'Votar Terminar'
  );
  if (ok === 'third') { handleEndGameVote(); return; }
  if (!ok) return;

  const state = roomState;
  const roomId = currentRoomId;
  const myIdx = state.players.findIndex(p => p.id === localUid);
  const newPlayers = state.players.filter(p => p.id !== localUid);
  const newHands = { ...state.hands };
  delete newHands[localUid];
  // My hand and my organs (with their viruses/medicines) go to the discard pile
  const newBodies = { ...(state.bodies || {}) };
  const myBody = newBodies[localUid] || [];
  delete newBodies[localUid];
  const newDiscard = [
    ...(state.discardPile || []),
    ...(state.hands?.[localUid] || []),
    ...myBody.flatMap(s => [s.organ, ...s.viruses, ...s.medicines])
  ];
  const newEndVotes = (state.endVotes || []).filter(id => id !== localUid);
  const leaveLog = addLog(state.log, `${localName} salió de la partida.`);

  clearSpotifyTrackFromRoom();
  teardownPresence();
  if (roomUnsub) { roomUnsub(); roomUnsub = null; }
  sessionStorage.clear();
  currentRoomId = null;
  roomState = null;
  showScreen('landing');

  if (newPlayers.length === 0) return;

  if (newPlayers.length === 1) {
    const winner = newPlayers[0];
    await db.collection(ROOMS).doc(roomId).update({
      players: newPlayers,
      hands: newHands,
      bodies: newBodies,
      discardPile: newDiscard,
      status: 'ended',
      winner: winner.id,
      winnerName: winner.name,
      winnerReason: 'lastPlayer',
      endVotes: newEndVotes,
      log: addLog(leaveLog, `¡${winner.name} gana por ser el último jugador!`)
    });
    return;
  }

  // Adjust currentPlayerIndex: remove my slot and keep the "next to play" player correct.
  let newIdx = state.currentPlayerIndex;
  if (myIdx < newIdx) {
    newIdx = newIdx - 1;
  } else if (myIdx === newIdx) {
    newIdx = newIdx % newPlayers.length;
  }

  const update = {
    players: newPlayers,
    hands: newHands,
    bodies: newBodies,
    discardPile: newDiscard,
    currentPlayerIndex: newIdx,
    endVotes: newEndVotes,
    log: leaveLog,
    lastActivity: firebase.firestore.FieldValue.serverTimestamp()
  };

  if (state.hostId === localUid) update.hostId = (newPlayers.find(p => !p.isAI) || newPlayers[0]).id;

  await db.collection(ROOMS).doc(roomId).update(update);
}

// ============================================================
// END GAME VOTE
// ============================================================

async function handleEndGameVote() {
  const state = roomState;
  if (!state || state.status !== 'playing') return;

  const votes = state.endVotes || [];
  const hasVoted = votes.includes(localUid);

  if (hasVoted) {
    const log = addLog(state.log, `${localName} retiró su voto para terminar.`);
    await db.collection(ROOMS).doc(currentRoomId).update({
      endVotes: firebase.firestore.FieldValue.arrayRemove(localUid),
      log,
      lastActivity: firebase.firestore.FieldValue.serverTimestamp()
    });
  } else {
    const log = addLog(state.log,
      `${localName} propone terminar (${votes.length + 1}/${state.players.filter(p => !p.disconnected).length}).`);
    await db.collection(ROOMS).doc(currentRoomId).update({
      endVotes: firebase.firestore.FieldValue.arrayUnion(localUid),
      log,
      lastActivity: firebase.firestore.FieldValue.serverTimestamp()
    });
  }
}

function renderEndVoteStatus(state) {
  const votes = state.endVotes || [];
  const statusEl = document.getElementById('end-vote-status');
  const btn = document.getElementById('end-game-btn');
  const hasVoted = votes.includes(localUid);

  statusEl.textContent = votes.length > 0
    ? `${votes.length}/${state.players.filter(p => !p.disconnected).length} quieren terminar`
    : '';

  if (btn) {
    btn.textContent = hasVoted ? 'Retirar voto' : 'Terminar';
    btn.classList.toggle('btn-voted', hasVoted);
  }
}

// ============================================================
// WINNER SCREEN
// ============================================================

function renderWinner(state) {
  const reason = state.winnerReason;
  const titleEl = document.getElementById('winner-title');
  const nameEl  = document.getElementById('winner-name');
  const standingsEl = document.getElementById('winner-standings');

  document.getElementById('join-another-form')?.classList.add('hidden');
  document.getElementById('winner-error')?.classList.add('hidden');

  if (reason === 'vote') {
    titleEl.textContent = '🤝 ¡Partida terminada!';
    nameEl.textContent  = `${state.winnerName || '?'} ganó con más órganos sanos`;
  } else if (reason === 'lastPlayer') {
    titleEl.textContent = '🏆 ¡Último en pie!';
    nameEl.textContent  = state.winnerName || '?';
  } else {
    titleEl.textContent = '🎉 ¡Cuerpo sano!';
    nameEl.textContent  = `${state.winnerName || '?'} gana`;
  }

  // Final bodies of everyone, winner first
  if (state.bodies && state.players?.length) {
    const standings = computeStandings(state);
    standings.sort((a, b) => (b.id === state.winner) - (a.id === state.winner));
    standingsEl.innerHTML = standings.map((s, i) =>
      `<div class="standing-row ${s.id === state.winner ? 'winner-row' : ''}">
        <span class="standing-rank">#${i + 1}</span>
        <span class="standing-name">${esc(s.name)}</span>
        <span class="standing-stats">${Math.min(s.healthy, ORGANS_TO_WIN)}/${ORGANS_TO_WIN} sanos</span>
        <div class="body-row mini standing-body">${bodyHTML(state, s.id)}</div>
      </div>`
    ).join('');
    standingsEl.classList.remove('hidden');
  } else {
    standingsEl.classList.add('hidden');
  }
}

function showJoinAnother() {
  document.getElementById('join-another-form').classList.toggle('hidden');
}

async function handleJoinAnother() {
  const code = document.getElementById('winner-room-code').value.trim().toUpperCase();
  if (code.length !== 6) { showWinnerError('Introduce el código de sala de 6 caracteres'); return; }
  if (!localUid) { showWinnerError('Aún conectando… intenta de nuevo'); return; }

  const snap = await db.collection(ROOMS).doc(code).get();
  if (!snap.exists || !isVirusRoom(snap.data())) { showWinnerError('Sala no encontrada'); return; }
  const data = snap.data();
  if (data.status !== 'lobby') { showWinnerError('La partida ya comenzó'); return; }
  if (data.players.length >= 10) { showWinnerError('Sala llena (máximo 10)'); return; }

  if (roomUnsub) { roomUnsub(); roomUnsub = null; }

  if (!data.players.find(p => p.id === localUid)) {
    await db.collection(ROOMS).doc(code).update({
      players: firebase.firestore.FieldValue.arrayUnion({ id: localUid, name: localName, cardCount: 0 })
    });
  }

  currentRoomId = code;
  sessionStorage.setItem('roomId', code);
  sessionStorage.setItem('playerName', localName);
  sessionStorage.setItem('playerEmoji', selectedEmoji);
  subscribeToRoom(code);
  showScreen('lobby');
}

function showWinnerError(msg) {
  const el = document.getElementById('winner-error');
  el.textContent = msg;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 3500);
}

function returnToMain() {
  clearSpotifyTrackFromRoom();
  teardownPresence();
  if (roomUnsub) { roomUnsub(); roomUnsub = null; }
  currentRoomId = null;
  roomState = null;
  sessionStorage.clear();
  showScreen('landing');
}

window.addEventListener('beforeunload', () => {
  if (presenceRef) {
    presenceRef.onDisconnect().cancel();
    presenceRef.remove();
  }
  if (voiceActiveRef) {
    voiceActiveRef.onDisconnect().cancel();
    voiceActiveRef.remove();
  }
});

// ============================================================
// AI PLAYER ENGINE
// ============================================================

function scheduleAiAction(fn) {
  if (aiThinking) return;
  aiThinking = true;
  const delay = 700 + Math.random() * 900;
  setTimeout(async () => {
    try { await fn(); }
    catch (e) { console.error('[AI]', e); }
    finally {
      aiThinking = false;
      // Re-run dispatch in case the action bailed (no Firestore write = no snapshot = no re-trigger)
      if (roomState?.status === 'playing') maybeRunAI(roomState);
    }
  }, delay);
}

// Only the host runs bots, so every bot move is written exactly once
function maybeRunAI(state) {
  if (state.hostId !== localUid) return;
  if (aiThinking) return;
  if (state.status !== 'playing') return;
  const current = state.players[state.currentPlayerIndex];
  if (current?.isAI) scheduleAiAction(() => aiTakeTurn(current.id));
}

async function aiTakeTurn(aiId) {
  const state = roomState;
  if (!state || state.status !== 'playing') return;
  if (state.players[state.currentPlayerIndex]?.id !== aiId) return;
  await runMove(aiId, aiChooseMove(state, aiId));
}

// ---- Decision helpers ----

// How good a body is: healthy organs count most, protected ones a bit more,
// infected ones a little (they can still be cured). Four healthy = won.
function aiBodyValue(body) {
  let v = 0, healthy = 0;
  for (const s of body || []) {
    if (isInfected(s)) { v += 4; continue; }
    healthy++;
    v += isImmune(s) ? 15 : s.medicines.length ? 12.5 : 10;
  }
  if (healthy >= ORGANS_TO_WIN) v += 1000;
  else if (healthy === ORGANS_TO_WIN - 1) v += 6;
  return v;
}

// Score of a position for the bot: its own body minus the strongest rival's
// (plus a little for hurting the others too)
function aiEvaluate(state, bodies, aiId) {
  const mine = aiBodyValue(bodies[aiId]);
  let rival = 0, total = 0;
  for (const p of state.players) {
    if (p.id === aiId) continue;
    const v = aiBodyValue(bodies[p.id]);
    rival = Math.max(rival, v);
    total += v;
  }
  return mine - 0.75 * rival - 0.1 * total;
}

function aiChooseMove(state, aiId) {
  const moves = legalMoves(state, aiId);
  if (moves.length === 1 && moves[0].kind === 'pass') return moves[0];

  const baseline = aiEvaluate(state, state.bodies || {}, aiId);
  let best = null, bestScore = -Infinity;
  for (const m of moves) {
    const g = {
      hands: clone(state.hands || {}),
      bodies: clone(state.bodies || {}),
      drawPile: [],
      discardPile: []
    };
    applyEffect(state, g, aiId, m);
    let score = aiEvaluate(state, g.bodies, aiId) + Math.random() * 1.5;
    if (m.kind === 'glove') score += 3; // costs everyone else a turn
    if (score > bestScore) { bestScore = score; best = m; }
  }
  if (best && bestScore > baseline + 0.5) return best;
  return { kind: 'discard', cids: aiPickDiscards(state, aiId, moves) };
}

// Throw away cards that can't be played; if all are playable but useless, one at random
function aiPickDiscards(state, aiId, moves) {
  const hand = state.hands?.[aiId] || [];
  const dead = hand.filter(c => !moves.some(m => m.cid === c.id)).map(c => c.id);
  if (dead.length) return dead;
  return [hand[Math.floor(Math.random() * hand.length)].id];
}

// ============================================================
// VOICE CHAT (WebRTC mesh, Firebase RTDB signaling)
// ============================================================

const STUN_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

// voiceState cycles: 'off' → 'on' (unmuted) → 'muted' → 'off'
let voiceState = 'off';
let localStream = null;
const peerConns = {};
const voiceIceRefs = {};
let voiceActiveRef = null;
let voiceActiveRtdb = null;
let voiceSignalRtdb = null;
let voiceActivityRef = null;
let voiceActivityLoaded = false;
let audioCtx = null;
const voiceAnalysers = {};
const speakingStates = {};

async function toggleVoice() {
  if (voiceState === 'off') {
    await joinVoice();
  } else if (voiceState === 'on') {
    muteVoice();
  } else {
    unmuteVoice();
  }
}

// Modify SDP to prefer Opus with FEC, DTX, and higher bitrate for better voice quality
function preferOpus(sdp) {
  const lines = sdp.split('\r\n');
  let opusPt = null;
  for (const line of lines) {
    const m = line.match(/^a=rtpmap:(\d+) opus\/48000\/2/i);
    if (m) { opusPt = m[1]; break; }
  }
  if (!opusPt) return sdp;

  const fmtpLine = `a=fmtp:${opusPt} minptime=10;useinbandfec=1;usedtx=1;maxaveragebitrate=64000`;
  let hasFmtp = false;
  const result = lines.map(line => {
    if (line.startsWith('m=audio ')) {
      const parts = line.split(' ');
      const others = parts.slice(3).filter(p => p !== opusPt);
      return [...parts.slice(0, 3), opusPt, ...others].join(' ');
    }
    if (line.startsWith(`a=fmtp:${opusPt} `)) {
      hasFmtp = true;
      return fmtpLine;
    }
    return line;
  });
  if (!hasFmtp) {
    const idx = result.findIndex(l => l.startsWith(`a=rtpmap:${opusPt} `));
    if (idx >= 0) result.splice(idx + 1, 0, fmtpLine);
  }
  return result.join('\r\n');
}

async function joinVoice() {
  if (!currentRoomId) return;
  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
        sampleRate: { ideal: 48000 },
      },
      video: false,
    });
  } catch (e) {
    showVoiceToast('No se pudo acceder al micrófono');
    return;
  }

  voiceState = 'on';
  updateVoiceButton();
  startSpeakingMonitor(localUid, localStream);

  voiceActiveRef = rtdb.ref(`voice/${currentRoomId}/active/${localUid}`);
  voiceActiveRef.set({ muted: false });
  voiceActiveRef.onDisconnect().remove();

  voiceActiveRtdb = rtdb.ref(`voice/${currentRoomId}/active`);
  voiceActiveRtdb.on('child_added', snap => {
    const uid = snap.key;
    if (uid === localUid || peerConns[uid]) return;
    if (localUid > uid) initiateVoiceCall(uid);
    // else: the other peer (with higher uid) will initiate to us
  });
  voiceActiveRtdb.on('child_removed', snap => closePeerConn(snap.key));

  voiceSignalRtdb = rtdb.ref(`voice/${currentRoomId}/signals/${localUid}`);
  voiceSignalRtdb.on('child_added', snap => {
    const fromUid = snap.key;
    const data = snap.val();
    snap.ref.remove();
    if (!data) return;
    if (data.type === 'offer') handleVoiceOffer(fromUid, data.sdp);
    else if (data.type === 'answer') handleVoiceAnswer(fromUid, data.sdp);
  });
}

async function initiateVoiceCall(targetUid) {
  const pc = createPeerConn(targetUid);
  try {
    const offer = await pc.createOffer({ voiceActivityDetection: true });
    const offerSdp = preferOpus(offer.sdp);
    await pc.setLocalDescription({ type: offer.type, sdp: offerSdp });
    rtdb.ref(`voice/${currentRoomId}/signals/${targetUid}/${localUid}`)
      .set({ type: 'offer', sdp: offerSdp, ts: firebase.database.ServerValue.TIMESTAMP });
  } catch (e) {
    console.error('voice initiateCall:', e);
    closePeerConn(targetUid);
  }
}

async function handleVoiceOffer(fromUid, sdp) {
  const pc = createPeerConn(fromUid);
  try {
    await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp }));
    pc._flushCandidates();
    const answer = await pc.createAnswer({ voiceActivityDetection: true });
    const answerSdp = preferOpus(answer.sdp);
    await pc.setLocalDescription({ type: answer.type, sdp: answerSdp });
    rtdb.ref(`voice/${currentRoomId}/signals/${fromUid}/${localUid}`)
      .set({ type: 'answer', sdp: answerSdp, ts: firebase.database.ServerValue.TIMESTAMP });
  } catch (e) {
    console.error('voice handleOffer:', e);
    closePeerConn(fromUid);
  }
}

async function handleVoiceAnswer(fromUid, sdp) {
  const pc = peerConns[fromUid];
  if (!pc) return;
  try {
    await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp }));
    pc._flushCandidates();
  } catch (e) {
    console.error('voice handleAnswer:', e);
  }
}

function createPeerConn(remoteUid) {
  if (peerConns[remoteUid]) peerConns[remoteUid].close();

  const pc = new RTCPeerConnection(STUN_CONFIG);
  peerConns[remoteUid] = pc;

  // Queue ICE candidates received before setRemoteDescription completes
  const pending = [];
  pc._flushCandidates = () => {
    pending.splice(0).forEach(c =>
      pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {})
    );
  };

  if (localStream) {
    localStream.getTracks().forEach(t => pc.addTrack(t, localStream));
  }

  pc.ontrack = e => {
    const stream = e.streams[0] || new MediaStream([e.track]);
    let audio = document.getElementById('voice-audio-' + remoteUid);
    if (!audio) {
      audio = document.createElement('audio');
      audio.id = 'voice-audio-' + remoteUid;
      audio.autoplay = true;
      audio.playsInline = true;
      document.body.appendChild(audio);
    }
    audio.srcObject = stream;
    // Tune jitter buffer: 60ms balances latency vs. choppiness from network jitter
    pc.getReceivers().forEach(recv => {
      if (recv.track.kind === 'audio' && recv.jitterBufferTarget !== undefined) {
        recv.jitterBufferTarget = 60;
      }
    });
    startSpeakingMonitor(remoteUid, stream);
  };

  pc.onicecandidate = e => {
    if (e.candidate && currentRoomId) {
      rtdb.ref(`voice/${currentRoomId}/ice/${remoteUid}/${localUid}`)
        .push(e.candidate.toJSON());
    }
  };

  const iceRef = rtdb.ref(`voice/${currentRoomId}/ice/${localUid}/${remoteUid}`);
  iceRef.on('child_added', snap => {
    const candidate = snap.val();
    snap.ref.remove();
    if (pc.remoteDescription) {
      pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
    } else {
      pending.push(candidate);
    }
  });
  voiceIceRefs[remoteUid] = iceRef;

  pc.onconnectionstatechange = () => {
    if (pc.connectionState === 'failed') closePeerConn(remoteUid);
  };

  return pc;
}

function closePeerConn(uid) {
  if (voiceIceRefs[uid]) { voiceIceRefs[uid].off(); delete voiceIceRefs[uid]; }
  if (peerConns[uid]) { peerConns[uid].close(); delete peerConns[uid]; }
  const a = document.getElementById('voice-audio-' + uid);
  if (a) a.remove();
  stopSpeakingMonitor(uid);
  updateVoiceSpeaking(uid, false);
}

function muteVoice() {
  voiceState = 'muted';
  if (localStream) localStream.getAudioTracks().forEach(t => { t.enabled = false; });
  if (voiceActiveRef) voiceActiveRef.set({ muted: true });
  updateVoiceButton();
}

function unmuteVoice() {
  voiceState = 'on';
  if (localStream) localStream.getAudioTracks().forEach(t => { t.enabled = true; });
  if (voiceActiveRef) voiceActiveRef.set({ muted: false });
  updateVoiceButton();
}

function leaveVoice() {
  if (voiceState === 'off') return;
  const roomId = currentRoomId;
  voiceState = 'off';

  if (voiceActiveRef) {
    voiceActiveRef.onDisconnect().cancel();
    voiceActiveRef.remove();
    voiceActiveRef = null;
  }
  if (voiceActiveRtdb) { voiceActiveRtdb.off(); voiceActiveRtdb = null; }
  if (voiceSignalRtdb) { voiceSignalRtdb.off(); voiceSignalRtdb = null; }

  Object.keys(peerConns).forEach(closePeerConn);

  if (localStream) {
    localStream.getTracks().forEach(t => t.stop());
    localStream = null;
  }
  stopSpeakingMonitor(localUid);
  Object.keys(speakingStates).forEach(uid => {
    delete speakingStates[uid];
    updateVoiceSpeaking(uid, false);
  });

  if (roomId) {
    rtdb.ref(`voice/${roomId}/signals/${localUid}`).remove().catch(() => {});
    rtdb.ref(`voice/${roomId}/ice/${localUid}`).remove().catch(() => {});
  }
  updateVoiceButton();
}

function startSpeakingMonitor(uid, stream) {
  stopSpeakingMonitor(uid);
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.4;
    source.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    const timer = setInterval(() => {
      analyser.getByteFrequencyData(data);
      const avg = data.reduce((a, b) => a + b, 0) / data.length;
      const speaking = avg > 8;
      if (speaking !== speakingStates[uid]) {
        speakingStates[uid] = speaking;
        updateVoiceSpeaking(uid, speaking);
      }
    }, 100);
    voiceAnalysers[uid] = { source, analyser, timer };
  } catch (_) {}
}

function stopSpeakingMonitor(uid) {
  const e = voiceAnalysers[uid];
  if (!e) return;
  clearInterval(e.timer);
  try { e.source.disconnect(); } catch (_) {}
  delete voiceAnalysers[uid];
}

function updateVoiceSpeaking(uid, speaking) {
  if (uid === localUid) {
    document.getElementById('voice-toggle-btn')
      ?.classList.toggle('voice-self-speaking', speaking && voiceState === 'on');
  } else {
    document.querySelector(`.opponent[data-uid="${uid}"]`)
      ?.classList.toggle('voice-speaking', speaking);
  }
}

function updateVoiceButton() {
  const btn = document.getElementById('voice-toggle-btn');
  if (!btn) return;
  btn.classList.remove('voice-active', 'voice-muted', 'voice-self-speaking');
  if (voiceState === 'off') {
    btn.textContent = '🎤';
    btn.title = 'Unirse al chat de voz';
  } else if (voiceState === 'on') {
    btn.textContent = '🎤';
    btn.title = 'Silenciar micrófono';
    btn.classList.add('voice-active');
  } else {
    btn.textContent = '🔇';
    btn.title = 'Salir del chat de voz';
    btn.classList.add('voice-muted');
  }
}

function showVoiceToast(msg) {
  const el = document.getElementById('voice-toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden', 'voice-join');
  setTimeout(() => el.classList.add('hidden'), 3000);
}

function showVoiceJoinToast(msg) {
  const el = document.getElementById('voice-toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
  el.classList.add('voice-join');
  setTimeout(() => { el.classList.add('hidden'); el.classList.remove('voice-join'); }, 3500);
}
