export {GameRoom} from './room.js';

export default{
  async fetch(req,env){
    const u=new URL(req.url);
    if(u.pathname==='/ws'){
      if(req.headers.get('Upgrade')!=='websocket')return new Response('Expected WebSocket',{status:426});
      const o=req.headers.get('Origin');
      if(o){let h='';try{h=new URL(o).host}catch(e){}if(h!==u.host)return new Response('Forbidden',{status:403})}
      const r=u.searchParams.get('room')||'main';           // 추후 방 추가: /ws?room=방이름
      const id=env.GAME.idFromName(/^[a-z0-9-]{1,24}$/.test(r)?r:'main');
      return env.GAME.get(id).fetch(req);
    }
    if(u.pathname==='/health')return new Response('ok');
    return env.ASSETS.fetch(req);                           // 정적 파일(게임 화면)은 무료·무제한
  }
};
