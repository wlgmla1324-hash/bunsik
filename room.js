import {DurableObject} from 'cloudflare:workers';
import {Game} from './game.js';

// 하나의 공용 게임 공간 = Durable Object 1개 (방 이름별로 여러 개 생성 가능)
export class GameRoom extends DurableObject{
  constructor(ctx,env){
    super(ctx,env);
    this.g=new Game({
      send:(t,o)=>{try{t.ws.send(JSON.stringify(o))}catch(e){}},
      raw:(t,s)=>{try{t.ws.send(s)}catch(e){}},          // 브로드캐스트는 JSON을 한 번만 만들어 재사용
      later:(f,ms)=>setTimeout(f,ms),
      save:(p,s)=>{try{p.ws.serializeAttachment(s)}catch(e){}},
      close:(ws,c,r)=>{try{ws.close(c,r)}catch(e){}},
      store:ctx.storage
    });
    // 'ping' → 'pong' 은 DO를 깨우지 않고 자동 응답 (무료 한도 절약)
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping','pong'));
    // 하이버네이션에서 깨어난 경우 접속 중이던 플레이어 복원
    for(const ws of ctx.getWebSockets()){const a=ws.deserializeAttachment();if(a&&a.id)this.g.restore(ws,a)}
  }
  async fetch(req){
    if(req.headers.get('Upgrade')!=='websocket')return new Response('Expected WebSocket',{status:426});
    const pair=new WebSocketPair(),[client,server]=Object.values(pair);
    this.ctx.acceptWebSocket(server);
    return new Response(null,{status:101,webSocket:client});
  }
  async webSocketMessage(ws,msg){
    if(typeof msg!=='string'||msg.length>1500)return;
    let m;try{m=JSON.parse(msg)}catch(e){return}
    try{await this.g.msg(ws,m,Date.now())}catch(e){console.error('msg',e&&e.message)}
  }
  async webSocketClose(ws){try{await this.g.onClose(ws,Date.now())}catch(e){}}
  async webSocketError(ws){try{await this.g.onClose(ws,Date.now())}catch(e){}}
}
