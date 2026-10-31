import {solutions} from './solver';
export type Player = 'P1' | 'P2' | 'P3' | 'P4';
export type Config = {mode:'CONTIG'|'CLASSIC';timer:boolean;penalty:boolean;rounds:number;expanded?:boolean;playerCount?:2|3|4;names?:Partial<Record<Player,string>>};
export type State = {board:{id:number;value:number;owner:Player|null}[];players:Record<Player,{score:number;color:string;name:string}>;currentTurn:Player;order:Player[];phase:'ROLL_DICE'|'INPUT_MATH'|'STEAL_OPPORTUNITY'|'GAME_OVER';currentDice:number[];winner:Player|'DRAW'|null;config:Config;turns:number;deadline:number|null;sequence:number;placements:{player:Player;cell:number;value:number;dice:number[];expressions:readonly string[];points:number;steal:boolean}[]};
export type Action = {type:'ROLL';dice:number[]}|{type:'PLACE';cell:number}|{type:'PASS'}|{type:'TIMEOUT'};
export const values=[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,18,20,21,24,25,27,28,30,32,36,40,42,45,48,50,54,60,64,72,75];
export const other=(p:Player):Player=>p==='P1'?'P2':'P1';
export function playerName(value:unknown,fallback:Player):string{return typeof value==='string'?value.trim().slice(0,24)||fallback:fallback;}
export function participants(config:Config):Player[]{return (['P1','P2','P3','P4'] as Player[]).slice(0,config.expanded?(config.playerCount??2):2);}
export function nextPlayer(s:State):Player{return s.order[(s.order.indexOf(s.currentTurn)+1)%s.order.length];}
export function initial(config:Config,first:Player,order?:Player[]):State{
 const ids=participants(config);const start=ids.indexOf(first);if(start<0)throw Error('Jogador inicial inválido');
 const sorted=order??[...ids.slice(start),...ids.slice(0,start)];if(sorted.length!==ids.length||new Set(sorted).size!==ids.length||sorted.some(p=>!ids.includes(p))||sorted[0]!==first)throw Error('Ordem inválida');
 const players=Object.fromEntries(ids.map((p,i)=>[p,{score:config.mode==='CLASSIC'?0:60,color:['blue','red','purple','gold'][i],name:playerName(config.names?.[p],p)}])) as State['players'];
 return {board:values.map((value,id)=>({id,value,owner:null})),players,currentTurn:first,order:sorted,phase:'ROLL_DICE',currentDice:[0,0,0],winner:null,config,turns:0,deadline:null,sequence:0,placements:[]};
}
export function shuffledOrder(config:Config):Player[]{const order=participants(config);for(let i=order.length-1;i>0;i--){const a=new Uint32Array(1),limit=Math.floor(4294967296/(i+1))*(i+1);do{crypto.getRandomValues(a);}while(a[0]>=limit);const j=a[0]%(i+1);[order[i],order[j]]=[order[j],order[i]];}return order;}
// Recursive descent AST; only binary + - * / and parentheses are accepted.
type AST={kind:'number';value:number}|{kind:'binary';op:string;left:AST;right:AST};
export function evaluate(expression:string,dice:number[]):number{
 if(expression.length>120)throw Error('Expressão muito longa.');
 const tokens=expression.match(/\d+|[()+*/-]|\S/g)??[];let i=0;const used:number[]=[];
 function atom():AST{const t=tokens[i++];if(t==='('){const n=sum();if(tokens[i++]!==')')throw Error('Feche os parênteses.');return n;}if(!t||!/^\d+$/.test(t)||t.length!==1)throw Error('Use apenas dados, operações e parênteses.');const value=Number(t);used.push(value);return {kind:'number',value};}
 function product():AST{let n=atom();while(['*','/'].includes(tokens[i])){const op=tokens[i++];n={kind:'binary',op,left:n,right:atom()};}return n;}
 function sum():AST{let n=product();while(['+','-'].includes(tokens[i])){const op=tokens[i++];n={kind:'binary',op,left:n,right:product()};}return n;}
 const ast=sum();if(i!==tokens.length)throw Error('Expressão inválida.');if([...used].sort().join()!==[...dice].sort().join())throw Error('Use cada um dos três dados exatamente uma vez.');
 function calc(n:AST):number{if(n.kind==='number')return n.value;const a=calc(n.left),b=calc(n.right);if(n.op==='/'&&b===0)throw Error('Divisão por zero.');return n.op==='+'?a+b:n.op==='-'?a-b:n.op==='*'?a*b:a/b;}
 return calc(ast);
}
export function neighbors(s:State,id:number){return s.board.filter(c=>c.id!==id&&Math.abs(Math.floor(c.id/6)-Math.floor(id/6))<=1&&Math.abs(c.id%6-id%6)<=1&&c.owner!==null).length;}
export function line(s:State,p:Player){return s.board.some(c=>[[0,1],[1,0],[1,1],[1,-1]].some(([dr,dc])=>Array.from({length:5},(_,k)=>{const r=Math.floor(c.id/6)+dr*k,col=c.id%6+dc*k;return r>=0&&r<6&&col>=0&&col<6&&s.board[r*6+col].owner===p;}).every(Boolean)));}
function finish(s:State,p:Player){if(s.config.mode==='CONTIG'&&line(s,p)){s.winner=p;}else if(s.board.every(c=>c.owner)||s.config.mode==='CLASSIC'&&s.turns>=s.config.rounds*s.order.length){const scores=s.order.map(id=>s.players[id].score),best=s.config.mode==='CLASSIC'?Math.max(...scores):Math.min(...scores),winners=s.order.filter(id=>s.players[id].score===best);s.winner=winners.length===1?winners[0]:'DRAW';}if(s.winner){s.phase='GAME_OVER';s.deadline=null;}}
export function reduce(before:State,actor:Player,a:Action,now:number):State{
 const s=structuredClone(before);if(actor!==s.currentTurn||s.phase==='GAME_OVER')throw Error('Aguarde sua vez.');
 if(a.type==='ROLL'){if(s.phase!=='ROLL_DICE'||a.dice.length!==3||a.dice.some(n=>!Number.isInteger(n)||n<1||n>6))throw Error('Dados inválidos.');s.currentDice=a.dice;s.phase='INPUT_MATH';s.deadline=s.config.timer?now+30000:null;}
 else if(a.type==='PLACE'){
 if(!['INPUT_MATH','STEAL_OPPORTUNITY'].includes(s.phase))throw Error('Role os dados primeiro.');if(s.deadline!==null&&now>=s.deadline)throw Error('Tempo esgotado.');
 const c=s.board[a.cell];if(!c||c.owner!==null)throw Error('Selecione uma casa livre.');const expressions=solutions(s.currentDice)[c.value];if(!expressions?.length)throw Error('Casa impossível.');
 const steal=s.phase==='STEAL_OPPORTUNITY',points=neighbors(s,a.cell)*(steal?2:1);s.placements.push({player:actor,cell:a.cell,value:c.value,dice:[...s.currentDice],expressions:[...expressions],points,steal});c.owner=actor;s.players[actor].score+=points*(s.config.mode==='CLASSIC'?1:-1);s.deadline=null;s.phase='ROLL_DICE';if(!steal){s.turns++;s.currentTurn=nextPlayer(s);}finish(s,actor);
 }else{
 if(a.type==='TIMEOUT'&&(s.phase!=='INPUT_MATH'||s.deadline===null||now<s.deadline))throw Error('O tempo ainda não acabou.');
 if(!['INPUT_MATH','STEAL_OPPORTUNITY'].includes(s.phase))throw Error('Não é possível passar agora.');
 if(a.type==='TIMEOUT'&&s.config.penalty)s.players[actor].score+=s.config.mode==='CLASSIC'?-5:5;
 if(s.phase==='INPUT_MATH'){s.phase='STEAL_OPPORTUNITY';s.currentTurn=nextPlayer(s);s.turns++;}else{s.phase='ROLL_DICE';finish(s,actor);}s.deadline=null;
 }s.sequence++;return s;
}
export function die(){const a=new Uint32Array(1);do{crypto.getRandomValues(a);}while(a[0]>=4294967292);return a[0]%6+1;}
