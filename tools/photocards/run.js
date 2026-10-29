const puppeteer=require('puppeteer-core'),fs=require('fs'),path=require('path'),{pathToFileURL}=require('url');
const y=JSON.parse(fs.readFileSync('ytall.json'));
const C=[];
for(const v of y.videos){C.push({...v,k:'A',src:'thumb',qs:['maxresdefault','sddefault','hqdefault']});for(const n of[1,2,3])C.push({...v,k:'A',src:'frame'+n,qs:['maxres'+n]})}
for(const v of y.shorts){C.push({...v,k:'B',src:'thumb',qs:['oardefault','maxresdefault','hqdefault']});for(const n of[1,2,3])C.push({...v,k:'B',src:'frame'+n,qs:['maxres'+n]})}
(async()=>{const b=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const out=new Array(C.length);let next=0,done=0;
async function worker(){const p=await b.newPage();await p.goto(pathToFileURL(path.resolve('analyze.html')).href);await p.evaluate(()=>window.ready);
 while(next<C.length){const i=next++;const c=C[i];let r=null;try{r=await p.evaluate(c=>window.analyze(c),c)}catch(e){}out[i]={...c,r};if(++done%100==0)console.log(done,'/',C.length)}}
await Promise.all([1,2,3,4].map(worker));
fs.writeFileSync('faces.json',JSON.stringify(out));await b.close();console.log('done',out.length)})();
