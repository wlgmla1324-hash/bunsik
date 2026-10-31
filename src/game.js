// 분식 메타버스 서버 로직 (순수 JS · Cloudflare 의존성 없음 → node로 테스트 가능)
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const fin=v=>typeof v==='number'&&Number.isFinite(v);
const isInt=(v,a,b)=>Number.isInteger(v)&&v>=a&&v<=b;
export const MAXP=100;
export const NM=['떡볶이','김밥','라면','순대','튀김','어묵','한정 모찌떡','아메리카노','바닐라라떼','삼겹살','한우 등심','조개구이','닭꼬치','군고구마'];
export const PR=[800,700,600,900,500,500,1500,600,800,1800,3000,2200,1000,800];
export const REC=[[0,11,12],[1,10],[2,11],[3],[4,9],[5,11],[6],[7],[7,8],[13,11],[14],[15,11],[16,9],[17]];
export const IP=[100,80,80,120,60,60,150,80,70,150,150,150,150,400,900,500,250,120];
const XS=[-18,-10.8,-3.6,3.6,10.8,18],ZS=[-5.5,-.5,4.5,9.5],SD=[[0,-1],[1,0],[0,1],[-1,0]];
export const TB=[];ZS.forEach(z=>XS.forEach(x=>TB.push({x,z})));[[31,-3],[41,-3],[31,6],[41,6]].forEach(a=>TB.push({x:a[0],z:a[1]}));
export const seatPos=q=>{const t=TB[q>>2],d=SD[q&3];return{x:t.x+d[0]*1.8,z:t.z+d[1]*1.8,ox:t.x+d[0]*2.9,oz:t.z+d[1]*2.9}};
const KX=[-17.25,-5.75,5.75,17.25],KS=[[0,5,6],[1,2],[4,3],[7,8]];
export const STN=[];KS.forEach((l,ki)=>l.forEach((d,j)=>{STN[d]=[KX[ki]+(j-(l.length-1)/2)*(l.length===3?3.4:4.8),-16.2]}));[9,10,11,12,13].forEach((d,j)=>{STN[d]=[37+(j-2)*3.2,-10.2]});
export const NPC=[10.5,29];
export const KIOSK=[[11.5,15.5],[16.5,15.5]],STAGE=[0,55],PLOT=[14,18.4,22.8,27.2];
export const ltOn=now=>(now/1000)%120<50;
export const dirtyAt=(t,now)=>(Math.floor(now/30000)+t*7)%4===0;
const win=now=>Math.floor(now/30000);
const menuOK=(d,q)=>q>=96?(d>=9||d===7||d===8):d<9;
const BAD=/시발|씨발|병신|개새끼|좆|ㅅㅂ|ㅂㅅ/g;
const dist=(a,b,c,d)=>Math.hypot(a-c,b-d);
const defInv=()=>[3,3,3,3,3,3,3,3,3,2,2,2,2,3,3,3,3,3];
const okArr=(a,n)=>Array.isArray(a)&&a.length===n&&a.every(v=>isInt(v,0,999));
const SPAWN={g:[0,21],c:[0,-11.5]};

export class Game{
  // io: {send(target,obj), raw(target,jsonString), later(fn,ms), save(p,snap), close(ws,code,reason), store:{get,put,delete}}
  constructor(io){this.io=io;this.P=new Map();this.byS=new Map();this.byWs=new Map();this.nsid=1;this.cleaned=new Set();this.plant=new Array(16).fill(0);this.dirty=new Set();this.timer=false}
  pub(p){return{s:p.s,n:p.n,r:p.r,c:p.c,x:p.x,z:p.z,ry:p.ry,q:p.q,st:p.st,o:p.o,a:p.a,eu:p.eu,j:p.albas,k:p.k||0}}
  me(p,full){const m={t:'me',coins:p.coins,inv:p.inv,bag:p.bag,hand:p.hand,albas:p.albas,q:p.q,st:p.st,o:p.o,eu:p.eu,k:p.k||0,job:p.job||null,x:+p.x.toFixed(2),z:+p.z.toFixed(2)};if(full){m.n=p.n;m.r=p.r;m.c=p.c}return m}
  snap(p){return{id:p.id,s:p.s,n:p.n,r:p.r,c:p.c,x:p.x,z:p.z,ry:p.ry,q:p.q,st:p.st,o:p.o,a:p.a,eu:p.eu,k:p.k||0,ct:p.ct||0,job:p.job||null,coins:p.coins,inv:p.inv,bag:p.bag,hand:p.hand,albas:p.albas}}
  restore(ws,a){const p={...a,ws,ck:null,cd:{},lp:Date.now(),rl:{t:0,n:0},sv:0};this.P.set(p.id,p);this.byS.set(p.s,p);this.byWs.set(ws,p);this.nsid=Math.max(this.nsid,p.s+1);return p}
  send(p,o){this.io.send(p,o)}
  all(o,ex){const s=JSON.stringify(o);for(const q of this.P.values())if(q!==ex)this.io.raw(q,s)}
  fx(p,x,e,a){this.send(p,{t:'fx',x,e,a})}
  st(p){this.all({t:'st',s:p.s,q:p.q,st:p.st,o:p.o,eu:p.eu,r:p.r,k:p.k||0},p);this.io.save(p,this.snap(p))}
  touch(p){this.dirty.add(p.s);if(!this.timer){this.timer=true;this.io.later(()=>this.flush(),150)}}
  flush(){this.timer=false;const d=[];for(const s of this.dirty){const p=this.byS.get(s);if(p){d.push([s,+p.x.toFixed(2),+p.z.toFixed(2),+p.ry.toFixed(2),p.a]);this.io.save(p,this.snap(p))}}this.dirty.clear();if(d.length)this.all({t:'pd',d})}
  async persist(p,now){p.sv=0;await this.io.store.put('p:'+p.id,{n:p.n,c:p.c,coins:p.coins,inv:p.inv,bag:p.bag,albas:p.albas,x:p.x,z:p.z,t:now})}
  give(p,amt,txt,e){p.coins+=amt;p.sv=1;this.send(p,this.me(p));this.fx(p,txt,e||'coin',amt)}
  cd(p,k,ms,now){if(now-(p.cd[k]||0)<ms)return false;p.cd[k]=now;return true}

  async hello(ws,m,now){
    const bad=(code,msg)=>this.io.send({ws},{t:'err',code,m:msg});
    const id=m.id,n=typeof m.n==='string'?m.n.replace(/[<>&"'`\\\s]+/g,' ').trim().slice(0,8):'';
    if(typeof id!=='string'||!/^[a-z0-9]{16,40}$/.test(id)||!n||(m.r!=='g'&&m.r!=='c'))return bad('bad','입장 정보가 올바르지 않아요');
    const low=n.toLowerCase();
    const taken=()=>{for(const q of this.P.values())if(q.id!==id&&q.n.toLowerCase()===low)return true;return false};
    if(taken())return bad('nick','이미 사용 중인 닉네임이에요');
    const owner=await this.io.store.get('n:'+low);
    if((owner&&owner!==id)||taken())return bad('nick','이미 사용 중인 닉네임이에요');
    let p=this.P.get(id);
    if(p){if(p.ws!==ws){const old=p.ws;this.byWs.delete(old);this.io.send({ws:old},{t:'bye',m:'다른 곳에서 접속해서 연결이 종료됐어요'});this.io.close(old,1000,'dup')}p.ws=ws;this.byWs.set(ws,p)}
    else{
      if(this.P.size>=MAXP)return bad('full','가게가 가득 찼어요 (100/100). 잠시 후 다시 와요!');
      const rec=(await this.io.store.get('p:'+id))||{};
      const fresh=rec.t&&now-rec.t<120000&&fin(rec.x)&&fin(rec.z);
      p={id,s:this.nsid++,n,r:m.r,c:0,x:fresh?clamp(rec.x,-52,52):SPAWN[m.r][0],z:fresh?clamp(rec.z,-12.7,60):SPAWN[m.r][1],ry:0,q:-1,st:0,o:-1,a:0,eu:0,
        coins:isInt(rec.coins,0,1e9)?rec.coins:1000,inv:okArr(rec.inv,18)?rec.inv:defInv(),bag:okArr(rec.bag,4)?rec.bag:[0,0,0,0],hand:null,k:0,ct:0,job:null,albas:isInt(rec.albas,0,3)?rec.albas:0,
        ws,ck:null,cd:{},lp:now,rl:{t:0,n:0},sv:0};
      this.P.set(id,p);this.byS.set(p.s,p);this.byWs.set(ws,p);
    }
    if(p.n!==n){const o=p.n.toLowerCase();p.n=n;if(o!==low)await this.io.store.delete('n:'+o)}
    p.r=m.r;p.c=isInt(m.c,0,47)?m.c:p.c;
    if(owner!==id)await this.io.store.put('n:'+low,id);
    this.io.save(p,this.snap(p));
    const w=win(now);
    this.send(p,{t:'welcome',sid:p.s,now,me:this.me(p,true),players:[...this.P.values()].filter(q=>q!==p).map(q=>this.pub(q)),plants:this.plant,cl:[...this.cleaned].filter(k=>k.startsWith(w+':'))});
    this.all({t:'join',p:this.pub(p)},p);
  }

  settle(p){ // 접속 종료 시 진행 중이던 주문 정리 (선불 주문은 환불)
    if(p.st===1){p.coins+=PR[p.o];p.sv=1;if(p.k){const c=this.byS.get(p.k);if(c){c.job=null;c.hand=null;this.send(c,this.me(c));this.fx(c,'손님이 나가서 주문이 취소됐어요','err')}}}
    if(p.job){const c=this.byS.get(p.job.s);if(c&&c.k===p.s){c.k=0;c.ct=0;this.st(c);this.send(c,this.me(c))}p.job=null}
    p.st=0;p.o=-1;p.k=0;p.q=-1;p.hand=null;p.ck=null;p.a=0;
  }
  expire(now){ // 수락만 하고 3분 넘게 안 가져온 주문은 다시 열어 줌
    for(const t of this.P.values())if(t.st===1&&t.k&&now-t.ct>180000){const c=this.byS.get(t.k);if(c){c.job=null;c.hand=null;this.send(c,this.me(c));this.fx(c,'시간이 지나 주문이 다른 요리사에게 넘어갔어요','err')}t.k=0;t.ct=0;this.st(t);this.send(t,this.me(t))}
  }
  async onClose(ws,now){
    const p=this.byWs.get(ws);this.byWs.delete(ws);if(!p||p.ws!==ws)return;
    this.settle(p);this.P.delete(p.id);this.byS.delete(p.s);this.dirty.delete(p.s);
    this.all({t:'leave',s:p.s});
    try{await this.persist(p,now)}catch(e){}
  }

  async msg(ws,m,now){
    if(!m||typeof m!=='object'||typeof m.t!=='string')return;
    if(m.t==='hello')return this.hello(ws,m,now);
    const p=this.byWs.get(ws);if(!p)return;
    if(now-p.rl.t>=1000){p.rl.t=now;p.rl.n=0}if(++p.rl.n>40)return;if(p.st===2&&now>=p.eu){p.st=0;p.o=-1}
    switch(m.t){
      case 'pos':{
        const ry=fin(m.ry)?clamp(m.ry,-7,7):p.ry;
        if(p.q>=0){p.ry=ry;p.a=isInt(m.a,0,8)?m.a:0;p.lp=now;this.touch(p);return}
        let x=fin(m.x)?clamp(m.x,-52,52):null,z=fin(m.z)?clamp(m.z,-12.7,60):null;if(x===null||z===null)return;
        const dt=clamp((now-p.lp)/1000,.05,2),allow=11*dt+2.5,d=dist(x,z,p.x,p.z);
        if(d>allow){const k=allow/d;x=p.x+(x-p.x)*k;z=p.z+(z-p.z)*k;this.send(p,{t:'fix',x:+x.toFixed(2),z:+z.toFixed(2)})}
        p.x=x;p.z=z;p.ry=ry;p.a=isInt(m.a,0,8)?m.a:0;p.lp=now;this.touch(p);return}
      case 'sit':{
        if(p.r!=='g'||p.q!==-1||p.st!==0||!isInt(m.q,0,TB.length*4-1))return;
        const s=seatPos(m.q);if(dist(p.x,p.z,s.x,s.z)>5)return this.fx(p,'자리에서 너무 멀어요','err');
        for(const q of this.P.values())if(q.q===m.q)return this.fx(p,'이미 다른 손님이 앉은 자리예요','err');
        p.q=m.q;p.x=s.x;p.z=s.z;this.send(p,this.me(p));this.st(p);return}
      case 'stand':{
        if(p.q<0||p.st===1||(p.st===2&&now<p.eu))return this.fx(p,'식사를 마친 뒤 일어날 수 있어요','err');
        const s=seatPos(p.q);p.q=-1;p.x=s.ox;p.z=s.oz;p.lp=now;this.send(p,this.me(p));this.st(p);return}
      case 'order':{
        if(p.r!=='g'||p.q<0||p.st!==0||!isInt(m.d,0,13)||!menuOK(m.d,p.q))return this.fx(p,'지금은 주문할 수 없어요','err');
        if(m.d===6&&!ltOn(now))return this.fx(p,'한정 모찌떡은 지금 판매 시간이 아니에요','err');
        if(p.coins<PR[m.d])return this.fx(p,'돈이 부족해요! 춤이나 청소로 벌어요','err');
        p.coins-=PR[m.d];p.sv=1;p.st=1;p.o=m.d;p.k=0;p.ct=0;   // 선불 결제
        this.send(p,this.me(p));this.fx(p,NM[m.d]+' 주문 완료! (-'+PR[m.d]+'원 선불) 요리사가 수락하면 알려 드려요','order');this.st(p);return}
      case 'cancel':{
        if(p.st!==1)return this.fx(p,'취소할 주문이 없어요','err');
        if(p.k)return this.fx(p,'요리사가 이미 수락해서 취소할 수 없어요','err');
        p.coins+=PR[p.o];p.sv=1;p.st=0;p.o=-1;this.send(p,this.me(p));this.fx(p,'주문을 취소했어요. 코인을 돌려받았어요','tap');this.st(p);return}
      case 'accept':{
        if(p.r!=='c')return;this.expire(now);
        const t=this.byS.get(m.to);
        if(p.job)return this.fx(p,'먼저 진행 중인 주문을 끝내요','err');
        if(!t||t.r!=='g'||t.st!==1||t.q<0)return this.fx(p,'이미 사라진 주문이에요','err');
        if(t.k)return this.fx(p,'이미 다른 요리사가 수락했어요','err');
        t.k=p.s;t.ct=now;p.job={s:t.s,d:t.o,q:t.q};
        this.send(p,this.me(p));this.fx(p,NM[t.o]+' 주문 수락! 조리대에서 요리해요 🔥','good');this.st(t);this.send(t,this.me(t));return}
      case 'cook':{
        if(p.r!=='c'||p.hand||!isInt(m.d,0,13))return;
        if(p.ck&&now-p.ck.t0<20000)return;
        if(!p.job)return this.fx(p,'먼저 주문을 수락해요 🔔','err');
        if(m.d!==p.job.d)return this.fx(p,'수락한 주문은 '+NM[p.job.d]+'이에요','err');
        const s=STN[m.d];if(dist(p.x,p.z,s[0],s[1])>7)return this.fx(p,'조리대에서 너무 멀어요','err');
        if(!REC[m.d].every(i=>p.inv[i]>0))return this.fx(p,'재료가 부족해요! 📦 재료주문을 눌러요','err');
        REC[m.d].forEach(i=>p.inv[i]--);p.sv=1;p.ck={d:m.d,t0:now,c:.3+Math.random()*.4};
        this.send(p,this.me(p));this.send(p,{t:'cookOk',d:m.d,c:p.ck.c});return}
      case 'stop':{
        const c=p.ck;if(!c)return;p.ck=null;
        const lag=fin(m.lag)?clamp(m.lag,0,600):0,el=(now-c.t0-lag)/1000;let q=0;
        if(el>=.25&&el<90){const ph=(el*.85)%2,pos=ph<=1?ph:2-ph,d=Math.abs(pos-c.c);q=d<.06?3:d<.14?2:d<.26?1:0}
        if(q)p.hand={d:c.d,q};
        this.send(p,this.me(p));
        this.fx(p,q?NM[c.d]+' 완성 ('+['','보통','좋아요','퍼펙트'][q]+')! 손님 테이블을 톡!':'앗, 타버렸어요! 다시 도전해요',q===3?'perfect':q?'good':'fail');return}
      case 'serve':{
        if(p.r!=='c'||!p.hand)return;
        const t=this.byS.get(m.to);
        if(!p.job||m.to!==p.job.s||!t||t.r!=='g'||t.st!==1||t.k!==p.s||t.q<0||t.o!==p.hand.d||dist(p.x,p.z,t.x,t.z)>8)return this.fx(p,'수락한 주문의 테이블에 맞는 요리를 가져가요!','err');
        const g=PR[t.o]+(p.hand.q===3?100:p.hand.q===2?50:0);
        p.hand=null;p.coins+=g;p.sv=1;t.st=2;t.eu=now+5000;p.job=null;t.k=0;t.ct=0;
        this.send(p,this.me(p));this.fx(p,NM[t.o]+' 서빙 완료! 주문 금액 +'+g+'원','coin',g);
        this.send(t,this.me(t));this.fx(t,'음식이 나왔어요! 맛있게 드세요 😋','serve');this.st(t);return}
      case 'clean':{
        if(p.r!=='g'||p.q>=0||!isInt(m.i,0,TB.length-1))return;
        const k=win(now)+':'+m.i;
        if(!dirtyAt(m.i,now)||this.cleaned.has(k))return this.fx(p,'이미 깨끗해요','err');
        if(dist(p.x,p.z,TB[m.i].x,TB[m.i].z)>6||!this.cd(p,'clean',1200,now))return;
        this.doClean(k,now);this.give(p,100,'청소 완료! +100원');return}
      case 'albaclean':{
        if(p.r!=='c'||p.albas<1||!isInt(m.i,0,TB.length-1))return;
        const k=win(now)+':'+m.i;if(!dirtyAt(m.i,now)||this.cleaned.has(k)||!this.cd(p,'alba',3500/p.albas,now))return;
        this.doClean(k,now);this.give(p,100,'알바가 청소했어요! +100원');return}
      case 'dance':if(!this.cd(p,'dance',5500,now))return this.fx(p,'호객 쿨타임이에요 💦','err');return this.give(p,100,'호객 성공! +100원');
      case 'greet':if(p.r!=='c')return;if(!this.cd(p,'greet',7500,now))return this.fx(p,'인사 쿨타임이에요 😊','err');return this.give(p,100,'인사 완료! +100원');
      case 'show':if(p.r!=='c')return;if(!this.cd(p,'show',11500,now))return this.fx(p,'불이 식을 때까지 기다려요 🔥','err');return this.give(p,100,'요리쇼 성공! +100원');
      case 'busk':{
        if(dist(p.x,p.z,STAGE[0],STAGE[1])>8)return this.fx(p,'무대 위에서 공연해요','err');
        if(!this.cd(p,'busk',9500,now))return this.fx(p,'잠깐 쉬었다 해요 🎤','err');
        return this.give(p,100,'공연 대박! +100원')}
      case 'harvest':{
        if(p.r!=='g'||!isInt(m.i,0,3)||p.q>=0||dist(p.x,p.z,PLOT[m.i],28)>6)return;
        let k=-1;for(let j=m.i*4;j<m.i*4+4;j++)if(this.plant[j]<=now){k=j;break}
        if(k<0)return this.fx(p,'아직 자라는 중이에요 🌱','err');
        if(!this.cd(p,'hv',800,now)||p.bag[m.i]>=99)return;
        this.plant[k]=now+10000;p.bag[m.i]++;this.all({t:'plant',k,t:this.plant[k]});
        this.send(p,this.me(p));this.fx(p,['양파','당근','파','고추'][m.i]+' 수확! 🎒','harvest');return}
      case 'sell':{ // 수확물은 상점지기(NPC)에게 개당 100원
        if(p.r!=='g'||p.q>=0)return;
        if(dist(p.x,p.z,NPC[0],NPC[1])>7)return this.fx(p,'상점지기에게 가까이 가요','err');
        const tot=p.bag.reduce((a,b)=>a+b,0);if(!tot)return this.fx(p,'수확한 채소가 없어요','err');
        p.bag=[0,0,0,0];this.give(p,tot*100,'고맙소! 채소 '+tot+'개 판매 +'+tot*100+'원','coin');this.all({t:'npc',m:1});return}
      case 'buy':{
        if(p.r!=='c'||!isInt(m.d,0,13))return;const cost=REC[m.d].reduce((a,i)=>a+IP[i]*3,0);
        if(p.coins<cost)return this.fx(p,'돈이 부족해요','err');
        p.coins-=cost;REC[m.d].forEach(i=>{p.inv[i]=Math.min(999,p.inv[i]+3)});p.sv=1;this.send(p,this.me(p));this.fx(p,NM[m.d]+' 재료 3인분 주문 완료! 📦','coin');return}
      case 'hire':{
        if(p.r!=='c'||p.albas>=3)return;if(p.coins<1500)return this.fx(p,'돈이 부족해요','err');
        p.coins-=1500;p.albas++;p.sv=1;this.send(p,this.me(p));this.fx(p,'알바생 합류! 청소하면 +100원이 들어와요 🧹','hire');return}
      case 'chat':{
        if(typeof m.x!=='string')return;const x=m.x.replace(/[\u0000-\u001f\u007f<>]/g,'').trim().slice(0,60);if(!x)return;
        if(!this.cd(p,'chat',800,now))return;this.all({t:'chat',n:p.n,r:p.r,x:x.replace(BAD,'***')});return}
      case 'role':{
        if((m.r!=='g'&&m.r!=='c')||p.q!==-1||p.st!==0||p.hand||p.ck||p.job)return this.fx(p,'앉아 있거나 주문·요리 중에는 직업을 바꿀 수 없어요','err');
        p.r=m.r;if(isInt(m.c,0,47))p.c=m.c;const sp=SPAWN[p.r];p.x=sp[0];p.z=sp[1];p.lp=now;
        this.send(p,{...this.me(p,true),rr:1});this.all({t:'join',p:this.pub(p)},p);this.io.save(p,this.snap(p));return}
    }
  }
  doClean(k,now){const w=win(now)+':';for(const c of this.cleaned)if(!c.startsWith(w))this.cleaned.delete(c);this.cleaned.add(k);this.all({t:'clean',k})}
}
