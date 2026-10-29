const http=require('http'),fs=require('fs'),path=require('path');
const types={'.html':'text/html; charset=utf-8','.json':'application/json'};
http.createServer((q,s)=>{
 if(q.method==='POST'&&q.url==='/save'){let b='';q.on('data',d=>b+=d);q.on('end',()=>{try{JSON.parse(b);fs.writeFileSync('review.json',b);s.end('ok')}catch(e){s.statusCode=400;s.end('bad')}});return}
 const f=q.url==='/'?'review.html':decodeURIComponent(q.url.split('?')[0].slice(1));
 if(!['review.html','review-data.json','review.json'].includes(f)||!fs.existsSync(f)){s.statusCode=404;return s.end()}
 s.setHeader('Content-Type',types[path.extname(f)]);s.setHeader('Cache-Control','no-store');fs.createReadStream(f).pipe(s)
}).listen(5577,'127.0.0.1',()=>console.log('http://localhost:5577'));
