// 앱 코드를 고친 뒤에는 아래 버전 숫자를 올려 주세요 (v1 → v2). 그래야 폰에 새 버전이 반영돼요.
const CACHE = 'gyeolsim-v12';
const ASSETS = ['./', './index.html', './manifest.json', './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;

  // 페이지는 네트워크 우선(새 버전 반영), 오프라인이면 캐시
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put('./index.html', copy));
        return res;
      }).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // 나머지(아이콘 등)는 캐시 우선
  e.respondWith(caches.match(req).then(hit => hit || fetch(req)));
});
