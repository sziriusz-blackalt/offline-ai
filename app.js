import {
  env,
  LogLevel,
  ModelRegistry,
  TextStreamer,
  pipeline,
  AutoProcessor,
  AutoModelForImageTextToText,
  load_image,
} from './vendor/transformers/transformers.web.min.js';

/* ------------------------------------------------------------------ *
 * Offline AI Stúdió — minden modell fut a böngészőben, hálózat nélkül.
 * ------------------------------------------------------------------ */

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));
// Hiányzó elem esetén az eseményfeliratkozás nem szakítja meg az alkalmazást.
function on(selector, event, handler) {
  const el = typeof selector === 'string' ? $(selector) : selector;
  if (el) el.addEventListener(event, handler);
  return el;
}
const SHELL_CACHE = 'offline-ai-v1.4.8-shell';

const MODEL_DEFS = {
  nexa: {
    group: 'Csevegés', nick: 'Nexa HU', icon: '🧠', label: 'Nulláról tanított magyar modell (saját)', task: 'text-generation',
    model: 'sziriusz-blackalt/nexa-hu',
    web: 'q4', wasm: 'q4', sizeMB: 80, override: false,
    probe: 'onnx/model_q4.onnx',
    note: 'Teljesen saját súlyokkal, magyar adatokkal nulláról tanított modell. A repo nevét a Beállításokban kell megadni.',
  },
  tiny: {
    group: 'Csevegés', nick: 'Szikra', icon: '⚡', label: 'SmolLM2 135M Instruct', task: 'text-generation',
    model: 'onnx-community/SmolLM2-135M-Instruct-ONNX',
    web: 'q4f16', wasm: 'q4f16', sizeMB: 117, override: true,
    probes: ['onnx/model_q4f16.onnx', 'onnx/model_q4.onnx'],
    probe: 'onnx/model_q4f16.onnx',
    note: 'Nagyon gyors, de csak 135M paraméter: magyarul gyakran hibás. Rövid próbákhoz jó.',
  },
  lite: {
    group: 'Csevegés', nick: 'Nova Lite', icon: '🌙', label: 'SmolLM2 360M Instruct', task: 'text-generation',
    model: 'onnx-community/SmolLM2-360M-Instruct-ONNX',
    // A q4f16 (272 MB) kisebb és WASM-on is gyorsabb, mint a régi q8 (363 MB).
    web: 'q4f16', wasm: 'q4f16', sizeMB: 272, override: true,
    probes: ['onnx/model_q4f16.onnx', 'onnx/model_quantized.onnx'],
    probe: 'onnx/model_q4f16.onnx',
    note: 'Telefonra ajánlott: sokkal jobb, mint a Szikra, és gyorsabb, mint a Nova.',
  },
  chat: {
    group: 'Csevegés', nick: 'Nova', icon: '✨', label: 'Qwen3 0.6B', task: 'text-generation',
    model: 'onnx-community/Qwen3-0.6B-ONNX',
    web: 'q4f16', wasm: 'q4f16', sizeMB: 570, override: true,
    probes: ['onnx/model_q4f16.onnx', 'onnx/model_q4.onnx'],
    probe: 'onnx/model_q4f16.onnx',
    note: 'A legjobb magyar válaszok; nagyobb letöltés. Telefonra a Nova Lite ajánlott.',
  },
  code: {
    group: 'Kód', nick: 'Forge', icon: '🔨', label: 'Qwen2.5-Coder 0.5B', task: 'text-generation',
    model: 'onnx-community/Qwen2.5-Coder-0.5B-Instruct',
    web: 'q4f16', wasm: 'q4f16', sizeMB: 555, override: true,
    probes: ['onnx/model_q4f16.onnx', 'onnx/model_q4.onnx'],
    probe: 'onnx/model_q4f16.onnx',
    note: 'Kódírásra és magyarázatra hangolva. Telefonon a kódhoz is a chatmodellt használja.',
  },
  asr: {
    group: 'Hang', nick: 'Suttogó', icon: '🎧', label: 'Whisper Tiny', task: 'automatic-speech-recognition',
    model: 'onnx-community/whisper-tiny',
    web: 'q8', wasm: 'q8', sizeMB: 45,
    probe: 'onnx/encoder_model_quantized.onnx',
    note: 'Beszéd szöveggé alakítása, több nyelven.',
  },
  tts: {
    group: 'Hang', nick: 'Szirén', icon: '🎤', label: 'Supertonic TTS', task: 'text-to-speech',
    model: 'onnx-community/Supertonic-TTS-ONNX',
    web: 'fp32', wasm: 'fp32', sizeMB: 260,
    probe: 'onnx/text_encoder.onnx',
    extras: ['voices/F1.bin'],
    note: 'Természetes angol beszéd, 10 hanggal.',
  },
  caption: {
    group: 'Kép', nick: 'Látó', icon: '👁️', label: 'Képleíró / OCR', task: 'image-to-text',
    model: 'Xenova/vit-gpt2-image-captioning',
    web: 'q8', wasm: 'q8', sizeMB: 190,
    probe: 'onnx/decoder_model_merged_quantized.onnx',
    note: 'Leírja a képet és felismeri a nyomtatott szöveget.',
  },
  matte: {
    group: 'Kép', nick: 'Olló', icon: '✂️', label: 'Háttér eltávolító', task: 'background-removal',
    model: 'Xenova/modnet',
    web: 'q8', wasm: 'q8', sizeMB: 25,
    probe: 'onnx/model_quantized.onnx',
    note: 'Portré hátterét átlátszóvá teszi.',
  },
  vlm: {
    group: 'Kép', nick: 'Látnok', icon: '🔮', label: 'LFM2.5-VL 450M', task: 'image-text-to-text',
    model: 'onnx-community/LFM2.5-VL-450M-ONNX',
    web: 'q4', wasm: 'q4', sizeMB: 350,
    probe: 'onnx/decoder_model_merged_q4.onnx_data',
    special: true,
    note: 'Kérdezz a képről (angol kérdésekkel).',
  },
};

// A saját modell csak akkor jelenik meg, ha a felhasználó megadta a repo nevét.
// Így a beépített modellek és az „Összes letöltése” változatlanul működnek.
const NEXA_REPO_KEY = 'nexaRepo';
function nexaRepo() {
  return (localStorage.getItem(NEXA_REPO_KEY) || '').trim();
}
function modelDefs() {
  const defs = { ...MODEL_DEFS };
  const repo = nexaRepo();
  if (repo) defs.nexa = { ...MODEL_DEFS.nexa, model: repo };
  else delete defs.nexa;
  return defs;
}
function getDef(key) {
  return modelDefs()[key] || MODEL_DEFS[key];
}

const RUNTIME_FILES = [
  'ort-wasm-simd-threaded.mjs',
  'ort-wasm-simd-threaded.wasm',
  'ort-wasm-simd-threaded.asyncify.mjs',
  'ort-wasm-simd-threaded.asyncify.wasm',
  'ort-wasm-simd-threaded.jsep.mjs',
  'ort-wasm-simd-threaded.jsep.wasm',
  'ort-wasm-simd-threaded.jspi.mjs',
  'ort-wasm-simd-threaded.jspi.wasm',
];

const CHAT_STYLES = {
  hu: 'You are a helpful assistant. Answer in correct, natural Hungarian. Be concise but complete: finish the thought instead of stopping early. Be friendly and honest. Never invent facts. If you do not know, say so in Hungarian.',
  general: 'You are a helpful, concise assistant. Answer clearly and honestly.',
  translate: 'Fordító vagy. Csak a fordítást add meg magyar és angol között, magyarázat nélkül.',
  summary: 'Összefoglaló vagy. Rövid, lényegre törő összefoglalót készíts magyarul.',
};

const CODE_STYLES = {
  write: 'You are an expert programmer. Write correct, readable code with short Hungarian comments. Return only the code and a brief explanation.',
  explain: 'Magyarázd el a kódot magyarul, lépésről lépésre, röviden.',
  fix: 'Találd meg a hibát, és javítsd ki. Add meg a javított kódot és egy rövid magyarázatot magyarul.',
  review: 'Tekintsd át a kódot magyarul: biztonság, olvashatóság, teljesítmény. Pontokba szedett javaslatokat adj.',
};

const CHATS_KEY = 'nexa-chats-v1';
const ACTIVE_KEY = 'nexa-active-chat-v1';

const state = {
  pipes: new Map(),
  chats: [],
  activeChatId: null,
  modelInfo: {},
  busyChat: false,
  downloading: new Set(),
  mic: null,
  ttsBlobUrl: null,
  matteUrl: null,
  activePipeKey: null,
  files: { caption: null, matte: null, vlm: null },
  deferredPrompt: null,
  tinyWarned: false,
};

/* ----------------------------- setup ----------------------------- */

env.logLevel = LogLevel.ERROR;
// A v4 böngészőben alapból kikapcsolja a "helyi" modelleket. Online módban ez
// rendben van (a cache kulcsa így is a Hugging Face URL), de szigorú offline
// módban a `local_files_only` miatt ez a kapcsolónak BE kell lennie.
env.allowLocalModels = localStorage.getItem('offline') === '1';
env.useBrowserCache = true;
env.useWasmCache = true;
env.backends.onnx.wasm.wasmPaths = new URL('./vendor/ort/', import.meta.url).href;

function loadJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function saveJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode */ }
}

/* -------------------------- chat sessions ------------------------- */

function uid() {
  return `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

function titleFromMessages(messages) {
  const first = Array.isArray(messages) ? messages.find((m) => m?.role === 'user') : null;
  const text = String(first?.content || '').replace(/\s+/g, ' ').trim();
  if (!text) return 'Új csevegés';
  return text.length > 34 ? `${text.slice(0, 34)}…` : text;
}

function makeChat(title = 'Új csevegés', mode = 'auto', messages = []) {
  return { id: uid(), title, mode, messages, createdAt: Date.now(), updatedAt: Date.now() };
}

function initChats() {
  let loaded = loadJSON(CHATS_KEY, null);
  if (!Array.isArray(loaded) || !loaded.length) {
    loaded = [];
    const legacyChat = loadJSON('offline-ai-chat', []);
    const legacyCode = loadJSON('offline-ai-code', []);
    if (Array.isArray(legacyChat) && legacyChat.length) {
      loaded.push(makeChat(titleFromMessages(legacyChat), 'chat', legacyChat));
    }
    if (Array.isArray(legacyCode) && legacyCode.length) {
      loaded.push(makeChat(titleFromMessages(legacyCode), 'code', legacyCode));
    }
  }
  state.chats = loaded
    .filter((c) => c && Array.isArray(c.messages))
    .map((c) => ({
      ...c,
      id: c.id || uid(),
      title: c.title || titleFromMessages(c.messages),
      mode: ['auto', 'chat', 'code'].includes(c.mode) ? c.mode : 'auto',
      temp: Boolean(c.temp),
      updatedAt: c.updatedAt || Date.now(),
    }));
  if (!state.chats.length) state.chats.push(makeChat());
  const savedId = localStorage.getItem(ACTIVE_KEY);
  state.activeChatId = state.chats.some((c) => c.id === savedId) ? savedId : state.chats[0].id;
}

function activeChat() {
  return state.chats.find((c) => c.id === state.activeChatId) || state.chats[0];
}

function persistChats() {
  // Az ideiglenes/privát csevegések nem kerülnek tartós tárolóba.
  saveJSON(CHATS_KEY, state.chats.filter((chat) => !chat.temp));
  saveJSON(ACTIVE_KEY, state.activeChatId);
}

function isSmallDevice() {
  return Boolean(window.matchMedia?.('(max-width: 767px)').matches)
    || Boolean(navigator.deviceMemory && navigator.deviceMemory <= 6)
    || Boolean(navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
}

async function releasePipe(key) {
  const pipe = state.pipes.get(key);
  state.pipes.delete(key);
  if (state.activePipeKey === key) state.activePipeKey = null;
  if (!pipe) return;
  try { await pipe.dispose?.(); } catch { /* már felszabadítva */ }
}

// A betöltött modellt megtartjuk a gyors válaszokhoz, de ha a felhasználó
// egy percig nem ír, elengedjük, hogy ne fogyjon el a telefon memóriája.
let pipeIdleTimer = null;
function schedulePipeRelease() {
  clearTimeout(pipeIdleTimer);
  pipeIdleTimer = setTimeout(async () => {
    if (!state.busyChat && state.activePipeKey) await releasePipe(state.activePipeKey);
  }, 60000);
}

let offlineMode = localStorage.getItem('offline') === '1';
const toggleEl = $('#offlineToggle');
if (toggleEl) toggleEl.checked = offlineMode;
env.allowRemoteModels = !offlineMode;

const theme = localStorage.getItem('theme') || 'dark';
document.documentElement.dataset.theme = theme;

// Telefonon alapból a stabil, gyors CPU/WASM út + rövidebb generálás.
// A `?small=1` URL paraméterrel ez a mód asztalon is kikényszeríthető (teszteléshez).
const smallDevice = isSmallDevice();
const forceSmall = new URLSearchParams(location.search).has('small');
const phoneMode = () => smallDevice || forceSmall;
if (phoneMode() && localStorage.getItem('device') === null) localStorage.setItem('device', 'wasm');
if (localStorage.getItem('chatTemp') === null) localStorage.setItem('chatTemp', phoneMode() ? '0.2' : '0.3');
if (localStorage.getItem('chatTokens') === null) localStorage.setItem('chatTokens', '128');

function syncGenerationControls() {
  const temp = localStorage.getItem('chatTemp') || (phoneMode() ? '0.2' : '0.3');
  const tokens = localStorage.getItem('chatTokens') || '128';
  if ($('#chatTemp')) $('#chatTemp').value = temp;
  if ($('#tempOut')) $('#tempOut').textContent = temp;
  if ($('#chatTokens')) $('#chatTokens').value = tokens;
  if ($('#tokensOut')) $('#tokensOut').textContent = tokens;
}
syncGenerationControls();

initChats();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

async function confirmPersistentStorage() {
  try {
    if (navigator.storage?.persist) {
      const already = await navigator.storage.persisted();
      if (!already) await navigator.storage.persist();
    }
  } catch { /* nem minden böngésző támogatja */ }
}
confirmPersistentStorage();

/* ----------------------------- utils ----------------------------- */

const escapeHtml = (str) => String(str).replace(/[&<>"']/g, (ch) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[ch]));

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '–';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  while (bytes >= 1024 && i < units.length - 1) { bytes /= 1024; i++; }
  return `${bytes.toFixed(bytes >= 10 ? 0 : 1)} ${units[i]}`;
}

let toastTimer;
function toast(message, kind = 'info') {
  const el = $('#toast');
  el.textContent = message;
  el.style.borderColor = kind === 'error' ? 'var(--bad)' : kind === 'ok' ? 'var(--good)' : 'var(--border)';
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3800);
}

// Egy váratlan hiba ne döntse el az egész felületet.
window.addEventListener('error', (event) => {
  console.error('Váratlan hiba:', event.error || event.message);
  toast(`Váratlan hiba: ${event.message || 'ismeretlen'}`, 'error');
});
window.addEventListener('unhandledrejection', (event) => {
  console.error('Kezeletlen ígéret hiba:', event.reason);
  toast(`Hiba: ${event.reason?.message || String(event.reason || 'ismeretlen')}`, 'error');
  event.preventDefault();
});

function stripThink(text) {
  return String(text || '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<think>[\s\S]*$/i, '')
    .trim();
}

function modelUrl(model, file) {
  return `${env.remoteHost.replace(/\/$/, '')}/${model}/resolve/main/${file}`;
}

async function isFileCached(model, file) {
  try {
    const cache = await caches.open(env.cacheKey);
    return Boolean(await cache.match(modelUrl(model, file)));
  } catch { return false; }
}

async function resolveDevice() {
  const pref = localStorage.getItem('device') || 'auto';
  if (pref === 'wasm') return 'wasm';
  if (pref === 'webgpu') return 'webgpu';
  if (phoneMode()) return 'wasm';
  return (typeof navigator !== 'undefined' && navigator.gpu) ? 'webgpu' : 'wasm';
}

async function resolveDtype(key, device) {
  const def = getDef(key);
  const override = localStorage.getItem('dtype') || 'auto';
  let dtype = device === 'webgpu' ? def.web : def.wasm;
  if (override !== 'auto' && def.override) dtype = override;
  return dtype;
}

function generationOptions(key, device, dtype, extra = {}) {
  return {
    device,
    dtype,
    local_files_only: offlineMode,
    ...extra,
  };
}

function progressHandler(def, onProgress) {
  return (info) => {
    if (!onProgress) return;
    if (info?.status === 'progress_total' && Number.isFinite(info.progress)) {
      onProgress(info.progress / 100, 'Letöltés');
    } else if (info?.status === 'progress' && Number.isFinite(info.progress)) {
      onProgress(info.progress / 100, info.file || 'Fájl');
    } else if (info?.status === 'done') {
      onProgress(1, 'Kész');
    }
  };
}

async function loadPipe(key, onProgress) {
  if (state.pipes.has(key)) return state.pipes.get(key);
  const def = getDef(key);
  let device = await resolveDevice();
  let dtype = await resolveDtype(key, device);
  const options = generationOptions(key, device, dtype, {
    progress_callback: progressHandler(def, onProgress),
  });

  let pipe;
  try {
    pipe = await pipeline(def.task, def.model, options);
  } catch (err) {
    if (device === 'webgpu') {
      console.warn('WebGPU nem működött, váltás WASM-ra:', err);
      device = 'wasm';
      // A q4f16 WASM-on is működik (ellenőrizve), így nem kell a nagyobb q4-re váltani.
      dtype = def.wasm;
      pipe = await pipeline(def.task, def.model, generationOptions(key, device, dtype, {
        progress_callback: progressHandler(def, onProgress),
      }));
      toast('WebGPU helyett CPU/WASM módban fut a modell.', 'info');
    } else {
      throw err;
    }
  }
  state.pipes.set(key, pipe);
  return pipe;
}

async function getVlm(onProgress) {
  if (state.pipes.has('vlm')) return state.pipes.get('vlm');
  const def = MODEL_DEFS.vlm;
  let device = await resolveDevice();
  let dtype = await resolveDtype('vlm', device);
  const options = generationOptions('vlm', device, dtype, {
    progress_callback: progressHandler(def, onProgress),
  });
  let bundle;
  try {
    bundle = {
      processor: await AutoProcessor.from_pretrained(def.model, options),
      model: await AutoModelForImageTextToText.from_pretrained(def.model, options),
    };
  } catch (err) {
    if (device !== 'webgpu') throw err;
    const wasmOptions = generationOptions('vlm', 'wasm', 'q4', {
      progress_callback: progressHandler(def, onProgress),
    });
    bundle = {
      processor: await AutoProcessor.from_pretrained(def.model, wasmOptions),
      model: await AutoModelForImageTextToText.from_pretrained(def.model, wasmOptions),
    };
    toast('WebGPU helyett CPU/WASM módban fut a képi modell.', 'info');
  }
  state.pipes.set('vlm', bundle);
  return bundle;
}

/* -------------------------- navigation -------------------------- */

let chatSearchQuery = '';

function switchView(name) {
  // A „Kód mód” nem külön oldal, hanem a jelenlegi chat egyik módja.
  if (name === 'code') {
    const chat = activeChat();
    chat.mode = 'code';
    persistChats();
    if ($('#chatMode')) $('#chatMode').value = 'code';
    syncChatHeader();
    renderChatList();
    name = 'chat';
  }
  $$('.side-item[data-view]').forEach((b) => b.classList.toggle('active', b.dataset.view === name));
  $('#newChatBtn')?.classList.toggle('active', name === 'chat');
  $$('.view').forEach((v) => v.classList.toggle('active', v.id === `view-${name}`));
  if (name === 'settings') refreshModels();
  if (name === 'chat') syncChatHeader();
  setMenu(false);
}

/* Mobil hamburger menü */
const menuBtn = $('#menuBtn');
const menuClose = $('#menuClose');
const mainNav = $('#mainNav');
const navBackdrop = $('#navBackdrop');

function setMenu(open) {
  if (!mainNav || !navBackdrop) return;
  if (open && window.innerWidth <= 767) document.body.classList.remove('sidebar-collapsed');
  mainNav.classList.toggle('open', open);
  navBackdrop.hidden = !open;
  requestAnimationFrame(() => navBackdrop.classList.toggle('show', open));
  document.body.classList.toggle('menu-open', open);
  menuBtn?.setAttribute('aria-expanded', String(open));
  menuBtn?.setAttribute('aria-label', open ? 'Menü bezárása' : 'Menü megnyitása');
}

on(menuBtn, 'click', () => setMenu(!mainNav?.classList.contains('open')));
on(menuClose, 'click', () => setMenu(false));
on(navBackdrop, 'click', () => setMenu(false));
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  setMenu(false);
  setProfileMenu(false);
  setComposerMenu(null);
});
window.addEventListener('resize', () => {
  if (window.innerWidth > 767) setMenu(false);
});

$$('.side-item[data-view]').forEach((btn) => btn.addEventListener('click', () => {
  switchView(btn.dataset.view);
}));

/* Keresés az oldalsávban */
on('#sidebarSearch', 'click', () => {
  const nav = $('#mainNav');
  const open = !nav.classList.contains('search-open');
  nav.classList.toggle('search-open', open);
  if (open) {
    $('#chatSearch').focus();
  } else {
    $('#chatSearch').value = '';
    chatSearchQuery = '';
    renderChatList();
  }
});
on('#chatSearch', 'input', (e) => {
  chatSearchQuery = e.target.value.trim().toLowerCase();
  renderChatList();
});

/* Oldalsáv összecsukása asztalon */
function applySidebarCollapsed(collapsed) {
  document.body.classList.toggle('sidebar-collapsed', collapsed);
  const btn = $('#sidebarCollapse');
  btn.setAttribute('aria-label', collapsed ? 'Oldalsáv kinyitása' : 'Oldalsáv összecsukása');
  btn.title = collapsed ? 'Kinyitás' : 'Összecsukás';
}
applySidebarCollapsed(localStorage.getItem('sidebarCollapsed') === '1');
on('#sidebarCollapse', 'click', () => {
  const collapsed = !document.body.classList.contains('sidebar-collapsed');
  applySidebarCollapsed(collapsed);
  localStorage.setItem('sidebarCollapsed', collapsed ? '1' : '0');
});

/* Profil és fiók menü */
function setProfileMenu(open) {
  const menu = $('#profileMenu');
  if (!menu) return;
  menu.hidden = !open;
  $('#profileBtn')?.setAttribute('aria-expanded', String(open));
}
on('#profileBtn', 'click', (event) => {
  event.stopPropagation();
  const menu = $('#profileMenu');
  setProfileMenu(menu ? menu.hidden : false);
  setComposerMenu(null);
});
document.addEventListener('click', (event) => {
  if (!event.target.closest('.profile-wrap')) setProfileMenu(false);
  if (!event.target.closest('.composer-wrap')) setComposerMenu(null);
});
on('#profileSettings', 'click', () => {
  setProfileMenu(false);
  switchView('settings');
});
on('#upgradeBtn', 'click', () => {
  setProfileMenu(false);
  switchView('settings');
  toast('A Nexa AI ingyenes. Az APK frissítését a Telepítés résznél találod.', 'info');
});
on('#appearanceBtn', 'click', () => {
  setProfileMenu(false);
  switchView('settings');
  requestAnimationFrame(() => $('#appearancePanel')?.scrollIntoView({ block: 'start' }));
});

/* A böngészős „telepítés” csak parancsikont hoz létre – mindenhol a valódi APK-t kínáljuk. */
const installBtn = $('#installBtn');
if (installBtn) {
  installBtn.hidden = false;
  installBtn.textContent = '⬇ Nexa AI APK letöltése';
  installBtn.addEventListener('click', () => {
    setProfileMenu(false);
    toast('APK letöltése indult. Telepítés után az alkalmazásfiókból indítsd a Nexa AI-t.', 'ok');
    window.location.href = './downloads/offline-ai.apk';
  });
}
window.addEventListener('beforeinstallprompt', (event) => event.preventDefault());

on('#chatTemp', 'input', (e) => {
  const value = e.target.value;
  $('#tempOut').textContent = value;
  localStorage.setItem('chatTemp', value);
});
on('#chatTokens', 'input', (e) => {
  const value = e.target.value;
  $('#tokensOut').textContent = value;
  localStorage.setItem('chatTokens', value);
});
// Telefonon alapból a köztes, gyors modell: nem kell 570 MB-ot letölteni
// csak azért, hogy egyáltalán választ kapjunk.
function commitChatModel(key) {
  const select = $('#chatModel');
  if (!select || !MODEL_DEFS[key]) return;
  select.value = key;
  localStorage.setItem('chatModel', key);
  syncModelButton();
  renderModelMenu();
}

// A saját modell mindig választható a csevegő Modell gombjáról. Ha még nincs
// megadva a repo, odairányítunk a Beállításokhoz, de nem indítunk letöltést.
function selectChatModel(key, notify = true) {
  if (!MODEL_DEFS[key]) return;
  if (key === 'nexa' && !nexaRepo()) {
    const previous = localStorage.getItem('chatModel');
    commitChatModel(previous && previous !== 'nexa' ? previous : (phoneMode() ? 'lite' : 'chat'));
    if (notify) {
      toast('A saját modellhez add meg a repo nevét: Beállítások → Saját Nexa modell.', 'info');
      switchView('settings');
    }
    return;
  }
  commitChatModel(key);
  if (notify && key === 'nexa') {
    toast(nexaRepo()
      ? '🧠 Nexa HU kiválasztva. Ha még nincs letöltve, a Modellek kártyán nyomj a Letöltésre.'
      : '🧠 Nexa HU kiválasztva.', 'info');
  }
}

const defaultChatModel = phoneMode() ? 'lite' : 'chat';
let savedChatModel = localStorage.getItem('chatModel') || defaultChatModel;
if (!MODEL_DEFS[savedChatModel] || (savedChatModel === 'nexa' && !nexaRepo())) {
  savedChatModel = defaultChatModel;
}
commitChatModel(savedChatModel);
on('#chatModel', 'change', (e) => selectChatModel(e.target.value));

/* ---------------------------- chat ------------------------------ */

function renderFormatted(container, text, isCode) {
  container.textContent = '';
  if (!isCode) {
    container.textContent = text;
    return;
  }
  const parts = text.split(/```/);
  parts.forEach((part, index) => {
    if (index % 2 === 1) {
      const wrap = document.createElement('div');
      wrap.className = 'code-wrap';
      const pre = document.createElement('pre');
      pre.style.cssText = 'background:var(--surface-2);padding:10px;border-radius:8px;overflow:auto;white-space:pre-wrap';
      const code = document.createElement('code');
      code.textContent = part.replace(/^[a-zA-Z0-9+#-]+\n/, '');
      pre.appendChild(code);
      const copy = document.createElement('button');
      copy.className = 'btn btn-ghost';
      copy.style.cssText = 'font-size:11px;padding:4px 8px;margin-top:4px';
      copy.textContent = 'Másolás';
      copy.addEventListener('click', () => navigator.clipboard?.writeText(code.textContent));
      wrap.append(pre, copy);
      container.appendChild(wrap);
    } else if (part.trim()) {
      const p = document.createElement('div');
      p.textContent = part;
      container.appendChild(p);
    }
  });
}

function syncChatHeader() {
  const chat = activeChat();
  $('#chatTitle').textContent = chat.title;
  const modeText = chat.mode === 'auto' ? 'Automatikus' : chat.mode === 'code' ? 'Kód' : 'Csevegés';
  const turns = chat.messages.filter((m) => m.role === 'user').length;
  $('#chatSubtitle').textContent = `${modeText} mód · ${turns} üzenet · ${chat.temp ? 'ideiglenes' : 'automatikusan mentve'}`;
  $('#chatHeading').hidden = chat.messages.length === 0;
  $('#tempBadge').hidden = !chat.temp;
  $('#tempChatBtn').setAttribute('aria-pressed', String(Boolean(chat.temp)));
  $('#codeOptions').hidden = chat.mode !== 'code';
  if ($('#chatMode').value !== chat.mode) $('#chatMode').value = chat.mode;
}

function renderChatList() {
  const list = $('#chatList');
  if (!list) return;
  list.textContent = '';
  const sorted = state.chats
    .filter((chat) => !chat.temp && (!chatSearchQuery || chat.title.toLowerCase().includes(chatSearchQuery)))
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  if (!sorted.length) {
    const empty = document.createElement('div');
    empty.className = 'pinned-empty';
    empty.textContent = chatSearchQuery ? 'Nincs találat.' : 'Még nincs mentett csevegés.';
    list.appendChild(empty);
    return;
  }
  sorted.forEach((chat) => {
    const row = document.createElement('div');
    row.className = `chat-list-item${chat.id === state.activeChatId ? ' active' : ''}`;

    const open = document.createElement('button');
    open.type = 'button';
    open.className = 'chat-open';
    const icon = document.createElement('span');
    icon.textContent = chat.mode === 'code' ? '🔨' : '💬';
    const label = document.createElement('span');
    label.className = 'chat-label';
    label.textContent = chat.title;
    const meta = document.createElement('small');
    meta.className = 'chat-meta';
    meta.textContent = `${chat.mode === 'code' ? 'Kód' : chat.mode === 'chat' ? 'Csevegés' : 'Auto'} · ${chat.messages.length} üzenet`;
    label.appendChild(meta);
    open.append(icon, label);
    open.addEventListener('click', () => {
      state.activeChatId = chat.id;
      persistChats();
      syncChatHeader();
      renderChat();
      renderChatList();
      setMenu(false);
    });

    const rename = document.createElement('button');
    rename.type = 'button';
    rename.className = 'chat-act';
    rename.textContent = '✎';
    rename.title = 'Átnevezés';
    rename.setAttribute('aria-label', `Átnevezés: ${chat.title}`);
    rename.addEventListener('click', (event) => {
      event.stopPropagation();
      const name = prompt('Beszélgetés neve:', chat.title);
      if (name && name.trim()) {
        chat.title = name.trim().slice(0, 60);
        chat.updatedAt = Date.now();
        persistChats();
        syncChatHeader();
        renderChatList();
      }
    });

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'chat-act';
    remove.textContent = '🗑';
    remove.title = 'Törlés';
    remove.setAttribute('aria-label', `Törlés: ${chat.title}`);
    remove.addEventListener('click', (event) => {
      event.stopPropagation();
      if (!confirm(`Törlöd a(z) „${chat.title}” beszélgetést?`)) return;
      state.chats = state.chats.filter((c) => c.id !== chat.id);
      if (!state.chats.length) state.chats.push(makeChat());
      if (state.activeChatId === chat.id) state.activeChatId = state.chats[0].id;
      persistChats();
      syncChatHeader();
      renderChat();
      renderChatList();
    });

    row.append(open, rename, remove);
    list.appendChild(row);
  });
}

function newChat() {
  const chat = makeChat();
  state.chats.unshift(chat);
  state.activeChatId = chat.id;
  persistChats();
  switchView('chat');
  syncChatHeader();
  renderChat();
  renderChatList();
  setMenu(false);
  $('#chatInput').focus();
}
on('#newChatBtn', 'click', newChat);

on('#tempChatBtn', 'click', () => {
  const chat = activeChat();
  chat.temp = !chat.temp;
  chat.updatedAt = Date.now();
  persistChats();
  syncChatHeader();
  renderChatList();
  toast(chat.temp
    ? 'Ideiglenes csevegés: nem kerül a mentett beszélgetések közé.'
    : 'A csevegés ismét mentve lesz.', 'info');
});

function renderChat() {
  const log = $('#chatLog');
  const chat = activeChat();
  const hasMessages = chat.messages.length > 0;
  $('#view-chat')?.classList.toggle('has-messages', hasMessages);
  $('#chatHeading').hidden = !hasMessages;
  log.textContent = '';
  if (!chat.messages.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = chat.mode === 'code'
      ? 'Írd le, milyen kódot szeretnél – például „Írj egy függvényt, ami kiveszi az ékezetes betűket”. ⌘'
      : 'Írj egy üzenetet, és a modell itt, a készülékeden válaszol. ✨';
    log.appendChild(empty);
    return;
  }
  chat.messages.forEach((msg) => {
    const row = document.createElement('div');
    row.className = `msg ${msg.role === 'user' ? 'user' : 'assistant'}`;
    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    avatar.textContent = msg.role === 'user' ? '🙂' : msg.code ? '⌘' : '◈';
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    renderFormatted(bubble, msg.content, Boolean(msg.code));
    row.append(avatar, bubble);
    log.appendChild(row);
  });
  log.scrollTop = log.scrollHeight;
}

on('#chatClear', 'click', () => {
  const chat = activeChat();
  if (!chat.messages.length) return;
  if (!confirm('Törlöd ennek a beszélgetésnek az összes üzenetét?')) return;
  chat.messages = [];
  chat.title = 'Új csevegés';
  chat.updatedAt = Date.now();
  persistChats();
  syncChatHeader();
  renderChat();
  renderChatList();
});

on('#chatMode', 'change', (event) => {
  const chat = activeChat();
  chat.mode = event.target.value;
  chat.updatedAt = Date.now();
  persistChats();
  syncChatHeader();
  renderChatList();
});

function systemPrompt(mode, modelKey) {
  // Telefonon minden extra token ideget vesz el a válaszidőből: rövid utasítás.
  if (phoneMode()) {
    return mode === 'code'
      ? 'Answer in Hungarian. Give correct code and finish the explanation.'
      : 'Answer in correct Hungarian. Be concise, but complete the answer. Be honest.';
  }
  if (mode === 'code') {
    const task = CODE_STYLES[$('#codeMode').value] || CODE_STYLES.write;
    const lang = $('#codeLang').value;
    return `${task} Programming language: ${lang}. Answer in Hungarian, briefly.`;
  }
  const base = CHAT_STYLES[$('#chatStyle').value] || CHAT_STYLES.hu;
  if (modelKey === 'tiny') {
    return `${base} Use only simple Hungarian words. Do not add emojis or extra examples.`;
  }
  return base;
}

function detectChatMode(text) {
  const t = String(text).toLowerCase();
  return /```|\bfunction\b|\bdef\s|\bclass\s|\bimport\b|console\.|print\(|\bselect\s+.+\bfrom\b|<\/?[a-z]+>|=>|\bbug\b|\bhiba\b|\bdebug\b|refaktor|\bkód|\bfüggvény|\bscript\b|\bpython\b|\bjavascript\b|\bhtml\b|\bcss\b|\bjson\b|\bsql\b|\bc#\b/.test(t)
    ? 'code'
    : 'chat';
}

function buildChatPrompt(pipe, messages, modelKey) {
  try {
    if (pipe?.tokenizer?.apply_chat_template) {
      const kwargs = { tokenize: false, add_generation_prompt: true };
      // A Qwen3 alapból <think> blokkal indítana. A sablonba kell megadni a kapcsolót,
      // a generálási opciók között a library nem továbbítja a modellnek.
      if (modelKey === 'chat' || modelKey === 'nexa') kwargs.enable_thinking = false;
      const text = pipe.tokenizer.apply_chat_template(messages, kwargs);
      if (typeof text === 'string' && text.length) return text;
    }
  } catch (err) {
    console.warn('Chat sablon előállítása nem sikerült, az üzeneteket használom:', err);
  }
  return messages;
}

async function runChatGeneration(pipe, messages, options, chat, bubble, log, mode, modelKey) {
  const input = buildChatPrompt(pipe, messages, modelKey);
  const asText = typeof input === 'string';
  let streamed = '';

  const streamer = new TextStreamer(pipe.tokenizer, {
    skip_prompt: true,
    skip_special_tokens: true,
    callback_function: (chunk) => {
      // A szöveget akkor is összeszedjük, ha a buborék épp nem látható:
      // így a teljes válasz mindenképpen megmarad.
      streamed += chunk;
      const current = chat.messages.at(-1);
      if (current) current.content = stripThink(streamed);
      if (bubble.isConnected) {
        bubble.textContent = current?.content || '';
        log.scrollTop = log.scrollHeight;
      }
    },
  });

  const output = await pipe(input, {
    ...options,
    ...(asText ? { return_full_text: false } : {}),
    streamer,
  });

  let result = '';
  const first = Array.isArray(output) ? output[0] : output;
  if (Array.isArray(first)) result = first.at(-1)?.generated_text ?? '';
  else result = first?.generated_text ?? '';
  if (typeof result !== 'string') result = '';
  result = stripThink(result);
  if (!result && streamed) result = stripThink(streamed);
  return result.trim();
}

async function sendChat(text, forcedMode) {
  if (state.busyChat) return toast('A modell még dolgozik, várj egy pillanatot.', 'info');
  const input = $('#chatInput');
  const userText = (text ?? input.value).trim();
  if (!userText) return;

  const chat = activeChat();
  const mode = forcedMode || (chat.mode === 'auto' ? detectChatMode(userText) : chat.mode);
  // Telefonon a kód is a kiválasztott chatmodellt használja: így nem kell
  // külön 555 MB-os Forge-ot letölteni csak azért, mert kódot kérünk.
  let modelKey = mode === 'code' && !phoneMode() ? 'code' : $('#chatModel').value;
  if (modelKey === 'nexa' && !nexaRepo()) {
    return toast('A saját modell nincs beállítva: Beállítások → Saját Nexa modell.', 'error');
  }
  if (state.downloading.has(modelKey)) return toast('Ez a modell még töltődik, várj egy pillanatot.', 'info');

  // Küldéskor ne induljon el észrevétlenül egy hatalmas letöltés.
  if (!await isModelCached(modelKey)) {
    const fallback = await findCachedChatModel();
    if (fallback) {
      toast(`${getDef(modelKey).nick} nincs letöltve — a már elérhető ${getDef(fallback).nick} válaszol.`, 'info');
      modelKey = fallback;
    } else {
      return toast('Először töltsd le a modellt: Beállítások → Modellek → Letöltés.', 'error');
    }
  }
  state.busyChat = true;
  const sendBtn = $('#chatSend');
  sendBtn.disabled = true;
  sendBtn.textContent = '…';
  input.value = '';
  updateComposerState();
  setComposerMenu(null);

  chat.messages.push({ role: 'user', content: userText, ts: Date.now() });
  chat.messages.push({ role: 'assistant', content: '…', ts: Date.now(), code: mode === 'code' });
  if (chat.title === 'Új csevegés' && chat.messages.filter((m) => m.role === 'user').length === 1) {
    chat.title = titleFromMessages(chat.messages);
  }
  chat.updatedAt = Date.now();
  persistChats();
  syncChatHeader();
  renderChat();
  renderChatList();

  const log = $('#chatLog');
  const bubble = log.querySelector('.msg.assistant:last-child .bubble');

  try {
    // Ha váltunk modellt, a régit elengedjük — egyszerre csak egy modell van a memóriában.
    if (state.activePipeKey && state.activePipeKey !== modelKey) await releasePipe(state.activePipeKey);
    const pipe = await loadPipe(modelKey);
    state.activePipeKey = modelKey;
    clearTimeout(pipeIdleTimer);
    const messages = [{ role: 'system', content: systemPrompt(mode, modelKey) }];
    const isTiny = modelKey === 'tiny';
    // Telefonon és a két kis modellnél mintavétel nélkül generálunk: gyorsabb,
    // kevesebb a hibás/üres válasz, és kisebb a memóriahasználat.
    const greedy = isTiny || modelKey === 'lite' || phoneMode();
    // Az előzmények újrafeldolgozása telefonn nagyon drága: csak az utolsó üzenet kell.
    const history = phoneMode() ? 1 : (isTiny ? 2 : 6);
    chat.messages.slice(0, -2).slice(-history).forEach((m) => {
      messages.push({ role: m.role, content: m.content });
    });
    messages.push({ role: 'user', content: userText });

    if (isTiny && !state.tinyWarned) {
      state.tinyWarned = true;
      toast('A Szikra csak 135M paraméter: gyors, de magyarul hibás lehet. Jobb válaszhoz válassz Novát.', 'info');
    }

    // Magas hőmérséklet + hosszú generálás telefonon kifuthat a memóriából.
    const rawTemp = Number($('#chatTemp').value);
    const temperature = Math.min(Math.max(Number.isFinite(rawTemp) ? rawTemp : 0.3, 0), 1);
    let safeTemp = mode === 'code' ? Math.min(temperature, 0.4) : temperature;
    if (phoneMode()) safeTemp = Math.min(safeTemp, 0.5);
    // Nincs időzítő és nincs rejtett rövidítés: a modell addig ír, amíg a
    // felhasználó által beállított hosszúságú válasz el nem készül.
    const maxNewTokens = Math.min(Math.max(Number($('#chatTokens').value) || 128, 64), 512);

    const options = greedy
      ? {
          max_new_tokens: maxNewTokens,
          do_sample: false,
          repetition_penalty: 1.12,
        }
      : {
          max_new_tokens: maxNewTokens,
          do_sample: safeTemp > 0,
          temperature: Math.max(safeTemp, 0.01),
          top_p: 0.85,
          repetition_penalty: 1.08,
        };

    let result = '';
    try {
      result = await runChatGeneration(pipe, messages, options, chat, bubble, log, mode, modelKey);
    } catch (sampleErr) {
      if (!options.do_sample) throw sampleErr;
      // Egyes WebGPU/WASM hajtások a mintavételes generálást nem szeretik.
      // Determinista újrapróbálással a válasz még megmarad.
      console.warn('Mintavételes generálás hiba, újrapróbálás mintavétel nélkül:', sampleErr);
      const { temperature: _ignored, top_p: _ignoredTopP, ...fallback } = options;
      fallback.do_sample = false;
      fallback.max_new_tokens = maxNewTokens;
      chat.messages.at(-1).content = '…';
      if (bubble.isConnected) bubble.textContent = '…';
      result = await runChatGeneration(pipe, messages, fallback, chat, bubble, log, mode, modelKey);
      toast('A mintavétel nem működött, mintavétel nélkül válaszoltam.', 'info');
    }

    if (!result) {
      // Előfordul, hogy a modell csak gondolkodási jeleket ír ki. Ugyanakkora
      // hosszal, mintavétel nélkül újrapróbáljuk, hogy a válasz mégis megíródjon.
      console.warn('Üres válasz, újrapróbálás determinista generálással.');
      const { temperature: _t, top_p: _p, ...safe } = options;
      safe.do_sample = false;
      safe.max_new_tokens = maxNewTokens;
      safe.repetition_penalty = 1.05;
      chat.messages.at(-1).content = '…';
      if (bubble.isConnected) bubble.textContent = '…';
      result = await runChatGeneration(pipe, messages, safe, chat, bubble, log, mode, modelKey);
      if (result) toast('Az első kísérlet üres volt, mintavétel nélkül újrapróbáltam.', 'info');
    }

    if (!result) {
      throw new Error('A modell nem írt szöveget. Próbáld újra rövidebb kéréssel, vagy állítsd WASM módra a Settingsben.');
    }

    chat.messages.at(-1).content = result;
    bubble.textContent = '';
    renderFormatted(bubble, result, mode === 'code');
  } catch (err) {
    console.error(err);
    const message = `Hiba: ${err?.message || String(err)}. Ellenőrizd a Modellek fülön, hogy a modell le van-e töltve.`;
    chat.messages.at(-1).content = message;
    log.querySelector('.msg.assistant:last-child')?.classList.add('err');
    bubble.textContent = message;
    toast('A válasz generálása nem sikerült.', 'error');
  } finally {
    state.busyChat = false;
    sendBtn.disabled = false;
    sendBtn.textContent = 'Küldés';
    schedulePipeRelease();
    chat.updatedAt = Date.now();
    persistChats();
    renderChat();
    renderChatList();
  }
}

on('#chatForm', 'submit', (e) => { e.preventDefault(); sendChat(); });

function enterToSend(selector, formSelector) {
  $(selector).addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      $(formSelector).requestSubmit();
    }
  });
}
enterToSend('#chatInput', '#chatForm');

function updateComposerState() {
  const hasText = Boolean($('#chatInput').value.trim());
  $('.composer')?.classList.toggle('has-text', hasText);
}
on('#chatInput', 'input', updateComposerState);

function setComposerMenu(which) {
  const plusOpen = which === 'plus';
  const modelOpen = which === 'model';
  $('#plusMenu').hidden = !plusOpen;
  $('#modelMenu').hidden = !modelOpen;
  $('#plusBtn')?.setAttribute('aria-expanded', String(plusOpen));
  $('#modelBtn')?.setAttribute('aria-expanded', String(modelOpen));
}

// A csevegőmező gombján mindig a jelenleg használt modell neve látszik.
function syncModelButton() {
  const key = $('#chatModel')?.value || 'chat';
  const def = getDef(key);
  const label = $('#modelLabel');
  if (label) label.textContent = `${def.icon || '✨'} ${def.nick || key}`;
  const btn = $('#modelBtn');
  if (btn) btn.title = `Modell: ${def.label || key} — kattints a váltáshoz`;
}

// Csak csevegésre használható modellek. A saját Nexa HU itt mindig szerepel,
// így a felhasználó már a repo beállítása előtt is láthatja, hol lesz elérhető.
function renderModelMenu() {
  const menu = $('#modelMenu');
  if (!menu) return;
  const current = $('#chatModel')?.value || 'chat';
  menu.textContent = '';
  for (const key of Object.keys(MODEL_DEFS)) {
    const def = getDef(key);
    if (def.group !== 'Csevegés') continue;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.model = key;
    btn.classList.toggle('active', key === current);
    const detail = key === 'nexa' && !nexaRepo()
      ? 'saját modell – add meg a repót a Beállításokban'
      : def.label || key;
    btn.textContent = `${def.icon || '✨'} ${def.nick || key} — ${detail}`;
    menu.appendChild(btn);
  }
}

on('#plusBtn', 'click', (event) => {
  event.stopPropagation();
  const open = $('#plusMenu').hidden;
  setComposerMenu(open ? 'plus' : null);
  setProfileMenu(false);
});
on('#modelBtn', 'click', (event) => {
  event.stopPropagation();
  const open = $('#modelMenu').hidden;
  renderModelMenu();
  setComposerMenu(open ? 'model' : null);
  setProfileMenu(false);
});

$$('[data-plus]').forEach((btn) => btn.addEventListener('click', (event) => {
  event.stopPropagation();
  const action = btn.dataset.plus;
  setComposerMenu(null);
  if (action === 'new') newChat();
  else if (action === 'image') switchView('image');
  else if (action === 'voice') {
    switchView('voice');
    toast('Itt írod át beszédet szöveggé.', 'info');
  } else if (action === 'models') switchView('settings');
  else if (action === 'advanced') {
    const panel = $('#advancedPanel');
    panel.hidden = !panel.hidden;
    toast(panel.hidden ? 'Speciális beállítások elrejtve.' : 'Speciális beállítások megnyitva.', 'info');
  }
}));

on('#modelMenu', 'click', (event) => {
  const btn = event.target.closest('[data-model]');
  if (!btn) return;
  event.stopPropagation();
  setComposerMenu(null);
  selectChatModel(btn.dataset.model);
});

async function toggleMicToChat() {
  try {
    if (state.mic) {
      const samples = stopRecording();
      await transcribe(samples);
      const text = $('#asrResult').value.trim();
      if (!text) return;
      $('#chatInput').value = text;
      updateComposerState();
      $('#chatInput').focus();
      toast('A leírt szöveg beszúrva.', 'ok');
    } else {
      await startRecording();
      toast('Felvétel folyik… újabb kattintásra leírom.', 'info');
    }
  } catch (err) {
    console.error(err);
    toast(`Mikrofon hiba: ${err.message}`, 'error');
    if (state.mic) stopRecording();
  }
}
on('#micBtn', 'click', toggleMicToChat);
on('#voiceBtn', 'click', () => {
  if ($('#chatInput').value.trim()) return $('#chatForm').requestSubmit();
  toggleMicToChat();
});

switchView('chat');
syncChatHeader();
renderChat();
renderChatList();
updateComposerState();

/* ---------------------------- voice ----------------------------- */

function mergeAudio(chunks) {
  const length = chunks.reduce((sum, c) => sum + c.length, 0);
  const out = new Float32Array(length);
  let offset = 0;
  chunks.forEach((c) => { out.set(c, offset); offset += c.length; });
  return out;
}

async function startRecording() {
  if (state.mic) return;
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
  const source = ctx.createMediaStreamSource(stream);
  const processor = ctx.createScriptProcessor(4096, 1, 1);
  const chunks = [];
  processor.onaudioprocess = (e) => chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
  source.connect(processor);
  processor.connect(ctx.destination);
  state.mic = { stream, ctx, source, processor, chunks };
  $('#recBtn').textContent = '■ Felvétel leállítása';
  $('#recStatus').textContent = 'Felvétel folyik…';
}

function stopRecording() {
  if (!state.mic) return null;
  const { stream, ctx, source, processor, chunks } = state.mic;
  processor.disconnect();
  source.disconnect();
  stream.getTracks().forEach((t) => t.stop());
  ctx.close();
  state.mic = null;
  $('#recBtn').textContent = '● Felvétel indítása';
  $('#recStatus').textContent = 'Felvétel kész.';
  return mergeAudio(chunks);
}

on('#recBtn', 'click', async () => {
  try {
    if (state.mic) {
      const samples = stopRecording();
      await transcribe(samples);
    } else {
      await startRecording();
    }
  } catch (err) {
    console.error(err);
    toast(`Mikrofon hiba: ${err.message}`, 'error');
    if (state.mic) stopRecording();
  }
});

async function decodeAudioFile(file) {
  const buffer = await file.arrayBuffer();
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const decoded = await ctx.decodeAudioData(buffer);
  const data = decoded.getChannelData(0);
  await ctx.close();
  return data;
}

async function transcribe(audio) {
  if (!audio || audio.length === 0) return toast('Nincs hanganyag a felismeréshez.', 'info');
  $('#asrResult').value = 'Felismerés folyik…';
  try {
    const pipe = await loadPipe('asr');
    const output = await pipe(audio, {
      language: $('#asrLang').value,
      task: 'transcribe',
      chunk_length_s: 30,
      stride_length_s: 5,
    });
    const text = typeof output === 'string' ? output : output?.text || '';
    $('#asrResult').value = text;
    $('#recStatus').textContent = 'Kész.';
  } catch (err) {
    console.error(err);
    $('#asrResult').value = '';
    toast(`Felismerési hiba: ${err.message}`, 'error');
  }
}

on('#asrFile', 'change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  try { await transcribe(await decodeAudioFile(file)); }
  catch (err) { toast(`Hangfájl hiba: ${err.message}`, 'error'); }
  e.target.value = '';
});

on('#asrCopy', 'click', async () => {
  const text = $('#asrResult').value.trim();
  if (!text) return;
  await navigator.clipboard?.writeText(text);
  toast('Szöveg másolva.', 'ok');
});

on('#asrToChat', 'click', () => {
  const text = $('#asrResult').value.trim();
  if (!text) return;
  switchView('chat');
  $('#chatInput').value = text;
  $('#chatInput').focus();
});

async function warmVoiceFile(file) {
  const url = modelUrl(MODEL_DEFS.tts.model, file);
  const cache = await caches.open(env.cacheKey);
  if (await cache.match(url)) return;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Hangfájl letöltése sikertelen (${file})`);
  await cache.put(url, response.clone());
}

function encodeWav(samples, sampleRate) {
  const data = samples instanceof Float32Array ? samples : new Float32Array(samples);
  const buffer = new ArrayBuffer(44 + data.length * 2);
  const view = new DataView(buffer);
  const write = (offset, str) => { for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i)); };
  write(0, 'RIFF');
  view.setUint32(4, 36 + data.length * 2, true);
  write(8, 'WAVE');
  write(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, 'data');
  view.setUint32(40, data.length * 2, true);
  for (let i = 0; i < data.length; i++) {
    const s = Math.max(-1, Math.min(1, data[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

on('#ttsBtn', 'click', async () => {
  const text = $('#ttsText').value.trim();
  if (!text) return toast('Írj be szöveget a felolvasáshoz.', 'info');
  const btn = $('#ttsBtn');
  btn.disabled = true;
  btn.textContent = 'Létrehozás…';
  $('#ttsStatus').textContent = 'A modell betöltése / feldolgozás folyik…';
  try {
    const voice = $('#ttsVoice').value;
    await warmVoiceFile(`voices/${voice}.bin`);
    const pipe = await loadPipe('tts');
    const output = await pipe(text, {
      speaker_embeddings: modelUrl(MODEL_DEFS.tts.model, `voices/${voice}.bin`),
    });
    const audio = output?.audio ? output : output?.[0];
    const samples = audio?.audio;
    const rate = audio?.sampling_rate || 44100;
    if (!samples) throw new Error('A modell nem adott vissza hangot');
    if (state.ttsBlobUrl) URL.revokeObjectURL(state.ttsBlobUrl);
    state.ttsBlobUrl = URL.createObjectURL(encodeWav(samples, rate));
    $('#ttsAudio').src = state.ttsBlobUrl;
    $('#ttsAudio').hidden = false;
    $('#ttsDownload').disabled = false;
    $('#ttsStatus').textContent = `Kész (${(samples.length / rate).toFixed(1)} mp).`;
  } catch (err) {
    console.error(err);
    $('#ttsStatus').textContent = '';
    toast(`TTS hiba: ${err.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Beszéd létrehozása';
  }
});

on('#ttsDownload', 'click', () => {
  if (!state.ttsBlobUrl) return;
  const a = document.createElement('a');
  a.href = state.ttsBlobUrl;
  a.download = 'offline-ai-beszed.wav';
  a.click();
});

/* ---------------------------- image ----------------------------- */

function showPreview(input, previewSelector, stateKey) {
  const file = input.files?.[0];
  if (!file) return;
  state.files[stateKey] = file;
  const holder = $(previewSelector);
  holder.textContent = '';
  const img = document.createElement('img');
  img.src = URL.createObjectURL(file);
  img.alt = 'Kiválasztott kép';
  holder.appendChild(img);
}

on('#imgCaptionFile', 'change', (e) => showPreview(e.target, '#imgCaptionPreview', 'caption'));
on('#imgMatteFile', 'change', (e) => showPreview(e.target, '#imgMattePreview', 'matte'));
on('#vlmFile', 'change', (e) => showPreview(e.target, '#vlmPreview', 'vlm'));

function fileToUrl(file) {
  return URL.createObjectURL(file);
}

on('#captionBtn', 'click', async () => {
  const file = state.files.caption;
  if (!file) return toast('Először válassz képet.', 'info');
  const btn = $('#captionBtn');
  btn.disabled = true;
  btn.textContent = 'Feldolgozás…';
  $('#captionResult').value = 'A modell dolgozik…';
  try {
    const pipe = await loadPipe('caption');
    const output = await pipe(fileToUrl(file), { max_new_tokens: 64 });
    const text = Array.isArray(output) ? (output[0]?.generated_text ?? JSON.stringify(output[0])) : String(output);
    $('#captionResult').value = text;
  } catch (err) {
    console.error(err);
    $('#captionResult').value = '';
    toast(`Képfelismerési hiba: ${err.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Leírás készítése';
  }
});

function rawImageToCanvas(raw) {
  const canvas = document.createElement('canvas');
  canvas.width = raw.width;
  canvas.height = raw.height;
  const ctx = canvas.getContext('2d');
  const imageData = ctx.createImageData(raw.width, raw.height);
  const src = raw.data;
  const channels = raw.channels || 4;
  for (let i = 0; i < raw.width * raw.height; i++) {
    const si = i * channels;
    const di = i * 4;
    if (channels >= 4) {
      imageData.data[di] = src[si];
      imageData.data[di + 1] = src[si + 1];
      imageData.data[di + 2] = src[si + 2];
      imageData.data[di + 3] = src[si + 3];
    } else {
      const v = src[si];
      imageData.data[di] = v;
      imageData.data[di + 1] = v;
      imageData.data[di + 2] = v;
      imageData.data[di + 3] = 255;
    }
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

on('#matteBtn', 'click', async () => {
  const file = state.files.matte;
  if (!file) return toast('Először válassz képet.', 'info');
  const btn = $('#matteBtn');
  btn.disabled = true;
  btn.textContent = 'Feldolgozás…';
  try {
    const pipe = await loadPipe('matte');
    const output = await pipe(fileToUrl(file));
    const raw = Array.isArray(output) ? output[0] : output;
    const canvas = rawImageToCanvas(raw);
    if (state.matteUrl) URL.revokeObjectURL(state.matteUrl);
    state.matteUrl = canvas.toDataURL('image/png');
    const holder = $('#matteResult');
    holder.textContent = '';
    const img = document.createElement('img');
    img.src = state.matteUrl;
    img.alt = 'Háttér nélküli kép';
    holder.appendChild(img);
    $('#matteDownload').disabled = false;
  } catch (err) {
    console.error(err);
    toast(`Háttér eltávolítási hiba: ${err.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Háttér eltávolítása';
  }
});

on('#matteDownload', 'click', () => {
  if (!state.matteUrl) return;
  const a = document.createElement('a');
  a.href = state.matteUrl;
  a.download = 'offline-ai-hatter-nelkul.png';
  a.click();
});

on('#vlmBtn', 'click', async () => {
  const file = state.files.vlm;
  if (!file) return toast('Először válassz képet.', 'info');
  const question = $('#vlmQuestion').value.trim() || 'Describe this image.';
  const btn = $('#vlmBtn');
  btn.disabled = true;
  btn.textContent = '…';
  $('#vlmResult').value = 'A modell dolgozik…';
  try {
    const { processor, model } = await getVlm();
    const messages = [{
      role: 'user',
      content: [{ type: 'image' }, { type: 'text', text: question }],
    }];
    const promptText = processor.apply_chat_template(messages, { add_generation_prompt: true });
    const image = await load_image(fileToUrl(file));
    const inputs = await processor(image, promptText, { add_special_tokens: false });
    const outputs = await model.generate({
      ...inputs,
      do_sample: true,
      temperature: 0.2,
      top_k: 50,
      max_new_tokens: 160,
    });
    const generated = outputs.slice(null, [inputs.input_ids.dims.at(-1), null]);
    $('#vlmResult').value = processor.batch_decode(generated, { skip_special_tokens: true })[0];
  } catch (err) {
    console.error(err);
    $('#vlmResult').value = '';
    toast(`Képi modell hiba: ${err.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Kérdés';
  }
});

/* --------------------------- models ----------------------------- */

function setProgress(key, ratio, label) {
  const bar = document.querySelector(`[data-progress="${key}"]`);
  if (!bar) return;
  bar.classList.add('show');
  bar.querySelector('i').style.width = `${Math.min(100, Math.max(0, ratio * 100))}%`;
  const text = document.querySelector(`[data-progress-text="${key}"]`);
  if (text) text.textContent = label ? `${label} ${Math.round(ratio * 100)}%` : `${Math.round(ratio * 100)}%`;
}

async function estimateModel(key) {
  const def = getDef(key);
  const device = await resolveDevice();
  const dtype = await resolveDtype(key, device);
  const options = { device, dtype };

  if (navigator.onLine && !offlineMode && !def.special) {
    try {
      const files = await ModelRegistry.get_pipeline_files(def.task, def.model, options);
      const metas = await Promise.all(files.map((f) => ModelRegistry.get_file_metadata(def.model, f).catch(() => null)));
      const size = metas.reduce((sum, m) => sum + (m?.size || 0), 0);
      let cached = await ModelRegistry.is_pipeline_cached(def.task, def.model, options);
      if (def.extras) {
        for (const extra of def.extras) cached = cached && await isFileCached(def.model, extra);
      }
      return { size, cached, files: files.length };
    } catch (err) {
      console.warn('ModelRegistry nem elérhető:', key, err.message);
    }
  }

  let cached = false;
  for (const file of def.probes || [def.probe]) {
    if (await isFileCached(def.model, file)) { cached = true; break; }
  }
  if (def.extras) for (const extra of def.extras) cached = cached && await isFileCached(def.model, extra);
  return { size: def.sizeMB * 1024 * 1024, cached, files: null };
}

async function isModelCached(key) {
  // Nem szabad a ModelRegistry generally "cached" jelzésére hagyatkozni:
  // az néha csak a konfigfájlok alapján mond igent, és ilyenkor küldéskor
  // indult el egy 570 MB-os letöltés. Mindig a tényleges súlyfájlt nézzük.
  const def = getDef(key);
  for (const file of def.probes || [def.probe]) {
    if (await isFileCached(def.model, file)) return true;
  }
  return false;
}

// Csak olyan modellre váltsunk, amely tényleg a gyorsítótárban van.
async function findCachedChatModel() {
  for (const key of ['lite', 'tiny', 'chat', 'nexa']) {
    if (!modelDefs()[key]) continue;
    if (await isModelCached(key)) return key;
  }
  return null;
}

async function refreshModels() {
  const list = $('#modelList');
  if (!list) return;
  list.textContent = 'Az állapot ellenőrzése…';
  const entries = await Promise.all(Object.keys(modelDefs()).map(async (key) => [key, await estimateModel(key)]));
  state.modelInfo = Object.fromEntries(entries);

  list.textContent = '';
  Object.entries(modelDefs()).forEach(([key, def]) => {
    const info = state.modelInfo[key];
    const card = document.createElement('div');
    card.className = 'model-card';

    const head = document.createElement('div');
    head.className = 'model-card-head';
    const title = document.createElement('div');
    const h3 = document.createElement('h3');
    h3.textContent = `${def.icon ? def.icon + ' ' : ''}${def.nick}`;
    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = `${def.label} · ${def.group} · ${def.note} · ~${info.size ? formatBytes(info.size) : '?'}`;
    meta.title = def.model;
    title.append(h3, meta);
    const tag = document.createElement('span');
    tag.className = `tag ${info.cached ? 'ok' : 'wait'}`;
    tag.textContent = info.cached ? '✓ Elérhető offline' : 'Letöltés szükséges';
    head.append(title, tag);
    card.appendChild(head);

    const progress = document.createElement('div');
    progress.className = 'progress';
    progress.dataset.progress = key;
    progress.innerHTML = '<i></i>';
    card.appendChild(progress);
    const progressText = document.createElement('div');
    progressText.className = 'hint';
    progressText.dataset.progressText = key;
    card.appendChild(progressText);

    const actions = document.createElement('div');
    actions.className = 'model-actions';
    const dl = document.createElement('button');
    dl.className = 'btn btn-primary';
    dl.textContent = info.cached ? 'Újra letöltés' : 'Letöltés';
    dl.addEventListener('click', () => downloadModel(key));
    actions.appendChild(dl);

    if (info.cached) {
      const del = document.createElement('button');
      del.className = 'btn btn-ghost';
      del.textContent = 'Gyorsítótár törlése';
      del.addEventListener('click', async () => {
        try {
          await ModelRegistry.clear_pipeline_cache(def.task, def.model, {
            device: await resolveDevice(),
            dtype: await resolveDtype(key, await resolveDevice()),
          });
        } catch { /* régi modellnél nem elérhető */ }
        toast(`${def.nick} gyorsítótára törölve.`, 'ok');
        refreshModels();
      });
      actions.appendChild(del);
    }
    card.appendChild(actions);
    list.appendChild(card);
  });
}

async function downloadModel(key) {
  if (state.downloading.has(key)) return;
  const def = getDef(key);
  const btn = document.querySelector(`[data-progress="${key}"]`)?.parentElement?.querySelector('.btn-primary');
  state.downloading.add(key);
  if (btn) { btn.disabled = true; btn.textContent = 'Letöltés…'; }
  setProgress(key, 0, 'Indítás');
  try {
    // A telefon gyakran nem a hálózat, hanem a böngésző tárhelykorlátja miatt bukik meg.
    if (navigator.storage?.estimate) {
      const { usage = 0, quota = 0 } = await navigator.storage.estimate();
      const need = (state.modelInfo[key]?.size || def.sizeMB * 1048576) * 1.15;
      if (quota && usage + need > quota) {
        throw new Error(`Nincs elég tárhely (~${formatBytes(need)} kell). Törölj egy másik modellt, vagy válassz kisebbet.`);
      }
    }
    if (def.extras) for (const extra of def.extras) await warmVoiceFile(extra);
    const pipeKey = def.special ? 'vlm' : key;
    const alreadyLoaded = state.pipes.has(pipeKey);
    if (!alreadyLoaded) {
      let pipe;
      if (def.special) pipe = await getVlm((ratio, label) => setProgress(key, ratio, label));
      else pipe = await loadPipe(key, (ratio, label) => setProgress(key, ratio, label));
      setProgress(key, 1, 'Kész');

      // A modell a gyorsítótárban marad, de a memóriát felszabadítjuk.
      // Ha épp használatban van, nem szabad dispose-olni.
      if (def.special) await pipe.model.dispose?.();
      else await pipe.dispose?.();
      state.pipes.delete(pipeKey);
      if (state.activePipeKey === pipeKey) state.activePipeKey = null;
    } else {
      setProgress(key, 1, 'Már betöltve');
    }
    toast(`${def.nick} készen áll offline használatra.`, 'ok');
  } catch (err) {
    console.error(err);
    setProgress(key, 0, 'Hiba');
    toast(`${def.nick}: ${err?.message || String(err)}`, 'error');
  } finally {
    state.downloading.delete(key);
    refreshModels();
  }
}

on('#downloadAll', 'click', async () => {
  if (state.downloading.size) return toast('Már folyik egy modell letöltése.', 'info');
  const btn = $('#downloadAll');
  btn.disabled = true;
  btn.textContent = 'Letöltés folyik…';
  // Telefonon a két nagy modell (Nova, Forge) gyakran nem fér el és percekig tart.
  // Ezeket egyenként lehet letölteni; az alap csomag így is teljesen használható.
  const keys = Object.keys(modelDefs()).filter((key) => !(phoneMode() && (key === 'chat' || key === 'code')));
  for (const key of keys) {
    await downloadModel(key);
  }
  btn.disabled = false;
  btn.textContent = 'Összes letöltése';
  toast(phoneMode()
    ? 'Kész. A nagy Nova/Forge modellt nem töltöttem le automatikusan — egyenként választhatod.'
    : 'Az összes modell letöltése befejeződött.', 'ok');
});

async function warmRuntime() {
  try {
    const cache = await caches.open(SHELL_CACHE);
    for (const file of RUNTIME_FILES) {
      const url = new URL(`./vendor/ort/${file}`, import.meta.url).href;
      if (!(await cache.match(url))) await cache.add(url);
    }
    $('#statRuntime').textContent = 'Előkészítve';
  } catch (err) {
    console.warn('Runtime warmup failed:', err);
    $('#statRuntime').textContent = 'WASM igény szerint';
  }
}

async function updateStats() {
  const online = navigator.onLine;
  $('#netBadge').textContent = online ? '● Online' : '● Offline';
  $('#netBadge').className = `badge ${online ? 'badge-online' : 'badge-offline'}`;
  $('#statNet').textContent = offlineMode ? 'Szigorú offline' : online ? 'Online' : 'Offline';
  try {
    const estimate = await navigator.storage.estimate();
    $('#statStorage').textContent = `${formatBytes(estimate.usage || 0)} / ${formatBytes(estimate.quota || 0)}`;
  } catch { $('#statStorage').textContent = '–'; }
  try {
    const keys = await caches.keys();
    $('#statCache').textContent = `${keys.length} gyorsítótár`;
  } catch { $('#statCache').textContent = '–'; }
}

window.addEventListener('online', updateStats);
window.addEventListener('offline', updateStats);

on('#offlineToggle', 'change', (e) => {
  const value = e.target.checked;
  localStorage.setItem('offline', value ? '1' : '0');
  offlineMode = value;
  env.allowRemoteModels = !value;
  env.allowLocalModels = value;
  toast(value ? 'Szigorú offline mód bekapcsolva.' : 'Hálózati letöltés engedélyezve.', 'info');
  refreshModels();
});

$('#deviceSelect').value = localStorage.getItem('device') || 'auto';
$('#dtypeSelect').value = localStorage.getItem('dtype') || 'auto';
on('#deviceSelect', 'change', (e) => {
  localStorage.setItem('device', e.target.value);
  updateDeviceHint();
});
on('#dtypeSelect', 'change', (e) => {
  localStorage.setItem('dtype', e.target.value);
  updateDeviceHint();
});

// Saját modell: mindig választható, de a repo csak megadása után használható.
function syncNexaOption() {
  const select = $('#chatModel');
  const option = select?.querySelector('option[value="nexa"]');
  if (option) {
    option.hidden = false;
    option.textContent = nexaRepo()
      ? `🧠 Nexa HU · saját modell (${nexaRepo()})`
      : '🧠 Nexa HU · saját modell (repo beállítása szükséges)';
  }
  if (select && select.value === 'nexa' && !nexaRepo()) {
    const previous = localStorage.getItem('chatModel');
    commitChatModel(previous && previous !== 'nexa' ? previous : (phoneMode() ? 'lite' : 'chat'));
  }
  syncModelButton();
  renderModelMenu();
}
const nexaInput = $('#nexaRepo');
if (nexaInput) {
  nexaInput.value = nexaRepo();
  syncNexaOption();
  on('#nexaRepo', 'change', () => {
    localStorage.setItem(NEXA_REPO_KEY, nexaInput.value.trim());
    state.pipes.delete('nexa');
    syncNexaOption();
    refreshModels();
    toast(nexaRepo() ? 'Saját Nexa modell bekapcsolva.' : 'Saját Nexa modell kikapcsolva.', 'info');
  });
}

function updateDeviceHint() {
  const device = $('#deviceSelect').value;
  const gpu = Boolean(navigator.gpu);
  let text = gpu ? 'WebGPU elérhető ebben a böngészőben.' : 'WebGPU nem elérhető – WASM/CPU mód lesz használva.';
  if (device === 'webgpu' && !gpu) text = 'A WebGPU nem támogatott, ezért a rendszer WASM-ra vált.';
  text += ' A pontosság felülírása csak a nyelvi modellekre vonatkozik. A q4f16 kisebb, de egyes WebGPU-megvalósításokon hibás kimenetet adhat – ilyenkor válassz q4-et vagy WASM-ot.';
  $('#deviceHint').textContent = text;
}

/* --------------------------- kinézet ----------------------------- */

async function makeBackgroundDataUrl(file) {
  const maxSide = 1280;
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    return canvas.toDataURL('image/jpeg', 0.72);
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.72));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('A kép nem olvasható be.')); };
    img.src = url;
  });
}

function applyAppearance() {
  const skin = localStorage.getItem('skin') || 'obsidian';
  const wall = localStorage.getItem('wall') || 'none';
  const dim = Number(localStorage.getItem('bgDim') ?? 72);
  const blur = Number(localStorage.getItem('bgBlur') ?? 0);
  const image = localStorage.getItem('bgImage');
  const root = document.documentElement;

  root.dataset.skin = skin;
  const workspace = $('.workspace');
  if (workspace) workspace.dataset.wall = wall;
  root.style.setProperty('--wall-bright', String(Math.max(0.2, 1 - (dim / 100) * 0.8)));
  root.style.setProperty('--bg-blur', `${Math.min(12, Math.max(0, blur))}px`);
  if (image) root.style.setProperty('--user-bg', `url("${image}")`);
  else root.style.removeProperty('--user-bg');

  $$('.skin-btn').forEach((btn) => btn.classList.toggle('active', btn.dataset.skin === skin));
  $$('.wall-btn').forEach((btn) => btn.classList.toggle('active', btn.dataset.wall === wall));
  if ($('#bgDim')) $('#bgDim').value = String(dim);
  if ($('#bgDimOut')) $('#bgDimOut').textContent = `${dim}%`;
  if ($('#bgBlur')) $('#bgBlur').value = String(blur);
  if ($('#bgBlurOut')) $('#bgBlurOut').textContent = `${blur} px`;

  const preview = $('#bgPreview');
  if (preview) {
    preview.textContent = '';
    preview.style.backgroundImage = image ? `url("${image}")` : '';
    if (!image) {
      const span = document.createElement('span');
      span.textContent = 'Nincs egyedi háttér';
      preview.appendChild(span);
    }
  }
}

$$('.skin-btn').forEach((btn) => on(btn, 'click', () => {
  localStorage.setItem('skin', btn.dataset.skin);
  applyAppearance();
  toast(`Kinézet: ${btn.querySelector('b')?.textContent || btn.dataset.skin}`, 'ok');
}));

$$('.wall-btn').forEach((btn) => on(btn, 'click', () => {
  localStorage.setItem('wall', btn.dataset.wall);
  applyAppearance();
  toast(`Háttér: ${btn.textContent}`, 'ok');
}));

on('#bgFile', 'change', async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const dataUrl = await makeBackgroundDataUrl(file);
    localStorage.setItem('bgImage', dataUrl);
    localStorage.setItem('wall', 'custom');
    applyAppearance();
    toast('Saját háttér beállítva. A kép csak ezen az eszközön van tárolva.', 'ok');
  } catch (err) {
    console.error(err);
    toast(`A háttér nem állítható be: ${err.message}`, 'error');
  }
  event.target.value = '';
});

on('#bgClear', 'click', () => {
  localStorage.removeItem('bgImage');
  localStorage.setItem('wall', 'none');
  applyAppearance();
  toast('Egyedi háttér törölve.', 'ok');
});

on('#bgDim', 'input', (event) => {
  localStorage.setItem('bgDim', event.target.value);
  applyAppearance();
});
on('#bgBlur', 'input', (event) => {
  localStorage.setItem('bgBlur', event.target.value);
  applyAppearance();
});

applyAppearance();

on('#clearCacheBtn', 'click', async () => {
  if (!confirm('Biztosan törlöd az összes letöltött modellt? Ez nem vonható vissza.')) return;
  const keys = await caches.keys();
  await Promise.all(keys.filter((k) => k.startsWith('transformers-cache')).map((k) => caches.delete(k)));
  state.pipes.clear();
  toast('Modellek gyorsítótára törölve.', 'ok');
  refreshModels();
});

updateDeviceHint();
updateStats();
warmRuntime().then(updateStats);
