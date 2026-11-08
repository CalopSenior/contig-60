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

/* ---------- Mais de três dados (Mesão) ---------- */
type Frac = {n: number; d: number};
const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));
const fracCache = new Map<string, Frac[]>();
const reachCache = new Map<string, ReadonlySet<number>>();
const sortedKey = (numbers: readonly number[]) => [...numbers].sort((a, b) => a - b).join(',');

/** Todos os valores racionais (sem repetição) que usam cada número exatamente uma vez. */
function fractions(numbers: readonly number[]): Frac[] {
  const key = sortedKey(numbers), saved = fracCache.get(key);
  if (saved) return saved;
  let result: Frac[];
  if (numbers.length === 1) result = [{n: numbers[0], d: 1}];
  else {
    const found = new Map<string, Frac>();
    const add = (n: number, d: number) => {
      if (d < 0) { n = -n; d = -d; }
      const g = gcd(n, d) || 1;
      n /= g; d /= g;
      if (n === 0) d = 1;
      found.set(`${n}/${d}`, {n, d});
    };
    for (let mask = 1; mask < (1 << numbers.length) - 1; mask++) {
      const left = numbers.filter((_, i) => mask & (1 << i)), right = numbers.filter((_, i) => !(mask & (1 << i)));
      for (const a of fractions(left)) for (const b of fractions(right)) {
        add(a.n * b.d + b.n * a.d, a.d * b.d);
        add(a.n * b.d - b.n * a.d, a.d * b.d);
        add(a.n * b.n, a.d * b.d);
        if (b.n !== 0) add(a.n * b.d, a.d * b.n);
      }
    }
    result = [...found.values()];
  }
  fracCache.set(key, result);
  return result;
}

/** Subconjuntos de `dice` obtidos descartando um dado (sem repetições). Com 3 ou 4 dados, usa todos. */
function usable(dice: readonly number[]): number[][] {
  if (dice.length <= 4) return [[...dice].sort((a, b) => a - b)];
  const seen = new Set<string>(), out: number[][] = [];
  for (let drop = 0; drop < dice.length; drop++) {
    const rest = dice.filter((_, i) => i !== drop).sort((a, b) => a - b), key = rest.join(',');
    if (!seen.has(key)) { seen.add(key); out.push(rest); }
  }
  return out;
}

function checkDice(dice: readonly number[]) {
  if (dice.length < 3 || dice.length > 5 || dice.some(n => !Number.isInteger(n) || n < 1 || n > 6)) throw Error('Dados inválidos');
}

/**
 * Valores inteiros que a rolagem consegue formar. Com 3 ou 4 dados usa todos;
 * com 5 dados, o jogador descarta um e usa os outros quatro. Não gera texto: é rápido.
 */
export function reachableValues(dice: readonly number[]): ReadonlySet<number> {
  checkDice(dice);
  const key = sortedKey(dice), saved = reachCache.get(key);
  if (saved) return saved;
  const values = new Set<number>();
  for (const subset of usable(dice)) for (const f of fractions(subset)) if (f.d === 1) values.add(f.n === 0 ? 0 : f.n);
  reachCache.set(key, values);
  return values;
}
export const canForm = (dice: readonly number[], value: number) => dice.length > 0 && dice.every(d => d >= 1) && reachableValues(dice).has(value);

type Term2 = {n: number; d: number; e: string};
const termCache = new Map<string, Term2[]>();
function terms(numbers: readonly number[]): Term2[] {
  const key = sortedKey(numbers), saved = termCache.get(key);
  if (saved) return saved;
  const sorted = [...numbers].sort((a, b) => a - b);
  let out: Term2[];
  if (sorted.length === 1) out = [{n: sorted[0], d: 1, e: String(sorted[0])}];
  else {
    out = [];
    for (let mask = 1; mask < (1 << sorted.length) - 1; mask++) {
      const left = sorted.filter((_, i) => mask & (1 << i)), right = sorted.filter((_, i) => !(mask & (1 << i)));
      for (const a of terms(left)) for (const b of terms(right)) for (const op of ['+', '-', '*', '/']) {
        if (op === '/' && b.n === 0) continue;
        out.push(combine(a, b, op));
      }
    }
  }
  termCache.set(key, out);
  return out;
}
function combine(a: Term2, b: Term2, op: string): Term2 {
  const n = op === '+' ? a.n * b.d + b.n * a.d : op === '-' ? a.n * b.d - b.n * a.d : op === '*' ? a.n * b.n : a.n * b.d;
  const d = op === '/' ? a.d * b.n : a.d * b.d;
  return {n, d, e: `(${a.e} ${op} ${b.e})`};
}

/**
 * Expressões que formam `value`. Ordem estável (alfabética), igual em todos os dispositivos.
 * `limit` evita registrar milhares de contas quando há 4 dados.
 */
export function expressionsFor(dice: readonly number[], value: number, limit = Infinity): string[] {
  checkDice(dice);
  const found = new Set<string>();
  for (const subset of usable(dice)) {
    if (subset.length === 1) continue;
    for (let mask = 1; mask < (1 << subset.length) - 1; mask++) {
      const left = subset.filter((_, i) => mask & (1 << i)), right = subset.filter((_, i) => !(mask & (1 << i)));
      for (const a of terms(left)) for (const b of terms(right)) for (const op of ['+', '-', '*', '/']) {
        if (op === '/' && b.n === 0) continue;
        const t = combine(a, b, op);
        if (t.n % t.d === 0 && t.n / t.d === value) found.add(t.e);
      }
    }
  }
  return [...found].sort().slice(0, limit);
}
