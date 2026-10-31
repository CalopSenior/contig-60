import {Peer} from './peer';
import {participants,type Config,type Player} from './game';
/** Full mesh: signaling is manual; gameplay never passes through a central server. */
export class Room {
 readonly peers=new Map<Player,Peer>();readonly ready=new Set<Player>();
 constructor(readonly id:string,readonly me:Player,readonly config:Config,private receive:(sender:Player,data:unknown)=>void,private changed:()=>void){}
 get members(){return participants(this.config);}
 get linked(){return this.members.every(p=>p===this.me||this.peers.get(p)?.channel?.readyState==='open');}
 get complete(){return this.linked&&this.members.every(p=>this.ready.has(p));}
 private update(){if(this.linked){this.ready.add(this.me);for(const p of this.peers.values())p.send({type:'READY',room:this.id});}else {this.ready.delete(this.me);for(const p of this.peers.values())if(p.channel?.readyState==='open')p.send({type:'NOT_READY',room:this.id});}this.changed();}
 private create(target:Player){if(target===this.me||!this.members.includes(target))throw Error('Destino inválido');if(this.peers.has(target))throw Error('Esse par já foi criado. Processe a resposta ou recarregue para recomeçar.');const peer=new Peer(data=>{const m=data as any;if(m?.type==='READY'||m?.type==='NOT_READY'){if(m.room!==this.id)throw Error('Sala inválida');if(m.type==='READY')this.ready.add(target);else this.ready.delete(target);this.changed();}else this.receive(target,data);},state=>{if(state!=='connected'){this.ready.delete(target);}this.update();});this.peers.set(target,peer);return peer;}
 async offer(target:Player){const peer=this.create(target);return JSON.stringify({room:this.id,from:this.me,to:target,config:this.config,sdp:JSON.parse(await peer.offer())});}
 async process(raw:string){const m=JSON.parse(raw);if(m.room!==this.id||m.to!==this.me||!this.members.includes(m.from)||JSON.stringify(m.config)!==JSON.stringify(this.config))throw Error('Código de outra sala, jogador ou configuração.');if(m.sdp?.type==='answer'){const peer=this.peers.get(m.from);if(!peer)throw Error('Oferta inexistente');await peer.accept(JSON.stringify(m.sdp));return ''; }if(m.sdp?.type!=='offer')throw Error('Sinalização inválida');const peer=this.create(m.from);return JSON.stringify({room:this.id,from:this.me,to:m.from,config:this.config,sdp:JSON.parse(await peer.answer(JSON.stringify(m.sdp)))});}
 send(data:unknown){if(!this.complete)throw Error('Todos os jogadores precisam estar conectados.');for(const p of this.peers.values())p.send(data);}
 close(){for(const p of this.peers.values())p.close();}
}
