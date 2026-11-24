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
const SHELL_CACHE = 'offline-ai-v1.0.7-shell';

const MODEL_DEFS = {
  tiny: {
    group: 'Csevegés', label: 'SmolLM2 135M Instruct', task: 'text-generation',
    model: 'onnx-community/SmolLM2-135M-Instruct-ONNX',
    web: 'q4', wasm: 'q4', sizeMB: 172, override: true,
    probes: ['onnx/model_q4f16.onnx', 'onnx/model_q4.onnx'],
    probe: 'onnx/model_q4f16.onnx',
    note: 'Nagyon gyors, kevés tárhely – egyszerűbb kérdésekre jó.',
  },
  chat: {
    group: 'Csevegés', label: 'Qwen3 0.6B', task: 'text-generation',
    model: 'onnx-community/Qwen3-0.6B-ONNX',
    web: 'q4', wasm: 'q4', sizeMB: 880, override: true,
    probes: ['onnx/model_q4f16.onnx', 'onnx/model_q4.onnx'],
    probe: 'onnx/model_q4f16.onnx',
    note: 'Jobb minőségű magyar és általános válaszok.',
  },
  code: {
    group: 'Kód', label: 'Qwen2.5-Coder 0.5B', task: 'text-generation',
    model: 'onnx-community/Qwen2.5-Coder-0.5B-Instruct',
    web: 'q4', wasm: 'q4', sizeMB: 822, override: true,
    probes: ['onnx/model_q4f16.onnx', 'onnx/model_q4.onnx'],
    probe: 'onnx/model_q4f16.onnx',
    note: 'Kódírásra és magyarázatra hangolva.',
  },
  asr: {
    group: 'Hang', label: 'Whisper Tiny', task: 'automatic-speech-recognition',
    model: 'onnx-community/whisper-tiny',
    web: 'q8', wasm: 'q8', sizeMB: 45,
    probe: 'onnx/encoder_model_quantized.onnx',
    note: 'Beszéd szöveggé alakítása, több nyelven.',
  },
  tts: {
    group: 'Hang', label: 'Supertonic TTS', task: 'text-to-speech',
    model: 'onnx-community/Supertonic-TTS-ONNX',
    web: 'fp32', wasm: 'fp32', sizeMB: 260,
    probe: 'onnx/text_encoder.onnx',
    extras: ['voices/F1.bin'],
    note: 'Természetes angol beszéd, 10 hanggal.',
  },
  caption: {
    group: 'Kép', label: 'Képleíró / OCR', task: 'image-to-text',
    model: 'Xenova/vit-gpt2-image-captioning',
    web: 'q8', wasm: 'q8', sizeMB: 190,
    probe: 'onnx/decoder_model_merged_quantized.onnx',
    note: 'Leírja a képet és felismeri a nyomtatott szöveget.',
  },
  matte: {
    group: 'Kép', label: 'Háttér eltávolító', task: 'background-removal',
    model: 'Xenova/modnet',
    web: 'q8', wasm: 'q8', sizeMB: 25,
    probe: 'onnx/model_quantized.onnx',
    note: 'Portré hátterét átlátszóvá teszi.',
  },
  vlm: {
    group: 'Kép', label: 'LFM2.5-VL 450M', task: 'image-text-to-text',
    model: 'onnx-community/LFM2.5-VL-450M-ONNX',
    web: 'q4', wasm: 'q4', sizeMB: 350,
    probe: 'onnx/decoder_model_merged_q4.onnx_data',
    special: true,
    note: 'Kérdezz a képről (angol kérdésekkel).',
  },
};

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
  hu: 'Te egy segítőkész magyar nyelvű asszisztens vagy. Rövid, világos és pontos válaszokat adj magyarul. Ha nem tudod a választ, őszintén mondd meg.',
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

const state = {
  pipes: new Map(),
  chats: { chat: [], code: [] },
  modelInfo: {},
  busyChat: false,
  busyCode: false,
  mic: null,
  ttsBlobUrl: null,
  matteUrl: null,
  files: { caption: null, matte: null, vlm: null },
  deferredPrompt: null,
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

let offlineMode = localStorage.getItem('offline') === '1';
$('#offlineToggle').checked = offlineMode;
env.allowRemoteModels = !offlineMode;

const theme = localStorage.getItem('theme') || 'dark';
document.documentElement.dataset.theme = theme;

state.chats.chat = loadJSON('offline-ai-chat', []);
state.chats.code = loadJSON('offline-ai-code', []);

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
  return (typeof navigator !== 'undefined' && navigator.gpu) ? 'webgpu' : 'wasm';
}

async function resolveDtype(key, device) {
  const def = MODEL_DEFS[key];
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
  const def = MODEL_DEFS[key];
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
      dtype = def.wasm === 'q4f16' ? 'q4' : def.wasm;
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

function switchView(name) {
  $$('.nav-item').forEach((b) => b.classList.toggle('active', b.dataset.view === name));
  $$('.view').forEach((v) => v.classList.toggle('active', v.id === `view-${name}`));
  if (name === 'models') refreshModels();
}

$$('.nav-item').forEach((btn) => btn.addEventListener('click', () => switchView(btn.dataset.view)));

$('#themeBtn').addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  localStorage.setItem('theme', next);
});

$('#chatTemp').addEventListener('input', (e) => { $('#tempOut').textContent = e.target.value; });
$('#chatTokens').addEventListener('input', (e) => { $('#tokensOut').textContent = e.target.value; });

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  state.deferredPrompt = event;
  $('#installBtn').hidden = false;
});
$('#installBtn').addEventListener('click', async () => {
  if (!state.deferredPrompt) return toast('A böngésző nem támogatja a telepítést.', 'info');
  state.deferredPrompt.prompt();
  await state.deferredPrompt.userChoice;
  state.deferredPrompt = null;
  $('#installBtn').hidden = true;
});

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
      pre.style.cssText = 'background:var(--surface-3);padding:10px;border-radius:8px;overflow:auto;white-space:pre-wrap';
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

function renderChat(kind) {
  const log = $(kind === 'chat' ? '#chatLog' : '#codeLog');
  log.textContent = '';
  const messages = state.chats[kind];
  if (!messages.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = kind === 'chat'
      ? 'Írj egy üzenetet, és a modell itt, a készülékeden válaszol. ✨'
      : 'Példa: „Írj egy függvényt, ami kiveszi az ékezetes betűket egy szövegből.”';
    log.appendChild(empty);
    return;
  }
  messages.forEach((msg) => {
    const row = document.createElement('div');
    row.className = `msg ${msg.role === 'user' ? 'user' : 'assistant'}`;
    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    avatar.textContent = msg.role === 'user' ? '🙂' : kind === 'code' ? '⌘' : '◈';
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    renderFormatted(bubble, msg.content, kind === 'code');
    row.append(avatar, bubble);
    log.appendChild(row);
  });
  log.scrollTop = log.scrollHeight;
}

$('#chatClear').addEventListener('click', () => {
  state.chats.chat = [];
  saveJSON('offline-ai-chat', []);
  renderChat('chat');
});
$('#codeClear').addEventListener('click', () => {
  state.chats.code = [];
  saveJSON('offline-ai-code', []);
  renderChat('code');
});

function systemPrompt(kind) {
  if (kind === 'code') {
    const mode = CODE_STYLES[$('#codeMode').value] || CODE_STYLES.write;
    const lang = $('#codeLang').value;
    return `${mode} A programozási nyelv: ${lang}. Válasz magyarul, röviden.`;
  }
  return CHAT_STYLES[$('#chatStyle').value] || CHAT_STYLES.hu;
}

async function sendChat(kind, text, overrideModelKey) {
  const busyKey = kind === 'chat' ? 'busyChat' : 'busyCode';
  if (state[busyKey]) return toast('A modell még dolgozik, várj egy pillanatot.', 'info');
  const input = $(kind === 'chat' ? '#chatInput' : '#codeInput');
  const userText = (text ?? input.value).trim();
  if (!userText) return;

  state[busyKey] = true;
  const sendBtn = $(kind === 'chat' ? '#chatSend' : '#codeSend');
  sendBtn.disabled = true;
  sendBtn.textContent = '…';
  input.value = '';

  state.chats[kind].push({ role: 'user', content: userText, ts: Date.now() });
  state.chats[kind].push({ role: 'assistant', content: '…', ts: Date.now() });
  renderChat(kind);

  const log = $(kind === 'chat' ? '#chatLog' : '#codeLog');
  const bubble = log.querySelector('.msg.assistant:last-child .bubble');
  const modelKey = overrideModelKey || (kind === 'code' ? 'code' : $('#chatModel').value);

  try {
    const pipe = await loadPipe(modelKey);
    const messages = [{ role: 'system', content: systemPrompt(kind) }];
    state.chats[kind].slice(0, -2).slice(-8).forEach((m) => {
      messages.push({ role: m.role, content: m.content });
    });
    messages.push({ role: 'user', content: userText });

    const maxNewTokens = kind === 'chat' ? Number($('#chatTokens').value) : 384;
    const temperature = kind === 'chat' ? Number($('#chatTemp').value) : 0.2;
    const streamer = new TextStreamer(pipe.tokenizer, {
      skip_prompt: true,
      skip_special_tokens: true,
      callback_function: (chunk) => {
        if (!bubble.isConnected) return;
        const current = state.chats[kind].at(-1);
        current.content = stripThink((current.content === '…' ? '' : current.content) + chunk);
        bubble.textContent = current.content;
        log.scrollTop = log.scrollHeight;
      },
    });

    const output = await pipe(messages, {
      max_new_tokens: maxNewTokens,
      do_sample: temperature > 0,
      temperature: Math.max(temperature, 0.01),
      top_p: 0.9,
      repetition_penalty: 1.05,
      enable_thinking: false,
      streamer,
    });

    let result = output?.[0]?.generated_text;
    if (Array.isArray(result)) result = result.at(-1)?.content;
    if (typeof result !== 'string') result = JSON.stringify(result ?? '');
    result = stripThink(result) || '(Üres válasz)';

    state.chats[kind].at(-1).content = result;
    bubble.textContent = '';
    renderFormatted(bubble, result, kind === 'code');
    saveJSON(kind === 'chat' ? 'offline-ai-chat' : 'offline-ai-code', state.chats[kind]);
  } catch (err) {
    console.error(err);
    const message = `Hiba: ${err?.message || String(err)}. Ellenőrizd a Modellek fülön, hogy a modell le van-e töltve.`;
    state.chats[kind].at(-1).content = message;
    log.querySelector('.msg.assistant:last-child')?.classList.add('err');
    bubble.textContent = message;
    toast('A modell betöltése nem sikerült.', 'error');
  } finally {
    state[busyKey] = false;
    sendBtn.disabled = false;
    sendBtn.textContent = 'Küldés';
    renderChat(kind);
  }
}

$('#chatForm').addEventListener('submit', (e) => { e.preventDefault(); sendChat('chat'); });
$('#codeForm').addEventListener('submit', (e) => { e.preventDefault(); sendChat('code'); });

function enterToSend(selector, formSelector) {
  $(selector).addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      $(formSelector).requestSubmit();
    }
  });
}
enterToSend('#chatInput', '#chatForm');
enterToSend('#codeInput', '#codeForm');

renderChat('chat');
renderChat('code');

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

$('#recBtn').addEventListener('click', async () => {
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

$('#asrFile').addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  try { await transcribe(await decodeAudioFile(file)); }
  catch (err) { toast(`Hangfájl hiba: ${err.message}`, 'error'); }
  e.target.value = '';
});

$('#asrCopy').addEventListener('click', async () => {
  const text = $('#asrResult').value.trim();
  if (!text) return;
  await navigator.clipboard?.writeText(text);
  toast('Szöveg másolva.', 'ok');
});

$('#asrToChat').addEventListener('click', () => {
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

$('#ttsBtn').addEventListener('click', async () => {
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

$('#ttsDownload').addEventListener('click', () => {
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

$('#imgCaptionFile').addEventListener('change', (e) => showPreview(e.target, '#imgCaptionPreview', 'caption'));
$('#imgMatteFile').addEventListener('change', (e) => showPreview(e.target, '#imgMattePreview', 'matte'));
$('#vlmFile').addEventListener('change', (e) => showPreview(e.target, '#vlmPreview', 'vlm'));

function fileToUrl(file) {
  return URL.createObjectURL(file);
}

$('#captionBtn').addEventListener('click', async () => {
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

$('#matteBtn').addEventListener('click', async () => {
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

$('#matteDownload').addEventListener('click', () => {
  if (!state.matteUrl) return;
  const a = document.createElement('a');
  a.href = state.matteUrl;
  a.download = 'offline-ai-hatter-nelkul.png';
  a.click();
});

$('#vlmBtn').addEventListener('click', async () => {
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
  const def = MODEL_DEFS[key];
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

async function refreshModels() {
  const list = $('#modelList');
  list.textContent = 'Az állapot ellenőrzése…';
  const entries = await Promise.all(Object.keys(MODEL_DEFS).map(async (key) => [key, await estimateModel(key)]));
  state.modelInfo = Object.fromEntries(entries);

  list.textContent = '';
  Object.entries(MODEL_DEFS).forEach(([key, def]) => {
    const info = state.modelInfo[key];
    const card = document.createElement('div');
    card.className = 'model-card';

    const head = document.createElement('div');
    head.className = 'model-card-head';
    const title = document.createElement('div');
    const h3 = document.createElement('h3');
    h3.textContent = def.label;
    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = `${def.group} · ${def.note} · ~${info.size ? formatBytes(info.size) : '?'} · ${def.model}`;
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
        toast(`${def.label} gyorsítótára törölve.`, 'ok');
        refreshModels();
      });
      actions.appendChild(del);
    }
    card.appendChild(actions);
    list.appendChild(card);
  });
}

async function downloadModel(key) {
  const def = MODEL_DEFS[key];
  const btn = document.querySelector(`[data-progress="${key}"]`)?.parentElement?.querySelector('.btn-primary');
  if (btn) { btn.disabled = true; btn.textContent = 'Letöltés…'; }
  setProgress(key, 0, 'Indítás');
  try {
    if (def.extras) for (const extra of def.extras) await warmVoiceFile(extra);
    let pipe;
    if (def.special) pipe = await getVlm((ratio, label) => setProgress(key, ratio, label));
    else pipe = await loadPipe(key, (ratio, label) => setProgress(key, ratio, label));
    setProgress(key, 1, 'Kész');

    // A modell a gyorsítótárban marad, de a memóriát felszabadítjuk.
    if (def.special) {
      await pipe.model.dispose?.();
      state.pipes.delete('vlm');
    } else {
      await pipe.dispose?.();
      state.pipes.delete(key);
    }
    toast(`${def.label} készen áll offline használatra.`, 'ok');
  } catch (err) {
    console.error(err);
    setProgress(key, 0, 'Hiba');
    toast(`${def.label}: ${err.message}`, 'error');
  } finally {
    refreshModels();
  }
}

$('#downloadAll').addEventListener('click', async () => {
  const btn = $('#downloadAll');
  btn.disabled = true;
  btn.textContent = 'Letöltés folyik…';
  for (const key of Object.keys(MODEL_DEFS)) {
    await downloadModel(key);
  }
  btn.disabled = false;
  btn.textContent = 'Összes letöltése';
  toast('Az összes modell letöltése befejeződött.', 'ok');
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

$('#offlineToggle').addEventListener('change', (e) => {
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
$('#deviceSelect').addEventListener('change', (e) => {
  localStorage.setItem('device', e.target.value);
  updateDeviceHint();
});
$('#dtypeSelect').addEventListener('change', (e) => {
  localStorage.setItem('dtype', e.target.value);
  updateDeviceHint();
});

function updateDeviceHint() {
  const device = $('#deviceSelect').value;
  const gpu = Boolean(navigator.gpu);
  let text = gpu ? 'WebGPU elérhető ebben a böngészőben.' : 'WebGPU nem elérhető – WASM/CPU mód lesz használva.';
  if (device === 'webgpu' && !gpu) text = 'A WebGPU nem támogatott, ezért a rendszer WASM-ra vált.';
  text += ' A pontosság felülírása csak a nyelvi modellekre vonatkozik. A q4f16 kisebb, de egyes WebGPU-megvalósításokon hibás kimenetet adhat – ilyenkor válassz q4-et vagy WASM-ot.';
  $('#deviceHint').textContent = text;
}

$('#clearCacheBtn').addEventListener('click', async () => {
  if (!confirm('Biztosan törlöd az összes letöltött modellt? Ez nem vonható vissza.')) return;
  const keys = await caches.keys();
  await Promise.all(keys.filter((k) => k.startsWith('transformers-cache')).map((k) => caches.delete(k)));
  state.pipes.clear();
  toast('Modellek gyorsítótára törölve.', 'ok');
  refreshModels();
});

updateDeviceHint();
updateStats();
warmRuntime().then(refreshModels);
