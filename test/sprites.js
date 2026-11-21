// captures each hero state with the sprite renderer, for looking at (not a pass/fail test)
const {chromium}=require('/opt/npm-tools/node_modules/playwright');
const S='/home/claude/shots/sp/';const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
 const c=await b.newContext({viewport:{width:1280,height:720},deviceScaleFactor:2});const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
 await p.goto('http://localhost:8770/');await sleep(500);await p.click('#startBtn');await sleep(300);
 console.log('sprite ready',await p.evaluate('__zanko.R.spriteReady()'));
 let n=0;const log=[];
 const shot=async(name,setup,inputs,frames)=>{await p.evaluate(setup);await p.evaluate('__zanko.setMode("pause")');
  for(const f of frames){await p.evaluate(`(()=>{const Z=ZankoSim,s=__zanko.sim,R=__zanko.R;const seq=${JSON.stringify(inputs)};while(s.__i===undefined||s.__i<${f}){s.__i=(s.__i||0);const k=seq[Math.min(s.__i,seq.length-1)];Z.step(s,{left:k.includes('L'),right:k.includes('R'),jump:k.includes('J'),dash:k.includes('D'),attack:k.includes('A'),interact:k.includes('E')});for(const e of s.events)R.event(e);s.events.length=0;R.step(s);s.__i++;}})()`);
   await p.evaluate('document.getElementById("pause").classList.remove("show")');await sleep(60);
   const info=await p.evaluate('(()=>{const s=__zanko.sim,R=__zanko.R;return [(s.p.x-R.cam.x)*R.css,(s.p.y-R.cam.y)*R.css,R.pose.kind,s.p.atk?s.p.atk.id+":"+s.p.atk.f:"",s.p.wall]})()');
   const id=String(n++).padStart(2,'0');log.push(id+' '+name+' f'+f+' '+info[2]+' '+info[3]+' wall'+info[4]);
   await p.screenshot({path:S+id+'.png',clip:{x:Math.max(0,info[0]-150),y:Math.max(0,info[1]-170),width:300,height:210}});}
  await p.evaluate('delete __zanko.sim.__i');};
 const rep=(k,m)=>Array(m).fill(k);
 const near='(()=>{const s=__zanko.sim;s.p.x=s.enemies[1].x-26;s.p.face=1;s.enemies[1].hp=12;s.enemies[1].dead=false;})()';
 await shot('idle','(()=>{})()',[''],[2]);
 await shot('run','(()=>{const s=__zanko.sim;s.p.x=40*16;})()',['R'],[8,16]);
 await shot('jump','(()=>{const s=__zanko.sim;s.p.x=40*16;})()',[...rep('RJ',12),...rep('R',40)],[8,30]);
 const mash=[];for(let i=0;i<60;i++)mash.push(i%8<2?'A':'');
 await shot('combo',near,mash,[12,25,34]);
 await shot('wall','(()=>{const s=__zanko.sim;s.p.x=105.5*16;s.p.y=26*16;})()',[...rep('RJ',14),...rep('R',22),'RA','RA',...rep('R',20)],[30,36,39,44]);
 await shot('dead','(()=>{const s=__zanko.sim;s.p.x=40*16;s.p.y=26*16;s.p.dead=true;s.p.deadT=70;})()',[''],[4,30]);
 console.log(log.join('\n'));console.log('errors',errs);await b.close();})();
