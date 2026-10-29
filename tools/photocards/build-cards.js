// 검수 결과(review.json + review-data.json)와 얼굴 분석(faces.json)으로 ../../data/cards.json, videos.json을 만든다
const fs = require('fs');
const R = JSON.parse(fs.readFileSync('review.json')), RD = JSON.parse(fs.readFileSync('review-data.json'));
const F = JSON.parse(fs.readFileSync('faces.json')), Y = JSON.parse(fs.readFileSync('ytall.json'));
const dist = (a, b) => { let s = 0; for (let i = 0; i < 128; i++) { const d = a[i] - b[i]; s += d * d; } return Math.sqrt(s); };

// 김결 얼굴 = 채널 사진에서 가장 많이 나오는 얼굴의 평균
const all = []; for (const c of F) if (c.r) for (const f of c.r.faces) if (f.score >= 0.7) all.push(f);
let anchor = null, best = -1;
for (const f of all) { let n = 0; for (const g of all) if (dist(f.desc, g.desc) < 0.45) n++; if (n > best) { best = n; anchor = f; } }
const near = all.filter(g => dist(anchor.desc, g.desc) < 0.45);
const mean = Array.from({ length: 128 }, (_, i) => near.reduce((s, g) => s + g.desc[i], 0) / near.length);

const fm = new Map(F.map(c => [c.id + '|' + c.src, c]));
const SR = /M\/?V|Teaser|티저|Live Clip|VCR|CONCERT|Special Clip/i;
const cards = [];
for (const v of RD) for (const c of v.c) {
  const k = v.id + '|' + c.src, on = R[k] ? R[k].s : c.s;
  if (!on || !c.b) continue;
  const r = fm.get(k).r;
  let f = null, md = 9; for (const g of r.faces) { const d = dist(g.desc, mean); if (d < md) { md = d; f = g; } }
  cards.push({ id: v.id, s: c.src, q: c.q, W: r.w, H: r.h, b: c.b, fy: f ? +((f.y + f.h / 2) / c.b[3]).toFixed(3) : 0.4,
    r: SR.test(v.t || '') ? 'SR' : v.k === 'A' && c.src === 'thumb' ? 'R' : 'N', t: (v.t || '').slice(0, 80) });
}
fs.writeFileSync('../../data/cards.json', JSON.stringify(cards));
const vids = [...Y.videos.map(v => ({ id: v.id, t: v.title, k: 'A' })), ...Y.shorts.map(v => ({ id: v.id, t: v.title, k: 'B' })), ...Y.streams.map(v => ({ id: v.id, t: v.title, k: 'L' }))].filter(v => v.id && v.t);
fs.writeFileSync('../../data/videos.json', JSON.stringify(vids));
console.log('cards', cards.length, 'videos', vids.length);
