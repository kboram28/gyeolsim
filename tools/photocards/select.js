const fs=require('fs');const D=JSON.parse(fs.readFileSync('faces.json'));
const dist=(a,b)=>{let s=0;for(let i=0;i<128;i++){const d=a[i]-b[i];s+=d*d}return Math.sqrt(s)};
const all=[];for(const c of D)if(c.r)for(const f of c.r.faces)if(f.score>=0.7)all.push(f);
// 가장 많이 등장하는 얼굴 = 김결
let anchor=null,best=-1;for(const f of all){let n=0;for(const g of all)if(dist(f.desc,g.desc)<0.45)n++;if(n>best){best=n;anchor=f}}
const near=all.filter(g=>dist(anchor.desc,g.desc)<0.45);const mean=Array.from({length:128},(_,i)=>near.reduce((s,g)=>s+g.desc[i],0)/near.length);
const isArtist=f=>dist(f.desc,mean)<0.4;const maybe=f=>dist(f.desc,mean)<0.55;
const ham=(a,b)=>{let n=0;for(let i=0;i<64;i++)if(a[i]!==b[i])n++;return n};
const acc=[],rej=[];
for(const c of D){const r=c.r;const why=s=>rej.push({...c,why:s});
 if(!r){why('사진 없음');continue}
 const {w,h}=r.box;if(Math.min(w,h)<340){why('화질 낮음');continue}if(w/h<0.45||w/h>2.4){why('이상한 비율');continue}
 const art=r.faces.filter(isArtist).sort((a,b)=>b.h-a.h);
 if(!r.faces.length){why('얼굴 없음');continue}
 if(!art.length){why('다른 사람');continue}
 const f=art[0];if(art.length>1){why('콜라주');continue}
 if(r.faces.some(g=>!maybe(g)&&g.h>f.h*0.6)){why('다른 사람이 더 큼');continue}
 if(f.score<0.85){why('얼굴 흐림');continue}
 if(f.h<Math.min(w,h)*0.2){why('얼굴 작음');continue}
 const pw=f.w*0.3,pt=f.h*0.45,pb=f.h*0.25;if(f.x-pw<0||f.y-pt<0||f.x+f.w+pw>w||f.y+f.h+pb>h){why('얼굴 잘림');continue}
 if(Math.min(f.earL,f.earR)<0.28){why('눈 감음');continue}
 if(['disgusted','fearful','angry'].includes(f.expr[0])&&f.expr[1]>0.5){why('표정 이상');continue}
 const ratio=w/h;
 const rare=/M\/?V|뮤직비디오|Teaser|티저/i.test(c.title||'')?'SR':(c.k==='A'&&c.src==='thumb'?'R':'N');
 acc.push({...c,face:f,ori:ratio>1.1?'land':'port',rare,area:f.h*f.w})}
// 비슷한 사진 중복 제거 (썸네일 > 큰 얼굴 우선)
acc.sort((a,b)=>(b.src==='thumb')-(a.src==='thumb')||b.area-a.area);
const keep=[],vids=new Set();for(const a of acc){if(vids.has(a.id)){rej.push({...a,why:'같은 영상'});continue}const d=keep.find(k=>ham(k.r.hash,a.r.hash)<=10);if(d){rej.push({...a,why:'비슷한 사진 중복'});continue}keep.push(a);vids.add(a.id)}
const cnt={};for(const x of rej)cnt[x.why]=(cnt[x.why]||0)+1;
console.log('artist cluster',near.length,'/ faces',all.length);console.log('keep',keep.length,{N:keep.filter(k=>k.rare==='N').length,R:keep.filter(k=>k.rare==='R').length,SR:keep.filter(k=>k.rare==='SR').length,port:keep.filter(k=>k.ori==='port').length,land:keep.filter(k=>k.ori==='land').length});console.log(cnt);
const cards=keep.map(k=>({id:k.id,q:k.r.q,x:k.r.box.x,y:k.r.box.y,w:k.r.box.w,h:k.r.box.h,t:k.title,r:k.rare,k:k.k}));
fs.writeFileSync('cards.json',JSON.stringify(cards));
const esc=s=>(s||'').replace(/[<&"]/g,'');
const card=c=>`<figure class="${c.w/c.h>1.1?'land':'port'}"><div class=c data-src="https://i.ytimg.com/vi/${c.id}/${c.q}.jpg" data-b="${c.x},${c.y},${c.w},${c.h}"></div><figcaption>${{N:'일반',R:'레어',SR:'슈퍼레어'}[c.r]} · ${esc(c.t)}</figcaption></figure>`;
const rcard=x=>`<figure class=sm><img loading=lazy src="https://i.ytimg.com/vi/${x.id}/${x.r?x.r.q:x.qs[0]}.jpg"><figcaption>${x.why}</figcaption></figure>`;
const byWhy={};for(const x of rej)(byWhy[x.why]=byWhy[x.why]||[]).push(x);
fs.writeFileSync('photocard-preview4.html',`<!doctype html><meta charset=utf-8><title>포토카드 v4</title><style>body{font-family:sans-serif;margin:16px;background:#f5f5f7}.g{display:flex;flex-wrap:wrap;gap:14px;align-items:flex-start}figure{margin:0}.port{width:150px}.land{width:266px}.c{border-radius:12px;border:4px solid #fff;box-shadow:0 2px 8px #0004;overflow:hidden;background:#ddd}.c canvas{width:100%;display:block}figcaption{font-size:11px;color:#555;margin-top:4px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;max-width:100%}.sm{width:120px}.sm img{width:100%;border-radius:6px}details{margin-top:12px}</style>
<h1>포토카드 v4 · ${cards.length}장</h1><p>얼굴 인식으로 김결 본인 · 얼굴 안 잘림 · 눈 뜸 · 중복 제거. 사진 형태 그대로(세로/가로).</p><div class=g>${cards.map(card).join('')}</div>
<h2>제외된 사진</h2>${Object.entries(byWhy).map(([k,v])=>`<details><summary>${k} (${v.length})</summary><div class=g>${v.slice(0,60).map(rcard).join('')}</div></details>`).join('')}
<script>document.querySelectorAll('.c').forEach(d=>{const [x,y,w,h]=d.dataset.b.split(',').map(Number);const i=new Image();i.crossOrigin='anonymous';i.onload=()=>{const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(i,x,y,w,h,0,0,w,h);d.append(c)};i.src=d.dataset.src})</script>`);
// 검수용: 후보별 자동 판정
const dec={};for(const x of rej)dec[x.id+'|'+x.src]={s:0,why:x.why};for(const k of keep)dec[k.id+'|'+k.src]={s:1};
fs.writeFileSync('decisions.json',JSON.stringify(dec));
