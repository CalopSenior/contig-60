/** Enumerate every binary tree and permutation using each die exactly once.
 * Rational arithmetic avoids floating-point false negatives on integer targets.
 */
type Term = {n:number;d:number;expression:string};
const cache=new Map<string,Readonly<Record<number,readonly string[]>>>();
export function solutions(dice:readonly number[]):Readonly<Record<number,readonly string[]>> {
 if(dice.length!==3||dice.some(n=>!Number.isInteger(n)||n<1||n>6))throw Error('Dados inválidos');
 const sorted=[...dice].sort(),key=sorted.join(',');const saved=cache.get(key);if(saved)return saved;
 function trees(numbers:number[]):Term[]{
  if(numbers.length===1)return [{n:numbers[0],d:1,expression:String(numbers[0])}];
  const terms:Term[]=[];
  for(let mask=1;mask<(1<<numbers.length)-1;mask++){
   const left=numbers.filter((_,i)=>mask&(1<<i)),right=numbers.filter((_,i)=>!(mask&(1<<i)));
   for(const a of trees(left))for(const b of trees(right))for(const op of ['+','-','*','/']){
    if(op==='/'&&b.n===0)continue;
    const n=op==='+'?a.n*b.d+b.n*a.d:op==='-'?a.n*b.d-b.n*a.d:op==='*'?a.n*b.n:a.n*b.d;
    const d=op==='/'?a.d*b.n:a.d*b.d;
    terms.push({n,d,expression:`(${a.expression} ${op} ${b.expression})`});
   }
  }return terms;
 }
 const groups=new Map<number,Set<string>>();
 for(const term of trees(sorted)){if(term.n%term.d!==0)continue;const value=term.n/term.d;if(!groups.has(value))groups.set(value,new Set());groups.get(value)!.add(term.expression);}
 const result=Object.freeze(Object.fromEntries([...groups].map(([value,expressions])=>[value,Object.freeze([...expressions].sort())])));
 cache.set(key,result);return result;
}
