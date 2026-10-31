export class Peer {
 pc=new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'}]});channel?:RTCDataChannel;
 constructor(private receive:(data:unknown)=>void,private status:(s:string)=>void){this.pc.ondatachannel=e=>this.bind(e.channel);this.pc.onconnectionstatechange=()=>{if(this.pc.connectionState!=='connected')status(this.pc.connectionState);};}
 bind(c:RTCDataChannel){this.channel=c;c.onopen=()=>this.status('connected');c.onclose=()=>this.status('disconnected');c.onmessage=e=>{try{if(typeof e.data!=='string'||e.data.length>100000)throw Error();this.receive(JSON.parse(e.data));}catch{this.status('Mensagem inválida rejeitada');}};}
 async local(){await new Promise<void>(resolve=>{if(this.pc.iceGatheringState==='complete')return resolve();const done=()=>{if(this.pc.iceGatheringState==='complete'){this.pc.removeEventListener('icegatheringstatechange',done);resolve();}};this.pc.addEventListener('icegatheringstatechange',done);setTimeout(resolve,5000);});if(!this.pc.localDescription?.sdp.includes('a=candidate:'))throw Error('Nenhuma rota WebRTC disponível nesta rede. Verifique firewall, STUN ou configure TURN.');return JSON.stringify(this.pc.localDescription);}
 async offer(){this.bind(this.pc.createDataChannel('contig',{ordered:true}));await this.pc.setLocalDescription(await this.pc.createOffer());return this.local();}
 async answer(code:string){await this.pc.setRemoteDescription(JSON.parse(code));await this.pc.setLocalDescription(await this.pc.createAnswer());return this.local();}
 async accept(code:string){await this.pc.setRemoteDescription(JSON.parse(code));}
 send(data:unknown){if(this.channel?.readyState!=='open')throw Error('Conexão indisponível. Partida pausada.');this.channel.send(JSON.stringify(data));}
 close(){this.pc.close();}
}
export async function hash(data:unknown){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(data))))].map(n=>n.toString(16).padStart(2,'0')).join('');}
