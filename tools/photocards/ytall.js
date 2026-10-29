const fs=require("fs");
const UA={"User-Agent":"Mozilla/5.0","Accept-Language":"ko"};
function collect(o,acc){if(!o||typeof o!=="object")return;
 if(o.lockupViewModel?.contentId)acc.items.push({id:o.lockupViewModel.contentId,title:o.lockupViewModel.metadata?.lockupMetadataViewModel?.title?.content});
 else if(o.shortsLockupViewModel){const v=o.shortsLockupViewModel;acc.items.push({id:v.onTap?.innertubeCommand?.reelWatchEndpoint?.videoId,title:v.overlayMetadata?.primaryText?.content})}
 else if(o.videoRenderer)acc.items.push({id:o.videoRenderer.videoId,title:o.videoRenderer.title.runs[0].text});
 else if(o.continuationItemRenderer?.continuationEndpoint?.continuationCommand?.token){const tk=o.continuationItemRenderer.continuationEndpoint.continuationCommand.token;if(!acc.cont||tk.length>acc.cont.length)acc.cont=tk}
 else for(const k in o)collect(o[k],acc)}
(async()=>{const out={};
for(const t of ["videos","shorts","streams"]){const h=await (await fetch("https://www.youtube.com/@Gyeol_Kim/"+t,{headers:UA})).text();
 const key=h.match(/"INNERTUBE_API_KEY":"([^"]+)"/)[1];const ver=h.match(/"INNERTUBE_CLIENT_VERSION":"([^"]+)"/)[1];
 const acc={items:[],cont:null};collect(JSON.parse(h.match(/var ytInitialData = (\{.*?\});<\/script>/s)[1]),acc);
 let guard=0;while(acc.cont&&guard++<40){const c=acc.cont;acc.cont=null;const r=await (await fetch("https://www.youtube.com/youtubei/v1/browse?key="+key,{method:"POST",headers:{...UA,"Content-Type":"application/json"},body:JSON.stringify({context:{client:{clientName:"WEB",clientVersion:ver,hl:"ko"}},continuation:c})})).json();collect(r,acc);}
 const seen=new Set();out[t]=acc.items.filter(i=>i.id&&!seen.has(i.id)&&seen.add(i.id));console.log(t,out[t].length)}
fs.writeFileSync("ytall.json",JSON.stringify(out))})();
