/* Live team sync for the standalone site.
   Uses free public MQTT brokers over secure WebSockets: no accounts, no server to run.
   Every message goes to two brokers for resilience; duplicates are dropped by id.
   Exposes window.WDLive.join(name) with the same shape the page expects:
   emit, on, presence, peers, onPeers, connected, onConnection, leave. */
(function(){
  var BROKERS=['wss://broker.emqx.io:8084/mqtt','wss://broker.hivemq.com:8884/mqtt'];
  var rid=function(){return Math.random().toString(36).slice(2,10)};
  var ME=rid();

  function join(name){
    return new Promise(function(resolve,reject){
      if(!window.mqtt){reject(new Error('sync library not loaded'));return}
      var base='wealthdesk/v1/'+name+'/';
      var L={},P={},PL=[],CL=[],seen=[],seenSet={},pres={},alive=true,settled=false;
      var clients=BROKERS.map(function(url,k){
        var c=window.mqtt.connect(url,{clientId:'wd_'+ME+'_'+k,clean:true,connectTimeout:8000,reconnectPeriod:3000,keepalive:30});
        c.on('connect',function(){c.subscribe(base+'#',{qos:0});announce();fireConn();if(!settled){settled=true;resolve(api)}});
        c.on('close',fireConn);c.on('offline',fireConn);c.on('error',function(){});
        c.on('message',function(topic,buf){onMsg(topic.slice(base.length),buf)});
        return c;
      });
      setTimeout(function(){if(!settled){settled=true;clients.forEach(function(c){c.end(true)});reject(new Error('timeout'))}},12000);

      function isConn(){return clients.some(function(c){return c.connected})}
      var lastConn=null;
      function fireConn(){var v=isConn();if(v===lastConn)return;lastConn=v;CL.forEach(function(f){try{f(v)}catch(e){}})}
      function pub(sub,obj){var s=JSON.stringify(obj);clients.forEach(function(c){if(c.connected)c.publish(base+sub,s,{qos:0})})}
      function dup(id){if(seenSet[id])return true;seenSet[id]=1;seen.push(id);if(seen.length>600)delete seenSet[seen.shift()];return false}
      function self(){return{peer:ME,isMe:true,sameTab:true,kind:'viewer',guest:false,by:null,presence:pres,updatedAt:Date.now()}}
      P[ME]=self();
      function snap(){return Object.keys(P).map(function(k){return P[k]})}
      function firePeers(ch){var c={peers:snap(),joined:ch.joined||[],left:ch.left||[],updated:ch.updated||[]};PL.forEach(function(f){try{f(c)}catch(e){}})}
      function announce(){if(alive)pub('pr',{id:rid(),peer:ME,pres:pres})}

      function onMsg(sub,buf){
        var m;try{m=JSON.parse(String(buf))}catch(e){return}
        if(!m||typeof m!=='object'||typeof m.peer!=='string'||m.peer===ME)return;
        if(typeof m.id!=='string'||dup(m.id))return;
        if(sub==='ev'){
          if(typeof m.topic!=='string')return;
          (L[m.topic]||[]).forEach(function(f){try{f({topic:m.topic,data:m.data,peer:m.peer,isMe:false,sameTab:false,kind:'viewer',guest:false,by:null})}catch(e){}});
        }else if(sub==='pr'){
          var isNew=!P[m.peer];
          P[m.peer]={peer:m.peer,isMe:false,sameTab:false,kind:'viewer',guest:false,by:null,presence:(m.pres&&typeof m.pres==='object')?m.pres:{},updatedAt:Date.now(),seen:Date.now()};
          firePeers(isNew?{joined:[P[m.peer]]}:{updated:[P[m.peer]]});
          if(isNew)announce();
        }else if(sub==='bye'){
          var p=P[m.peer];if(p){delete P[m.peer];firePeers({left:[p]})}
        }
      }
      var hb=setInterval(announce,3000);
      var sweep=setInterval(function(){var now=Date.now(),gone=[];Object.keys(P).forEach(function(k){if(k!==ME&&now-(P[k].seen||0)>10000){gone.push(P[k]);delete P[k]}});if(gone.length)firePeers({left:gone})},2000);
      function bye(){pub('bye',{id:rid(),peer:ME})}
      window.addEventListener('pagehide',bye);

      var api={
        name:name,
        emit:function(topic,data){
          if(!isConn())return Promise.resolve();
          var id=rid();pub('ev',{id:id,peer:ME,topic:topic,data:data});
          var copy=JSON.parse(JSON.stringify(data===undefined?null:data));
          setTimeout(function(){(L[topic]||[]).forEach(function(f){try{f({topic:topic,data:copy,peer:ME,isMe:true,sameTab:true,kind:'viewer',guest:false,by:null})}catch(e){}})},0);
          return Promise.resolve();
        },
        on:function(topic,fn){(L[topic]=L[topic]||[]).push(fn);return function(){L[topic]=(L[topic]||[]).filter(function(g){return g!==fn})}},
        presence:function(patch){Object.keys(patch||{}).forEach(function(k){if(patch[k]===null)delete pres[k];else pres[k]=patch[k]});P[ME]=self();firePeers({updated:[P[ME]]});announce();return Promise.resolve()},
        peers:function(){return snap()},
        onPeers:function(fn){PL.push(fn);setTimeout(function(){fn({peers:snap(),joined:snap(),left:[],updated:[]})},0);return function(){PL=PL.filter(function(g){return g!==fn})}},
        connected:isConn,
        onConnection:function(fn){CL.push(fn);setTimeout(function(){fn(isConn())},0);return function(){CL=CL.filter(function(g){return g!==fn})}},
        leave:function(){if(!alive)return Promise.resolve();bye();alive=false;clearInterval(hb);clearInterval(sweep);window.removeEventListener('pagehide',bye);clients.forEach(function(c){c.end(false)});return Promise.resolve()}
      };
    });
  }
  window.WDLive={join:join};
})();
