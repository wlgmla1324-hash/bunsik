import assert from 'node:assert/strict';
import {Game,PR,TB,seatPos,dirtyAt,ltOn,KIOSK} from '../src/game.js';

// ── 가짜 입출력 (Cloudflare 없이 서버 규칙만 검증) ──
function makeWorld(){
  const store=new Map(),log=new Map(),later=[];
  const io={send:(t,o)=>{const a=log.get(t.ws)||[];a.push(o);log.set(t.ws,a)},raw:(t,s)=>io.send(t,JSON.parse(s)),later:f=>later.push(f),save(){},close(){},
    store:{get:async k=>store.get(k),put:async(k,v)=>{store.set(k,JSON.parse(JSON.stringify(v)))},delete:async k=>{store.delete(k)}}};
  const g=new Game(io);let seq=0;
  const mkws=()=>({n:++seq});
  const msgs=ws=>log.get(ws)||[];
  const last=(ws,t)=>[...msgs(ws)].reverse().find(m=>m.t===t);
  return{g,store,mkws,msgs,last,flush:()=>{while(later.length)later.shift()()},clear:ws=>log.set(ws,[])};
}
const ID=n=>('player'+n).padEnd(20,'x');
let T0=1_700_000_000_000;
async function join(w,n,nick,r,c=0){const ws=w.mkws();await w.g.msg(ws,{t:'hello',id:ID(n),n:nick,r,c},T0);return ws}
let pass=0;const ok=(name,fn)=>fn().then(()=>{pass++;console.log('  ✓',name)},e=>{console.error('  ✗',name,'\n   ',e.message);process.exitCode=1});

await ok('입장·중복 닉네임 방지·재접속(같은 ID)',async()=>{
  const w=makeWorld();
  const a=await join(w,1,'지희','g'),b=await join(w,2,'요리왕','c');
  assert.equal(w.last(a,'welcome').me.coins,1000);
  assert.equal(w.last(b,'welcome').players.length,1);
  assert.equal(w.last(a,'join').p.n,'요리왕');
  const dup=await join(w,3,'지희','g');
  assert.equal(w.last(dup,'err').code,'nick');
  const a2=await join(w,1,'지희','g');                 // 같은 ID 재접속 → 허용, 이전 연결은 종료
  assert.ok(w.last(a2,'welcome'));assert.ok(w.last(a,'bye'));
  assert.equal(w.g.P.size,2);
});

await ok('이동 동기화 + 순간이동(스피드핵) 차단',async()=>{
  const w=makeWorld();const a=await join(w,1,'A','g'),b=await join(w,2,'B','g');w.clear(b);
  await w.g.msg(a,{t:'pos',x:1,z:20,ry:1,a:0},T0+200);w.flush();
  assert.deepEqual(w.last(b,'pd').d[0].slice(1,3),[1,20]);
  await w.g.msg(a,{t:'pos',x:40,z:20,ry:0,a:0},T0+400);     // 0.2초에 39칸 이동 시도
  assert.ok(w.last(a,'fix'));assert.ok(w.g.P.get(ID(1)).x<6);
});

await ok('채팅: 서버가 닉네임/직업 부착 · 도배 차단 · 욕설 가림',async()=>{
  const w=makeWorld();const a=await join(w,1,'A','g'),b=await join(w,2,'B','c');
  await w.g.msg(a,{t:'chat',x:'안녕 시발'},T0+1000);
  const m=w.last(b,'chat');assert.equal(m.n,'A');assert.equal(m.r,'g');assert.equal(m.x,'안녕 ***');
  const n=w.msgs(b).filter(x=>x.t==='chat').length;
  await w.g.msg(a,{t:'chat',x:'연타'},T0+1100);
  assert.equal(w.msgs(b).filter(x=>x.t==='chat').length,n);
});

await ok('주문→조리→서빙→결제 전체 흐름 + 서버 금액 검증',async()=>{
  const w=makeWorld();const g=await join(w,1,'손님','g'),c=await join(w,2,'요리사','c');
  const cust=w.g.P.get(ID(1)),cook=w.g.P.get(ID(2));
  cust.x=seatPos(0).x;cust.z=seatPos(0).z+1;                 // 테이블 1번 근처
  await w.g.msg(g,{t:'sit',q:0},T0);assert.equal(cust.q,0);
  await w.g.msg(g,{t:'order',d:99},T0);assert.equal(cust.st,0);       // 잘못된 메뉴
  await w.g.msg(g,{t:'order',d:0},T0);assert.equal(cust.st,1);assert.equal(cust.o,0);
  await w.g.msg(g,{t:'cancel'},T0);assert.equal(cust.st,0);           // 주문 취소
  await w.g.msg(g,{t:'order',d:0},T0);
  cook.x=-17.25-3.4;cook.z=-12.7;                                      // 떡볶이 조리대(주방 A)
  await w.g.msg(c,{t:'serve',to:cust.s},T0);assert.equal(cook.coins,1000);   // 요리 없이 서빙 시도 → 무시
  await w.g.msg(c,{t:'cook',d:0},T0);const ck=w.last(c,'cookOk');assert.ok(ck);
  assert.equal(cook.inv[0],2);                                          // 재료 소모
  await w.g.msg(c,{t:'stop',lag:0},T0+Math.round(ck.c/.85*1000));       // 초록 구간 정확히 정지
  assert.equal(cook.hand.q,3);
  cook.x=seatPos(0).x;cook.z=seatPos(0).z+3;
  await w.g.msg(c,{t:'serve',to:cust.s},T0+2000);
  assert.equal(cook.coins,1000+PR[0]+100);assert.equal(cust.st,2);assert.equal(cook.hand,null);
  await w.g.msg(c,{t:'serve',to:cust.s},T0+2100);assert.equal(cook.coins,1000+PR[0]+100);  // 중복 서빙·중복 지급 불가
  await w.g.msg(g,{t:'pay'},T0+3000);assert.equal(cust.coins,1000);    // 앉은 채 · 식사 중 결제 불가
  await w.g.msg(g,{t:'stand'},T0+3000);assert.equal(cust.q,0);         // 식사 중엔 못 일어남
  await w.g.msg(g,{t:'stand'},T0+7500);assert.equal(cust.q,-1);
  cust.x=KIOSK[0][0];cust.z=13.6;
  await w.g.msg(g,{t:'pay'},T0+7600);assert.equal(cust.coins,1000-PR[0]);assert.equal(cust.st,0);
  await w.g.msg(g,{t:'pay'},T0+7700);assert.equal(cust.coins,1000-PR[0]);   // 중복 결제 불가
});

await ok('조리 실패: 너무 빨리/늦게 누르면 FAIL · 재료 부족 거절',async()=>{
  const w=makeWorld();const c=await join(w,2,'요리사','c');const cook=w.g.P.get(ID(2));
  cook.x=-17.25-3.4;cook.z=-12.7;
  await w.g.msg(c,{t:'cook',d:0},T0);await w.g.msg(c,{t:'stop'},T0+50);assert.equal(cook.hand,null);
  for(let i=0;i<3;i++){await w.g.msg(c,{t:'cook',d:0},T0+1000*(i+2));await w.g.msg(c,{t:'stop'},T0+1000*(i+2)+30)}
  w.clear(c);await w.g.msg(c,{t:'cook',d:0},T0+9000);assert.match(w.last(c,'fx').x,/재료가 부족/);
  cook.x=0;cook.z=10;cook.inv[1]=5;cook.inv[10]=5;await w.g.msg(c,{t:'cook',d:1},T0+9500);assert.ok(w.last(c,'fx'));  // 조리대에서 멂
});

await ok('클라이언트가 보낸 돈/주문 위조는 무시 (돈 부족·직업 불일치·거리)',async()=>{
  const w=makeWorld();const g=await join(w,1,'손님','g'),c=await join(w,2,'요리사','c');
  const cust=w.g.P.get(ID(1));
  await w.g.msg(g,{t:'order',d:0},T0);assert.equal(cust.st,0);        // 앉지 않고 주문
  await w.g.msg(g,{t:'coins',v:99999},T0);await w.g.msg(g,{t:'give',amt:99999},T0);assert.equal(cust.coins,1000);
  await w.g.msg(g,{t:'buy',d:0},T0);await w.g.msg(g,{t:'hire'},T0);assert.equal(cust.coins,1000);   // 손님이 요리사 기능 사용
  await w.g.msg(c,{t:'dance'},T0);await w.g.msg(c,{t:'dance'},T0+100);assert.equal(w.g.P.get(ID(2)).coins,1100);  // 쿨타임
  cust.coins=300;cust.x=seatPos(0).x;cust.z=seatPos(0).z;await w.g.msg(g,{t:'sit',q:0},T0);
  await w.g.msg(g,{t:'order',d:9},T0);assert.equal(cust.st,0);        // 돈 부족 + 홀 좌석에서 바베큐 메뉴
});

await ok('청소·수확·판매·재료주문·알바 고용',async()=>{
  const w=makeWorld();const g=await join(w,1,'손님','g'),c=await join(w,2,'요리사','c');
  const cust=w.g.P.get(ID(1)),cook=w.g.P.get(ID(2));
  let i=0;while(!dirtyAt(i,T0))i++;                                    // 지금 더러운 테이블 찾기
  cust.x=TB[i].x;cust.z=TB[i].z+2.6;await w.g.msg(g,{t:'clean',i},T0);assert.equal(cust.coins,1100);
  await w.g.msg(g,{t:'clean',i},T0+2000);assert.equal(cust.coins,1100);   // 같은 테이블 중복 청소 불가
  cust.x=14;cust.z=30;await w.g.msg(g,{t:'harvest',i:0},T0);assert.equal(cust.bag[0],1);
  for(let k=1;k<5;k++)await w.g.msg(g,{t:'harvest',i:0},T0+k*1000);assert.equal(cust.bag[0],4);  // 4포기만
  await w.g.msg(g,{t:'sell',to:cook.s},T0+9000);
  assert.equal(cust.coins,1100+400);assert.equal(cook.coins,600);assert.equal(cook.inv[9],6);assert.deepEqual(cust.bag,[0,0,0,0]);
  cook.coins=2000;await w.g.msg(c,{t:'buy',d:0},T0);assert.equal(cook.coins,2000-(100+150+150)*3);
  cook.coins=5000;await w.g.msg(c,{t:'hire'},T0);assert.equal(cook.albas,1);assert.equal(cook.coins,3500);
  let j=0;while(!dirtyAt(j,T0+60000)||j===i)j++;
  await w.g.msg(c,{t:'albaclean',i:j},T0+60000);assert.equal(cook.coins,3600);
});

await ok('접속 종료: 주문 취소/식사 중 정산 · 재접속 시 코인 복원',async()=>{
  const w=makeWorld();const g=await join(w,1,'손님','g'),c=await join(w,2,'요리사','c');
  const cust=w.g.P.get(ID(1));cust.x=seatPos(0).x;cust.z=seatPos(0).z;
  await w.g.msg(g,{t:'sit',q:0},T0);await w.g.msg(g,{t:'order',d:0},T0);
  w.clear(c);await w.g.onClose(g,T0+1000);
  assert.ok(w.last(c,'leave'));assert.equal(w.g.P.size,1);
  const back=await join(w,1,'손님','g');const me=w.last(back,'welcome').me;
  assert.equal(me.coins,1000);assert.equal(me.st,0);assert.equal(me.q,-1);
  const p=w.g.P.get(ID(1));p.st=2;p.o=0;p.q=-1;await w.g.onClose(back,T0+2000);    // 식사 중 도망 → 서버가 대금 차감
  const again=await join(w,1,'손님','g');assert.equal(w.last(again,'welcome').me.coins,1000-PR[0]);
});

await ok('직업 변경 규칙 / 닉네임 영구 예약',async()=>{
  const w=makeWorld();const g=await join(w,1,'손님','g');const cust=w.g.P.get(ID(1));
  await w.g.msg(g,{t:'role',r:'c'},T0);assert.equal(cust.r,'c');assert.equal(w.last(g,'me').rr,1);
  cust.st=1;await w.g.msg(g,{t:'role',r:'g'},T0);assert.equal(cust.r,'c');      // 주문 중 변경 불가
  cust.st=0;await w.g.onClose(g,T0);
  const thief=await join(w,9,'손님','g');assert.equal(w.last(thief,'err').code,'nick');   // 오프라인이어도 닉네임 예약
});

await ok('100명 수용 · 101번째 입장 거절 · 부하 측정',async()=>{
  const w=makeWorld();const socks=[];
  for(let i=0;i<100;i++)socks.push(await join(w,100+i,'P'+i,i%5===0?'c':'g',i%48));
  assert.equal(w.g.P.size,100);
  const over=await join(w,999,'초과','g');assert.equal(w.last(over,'err').code,'full');
  let sent=0;const g2=w.g,orig=g2.io.raw;g2.io.raw=(t,s)=>{sent++};void orig;
  const t0=process.hrtime.bigint();let inMsgs=0;
  for(let s=0;s<60;s++)for(let k=0;k<100;k++){const p=w.g.P.get(ID(100+k));if(k%2)continue;   // 절반은 이동 중
    for(let f=0;f<4;f++){await w.g.msg(socks[k],{t:'pos',x:Math.sin(s+k)*10+(p.x*0),z:20,ry:0,a:0},T0+s*1000+f*250+k);inMsgs++}
    if(s%1===0)w.flush()}
  const ms=Number(process.hrtime.bigint()-t0)/1e6;
  console.log(`    100명 중 50명이 60초간 이동(4Hz): 수신 ${inMsgs}건, 서버 처리 ${ms.toFixed(0)}ms → 메시지당 ${(ms/inMsgs*1000).toFixed(0)}µs, 송신 ${sent}건`);
  assert.ok(ms/inMsgs<2);   // 메시지당 CPU 2ms 미만 (무료 한도 10ms/요청 대비 여유)
});

console.log(process.exitCode?'\nFAILED':`\n전체 통과 (${pass}개 시나리오)`);
