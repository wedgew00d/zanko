const {chromium}=require('/opt/npm-tools/node_modules/playwright');
const S='/home/claude/shots/z/';const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
 const c=await b.newContext({viewport:{width:1280,height:720}});const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8770/');await sleep(300);await p.click('#startBtn');await sleep(300);
 // drive the sim directly, one step at a time, so each frame of a move can be captured
 const shot=async(name,setup,inputs,frames)=>{await p.evaluate(setup);await p.evaluate('__zanko.setMode("pause")');
  for(const f of frames){await p.evaluate(`(()=>{const Z=ZankoSim,s=__zanko.sim,R=__zanko.R;const seq=${JSON.stringify(inputs)};while(s.__i===undefined||s.__i<${f}){s.__i=(s.__i||0);const k=seq[Math.min(s.__i,seq.length-1)];Z.step(s,{left:k.includes('L'),right:k.includes('R'),jump:k.includes('J'),dash:k.includes('D'),attack:k.includes('A')});for(const e of s.events)R.event(e);s.events.length=0;R.step(s);s.__i++;}})()`);
   await p.evaluate('document.getElementById("pause").classList.remove("show")');await sleep(60);
   const pos=await p.evaluate('(()=>{const s=__zanko.sim,R=__zanko.R;return [(s.p.x-R.cam.x)*R.css,(s.p.y-R.cam.y)*R.css]})()');
   await p.screenshot({path:S+name+'_'+f+'.png',clip:{x:Math.max(0,pos[0]-200),y:Math.max(0,pos[1]-200),width:400,height:260}});}
  await p.evaluate('delete __zanko.sim.__i');};
 const near='(()=>{const s=__zanko.sim;s.p.x=s.enemies[1].x-26;s.p.face=1;s.enemies[1].hp=12;s.enemies[1].dead=false;})()';
 const mash=[];for(let i=0;i<60;i++)mash.push(i%8<2?'A':'');
 await shot('c',near,mash,[5,8,13,17,24,30,36]);
 const hold=[];for(let i=0;i<50;i++)hold.push('A');hold.push('');
 await shot('g',near,hold,[49,58,62,66]);
 await shot('a','(()=>{const s=__zanko.sim;s.p.x=40*16;})()',['RD','RD','RD','RDJ','RDJ','RDJ','RDJ','RDJ','RDJ','RDJ','RDJA','RDJ','RDJ','RDJ','RDJ','RDJ','RDJ','RDJ','RDJ','RDJ','RDJ','RDJ'],[6,16,20]);
 await shot('k','(()=>{const s=__zanko.sim;s.p.x=92*16;s.p.y=26*16;})()',['R','R','R','R','R','R','RA','R','R','R','R','RA','R','R','R','R','R','RA','R'],[10,14,24]);
 console.log('errors',errs);await b.close();})();
