// 앱 코드를 고친 뒤에는 아래 버전 숫자를 올려 주세요 (v1 → v2). 그래야 폰에 새 버전이 반영돼요.
const CACHE = 'gyeolsim-v23';
const ASSETS = ['./', './index.html', './manifest.json', './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png', './data/cards.json', './data/videos.json'];

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
      fetch(req, { cache: 'no-store' }).then(res => { // 브라우저 캐시 말고 항상 최신 페이지
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put('./index.html', copy));
        return res;
      }).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // 포토카드·영상 목록은 네트워크 우선 (검수해서 바뀌면 바로 반영), 오프라인이면 캐시
  if (new URL(req.url).pathname.includes('/data/')) {
    e.respondWith(fetch(req, { cache: 'no-store' }).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req.url.split('?')[0], copy)); }
      return res;
    }).catch(() => caches.match(req.url.split('?')[0])));
    return;
  }

  // 나머지(아이콘 등)는 캐시 우선
  e.respondWith(caches.match(req).then(hit => hit || fetch(req)));
});

// 코치 알림 (push 서버가 보낸 메시지 표시)
self.addEventListener('push', e => {
  let msg = {};
  try { msg = e.data ? e.data.json() : {}; } catch (err) { msg = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(msg.title || 'gyeolsim', {
    body: msg.body || '오늘 할 일을 확인해 볼까?',
    icon: './icons/icon-192.png',
    badge: './icons/icon-192.png',
    tag: 'coach'
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) if ('focus' in c) return c.focus();
    return self.clients.openWindow('./');
  }));
});
