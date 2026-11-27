// Offline AI Stúdió — service worker
// Az alkalmazás "héját" (HTML/CSS/JS/könyvtárak) előre gyorsítótárazza.
// A modelleket a Transformers.js saját Cache Storage-be menti; ezt az app.js kezeli.

const VERSION = 'offline-ai-v1.5.7';
const SHELL_CACHE = `${VERSION}-shell`;

const SHELL = [
  './',
  './index.html',
  './styles.css?v=1.5.7',
  './app.js?v=1.5.7',
  './backgrounds/aurora.svg',
  './backgrounds/dusk.svg',
  './backgrounds/forest.svg',
  './backgrounds/graphite.svg',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './vendor/transformers/transformers.web.min.js',
  './vendor/ort/ort.webgpu.bundle.min.mjs',
  './vendor/onnxruntime-common/dist/esm/index.js',
  './vendor/onnxruntime-common/dist/esm/backend.js',
  './vendor/onnxruntime-common/dist/esm/backend-impl.js',
  './vendor/onnxruntime-common/dist/esm/env.js',
  './vendor/onnxruntime-common/dist/esm/env-impl.js',
  './vendor/onnxruntime-common/dist/esm/inference-session.js',
  './vendor/onnxruntime-common/dist/esm/inference-session-impl.js',
  './vendor/onnxruntime-common/dist/esm/onnx-model.js',
  './vendor/onnxruntime-common/dist/esm/onnx-value.js',
  './vendor/onnxruntime-common/dist/esm/tensor.js',
  './vendor/onnxruntime-common/dist/esm/tensor-conversion.js',
  './vendor/onnxruntime-common/dist/esm/tensor-conversion-impl.js',
  './vendor/onnxruntime-common/dist/esm/tensor-factory.js',
  './vendor/onnxruntime-common/dist/esm/tensor-factory-impl.js',
  './vendor/onnxruntime-common/dist/esm/tensor-impl.js',
  './vendor/onnxruntime-common/dist/esm/tensor-impl-type-mapping.js',
  './vendor/onnxruntime-common/dist/esm/tensor-utils.js',
  './vendor/onnxruntime-common/dist/esm/tensor-utils-impl.js',
  './vendor/onnxruntime-common/dist/esm/trace.js',
  './vendor/onnxruntime-common/dist/esm/type-helper.js',
  './vendor/onnxruntime-common/dist/esm/version.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith('offline-ai-') && key !== SHELL_CACHE)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // A Hugging Face és más külső kéréseket a Transformers.js saját cache-e kezeli.
  if (url.origin !== self.location.origin) return;
  // Az APK-t mindig frissen kell letölteni, különben a régi verziót adná ki a cache.
  if (url.pathname.endsWith('.apk')) return;

  // Az oldal mindig friss HTML-t kér; offline esetén a gyorsítótár marad.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const copy = response.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put(req, copy)).catch(() => {});
        }
        return response;
      }).catch(async () => (await caches.match(req)) || caches.match('./index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const copy = response.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put(req, copy)).catch(() => {});
        }
        return response;
      });
    })
  );
});
