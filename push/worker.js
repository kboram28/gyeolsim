// gyeolsim 코치 알림 서버 (Cloudflare Worker)
// - 앱이 열릴 때 오늘·내일 보낼 알림 목록을 POST /schedule 로 맡김
// - 5분마다 cron이 돌면서 시간이 된 알림을 Web Push로 보냄
// 비밀값: VAPID_PRIVATE_JWK (wrangler secret), 저장소: KV 바인딩 PUSH

const ALLOWED_ORIGINS = ['https://kboram28.github.io'];
const VAPID_PUBLIC = 'BIxOlEIR5pyobxPwy3sUNw_pffZJdHeWwA9Rv0X6hR1EvMwC1I5V6ADAKA7sWlCnfSQ-0FalW2P0tvyaNMR0Hg4';
const VAPID_SUB = 'https://kboram28.github.io/gyeolsim/';
const MAX_ITEMS = 30;
const STALE_MS = 30 * 60 * 1000; // 30분 넘게 늦어진 알림은 버림
const YT_CHANNEL = 'UC6pfHZyVjLQ0k-7BvDkAFfQ'; // 김결 @Gyeol_Kim
const VIDEOS_TTL = 30 * 60; // 새 영상 목록은 30분 동안 캐시

export default {
  async fetch(req, env) {
    const origin = req.headers.get('Origin') || '';
    const cors = {
      'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Vary': 'Origin'
    };
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
    if (req.method === 'GET' && new URL(req.url).pathname === '/videos') return videos(req, cors);
    if (req.method !== 'POST') return json({ ok: true, service: 'gyeolsim-push' });

    let body;
    try { body = await req.json(); } catch { return json({ error: 'bad json' }, 400); }
    const sub = cleanSub(body.sub);
    if (!sub) return json({ error: 'bad subscription' }, 400);
    const key = 'd:' + await sha256hex(sub.endpoint);
    const path = new URL(req.url).pathname;

    if (path === '/schedule') {
      const now = Date.now();
      const items = (Array.isArray(body.items) ? body.items : [])
        .filter(i => i && Number.isFinite(i.at) && i.at > now - 60000)
        .slice(0, MAX_ITEMS)
        .map(i => ({ at: i.at, title: String(i.title || '').slice(0, 60), body: String(i.body || '').slice(0, 200) }))
        .sort((a, b) => a.at - b.at);
      await env.PUSH.put(key, JSON.stringify({ sub, items }));
      return json({ ok: true, count: items.length });
    }
    if (path === '/test') {
      const r = await sendPush(env, sub, { title: '🦊 알림 테스트', body: '알림이 잘 와요! 이제 코치가 시간 맞춰 챙겨 줄게.' });
      return json({ ok: r.ok, status: r.status }, r.ok ? 200 : 502);
    }
    if (path === '/unsubscribe') {
      await env.PUSH.delete(key);
      return json({ ok: true });
    }
    return json({ error: 'not found' }, 404);
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(runDue(env));
  }
};

async function runDue(env) {
  const now = Date.now();
  let cursor;
  do {
    const page = await env.PUSH.list({ prefix: 'd:', cursor });
    for (const { name } of page.keys) {
      const rec = await env.PUSH.get(name, 'json');
      if (!rec) continue;
      const due = rec.items.filter(i => i.at <= now);
      if (!due.length) continue;
      const rest = rec.items.filter(i => i.at > now);
      // 밀린 게 여러 개면 가장 최근 것 하나만 (오래된 건 버림)
      const last = due[due.length - 1];
      if (now - last.at <= STALE_MS) {
        const r = await sendPush(env, rec.sub, { title: last.title, body: last.body });
        if (r.status === 404 || r.status === 410) { await env.PUSH.delete(name); continue; } // 구독 만료
      }
      await env.PUSH.put(name, JSON.stringify({ sub: rec.sub, items: rest }));
    }
    cursor = page.list_complete ? null : page.cursor;
  } while (cursor);
}

function cleanSub(s) {
  if (!s || typeof s.endpoint !== 'string' || !/^https:\/\//.test(s.endpoint)) return null;
  const k = s.keys || {};
  if (typeof k.p256dh !== 'string' || typeof k.auth !== 'string') return null;
  return { endpoint: s.endpoint, keys: { p256dh: k.p256dh, auth: k.auth } };
}

/* ---------- Web Push (RFC 8291 aes128gcm + RFC 8292 VAPID) ---------- */
const enc = new TextEncoder();
const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), c => c.charCodeAt(0));
const concat = (...arrs) => { const out = new Uint8Array(arrs.reduce((n, a) => n + a.length, 0)); let o = 0; for (const a of arrs) { out.set(a, o); o += a.length; } return out; };

async function sha256hex(s) {
  const h = await crypto.subtle.digest('SHA-256', enc.encode(s));
  return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join('');
}
async function hkdf(salt, ikm, info, bytes) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, bytes * 8));
}

async function encryptPayload(sub, text) {
  const uaPublic = unb64u(sub.keys.p256dh), authSecret = unb64u(sub.keys.auth);
  const as = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', as.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, as.privateKey, 256));
  const ikm = await hkdf(authSecret, ecdh, concat(enc.encode('WebPush: info\0'), uaPublic, asPublic), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
  const aes = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aes, concat(enc.encode(text), new Uint8Array([2]))));
  const header = new Uint8Array(21 + asPublic.length);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, 4096);
  header[20] = asPublic.length;
  header.set(asPublic, 21);
  return concat(header, cipher);
}

async function vapidAuth(env, endpoint) {
  const jwk = JSON.parse(env.VAPID_PRIVATE_JWK);
  const key = await crypto.subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y, d: jwk.d }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const head = b64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = b64u(enc.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: VAPID_SUB })));
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(`${head}.${claims}`));
  return `vapid t=${head}.${claims}.${b64u(sig)}, k=${VAPID_PUBLIC}`;
}

async function sendPush(env, sub, msg) {
  const body = await encryptPayload(sub, JSON.stringify(msg));
  return fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      'Authorization': await vapidAuth(env, sub.endpoint),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      'TTL': '3600',
      'Urgency': 'high'
    },
    body
  });
}

// 김결 유튜브 채널 최신 영상 15개 (YouTube RSS). 앱의 '오늘의 김결 영상'에 쓰임
async function videos(req, cors) {
  const cache = caches.default, ck = new Request('https://cache.local/videos');
  let res = await cache.match(ck);
  if (!res) {
    const r = await fetch('https://www.youtube.com/feeds/videos.xml?channel_id=' + YT_CHANNEL);
    if (!r.ok) return new Response(JSON.stringify({ items: [] }), { status: 502, headers: { ...cors, 'Content-Type': 'application/json' } });
    const items = parseFeed(await r.text());
    res = new Response(JSON.stringify({ items }), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=' + VIDEOS_TTL } });
    await cache.put(ck, res.clone());
  }
  return new Response(res.body, { headers: { ...cors, 'Content-Type': 'application/json' } });
}
function parseFeed(xml) {
  const unxml = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
  return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map(([, e]) => {
    const id = (e.match(/<yt:videoId>([\w-]{11})<\/yt:videoId>/) || [])[1];
    const t = unxml((e.match(/<title>([^<]*)<\/title>/) || [])[1] || '');
    const at = (e.match(/<published>([^<]+)<\/published>/) || [])[1] || '';
    const short = /\/shorts\//.test((e.match(/<link rel="alternate" href="([^"]+)"/) || [])[1] || '');
    return id && { id, t: t.slice(0, 120), at, k: short ? 'B' : /^\d{6,7}\s/.test(t) ? 'L' : 'A' };
  }).filter(Boolean);
}
