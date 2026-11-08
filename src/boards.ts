import {reachableValues} from './solver';

/** Um tabuleiro quadrado pronto para jogar. `cells` vai em ordem de linhas. */
export type BoardSpec = {id: string; name: string; size: number; line: number; cells: number[]};

export type BoardDef = {
  id: string;
  name: string;
  tagline: string;
  size: number;
  line: number;
  /** Tabuleiros sorteados mudam a cada clique em "sortear de novo". */
  random: boolean;
  /** Mesão: tabuleiro grande, para muitos jogadores. */
  table: boolean;
  dice: DiceCount;
  make: () => number[];
};

/* ---------- Probabilidades ---------- */

export type DiceCount = 3 | 5;
const FACT = [1, 1, 2, 6, 24, 120];

/** Todas as combinações de `n` dados (sem ordem) com seu peso entre as 6^n possíveis. */
function rolls(n: number): {dice: number[]; weight: number}[] {
  const list: {dice: number[]; weight: number}[] = [];
  const walk = (dice: number[], min: number) => {
    if (dice.length === n) {
      const counts = new Map<number, number>();
      for (const d of dice) counts.set(d, (counts.get(d) ?? 0) + 1);
      list.push({dice: [...dice], weight: FACT[n] / [...counts.values()].reduce((x, c) => x * FACT[c], 1)});
      return;
    }
    for (let d = min; d <= 6; d++) walk([...dice, d], d);
  };
  walk([], 1);
  return list;
}

const coverageCache = new Map<number, Map<number, number>>();
/** Para cada valor atingível: chance (0 a 1) de que uma rolada consiga formá-lo. */
export function coverage(dice: DiceCount = 3): ReadonlyMap<number, number> {
  let map = coverageCache.get(dice);
  if (!map) {
    map = new Map<number, number>();
    for (const roll of rolls(dice)) for (const value of reachableValues(roll.dice)) map.set(value, (map.get(value) ?? 0) + roll.weight / 6 ** dice);
    coverageCache.set(dice, map);
  }
  return map;
}

/** Valores que podem aparecer num tabuleiro: inteiros não negativos que algum lançamento consegue formar. */
export const reachable = (value: number, dice: DiceCount = 3) => Number.isInteger(value) && value >= 0 && coverage(dice).has(value);
export const universe = (dice: DiceCount = 3) => [...coverage(dice).keys()].filter(v => v >= 0).sort((a, b) => a - b);

/** 0 = muito comum ... 4 = raríssimo. Usado para colorir os números. */
export const TIER_LIMITS = [0.5, 0.3, 0.15, 0.05] as const;
export function tier(value: number, dice: DiceCount = 3): 0 | 1 | 2 | 3 | 4 {
  const p = coverage(dice).get(value) ?? 0;
  return p >= TIER_LIMITS[0] ? 0 : p >= TIER_LIMITS[1] ? 1 : p >= TIER_LIMITS[2] ? 2 : p >= TIER_LIMITS[3] ? 3 : 4;
}

/* ---------- Aleatoriedade ---------- */

export type Rng = () => number;
export const cryptoRng: Rng = () => {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] / 4294967296;
};
/** PRNG determinístico (mulberry32) para o "Desafio do dia". */
export function seeded(seed: number): Rng {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
export function shuffle<T>(list: readonly T[], rng: Rng): T[] {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/* ---------- Tabuleiros ---------- */

/** O tabuleiro oficial da PUC: 8×8, de 0 a 180, em espiral com cada anel crescente. */
export const PUC: readonly number[] = [
  0, 1, 2, 3, 4, 5, 6, 7,
  27, 28, 29, 30, 31, 32, 33, 8,
  26, 54, 55, 60, 64, 66, 34, 9,
  25, 50, 120, 125, 144, 72, 35, 10,
  24, 48, 108, 180, 150, 75, 36, 11,
  23, 45, 100, 96, 90, 80, 37, 12,
  22, 44, 42, 41, 40, 39, 38, 13,
  21, 20, 19, 18, 17, 16, 15, 14,
];

/** Versão curta de 36 casas, usada nas primeiras versões do jogo. */
const RAPIDO: readonly number[] = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 18, 20,
  21, 24, 25, 27, 28, 30, 32, 36, 40, 42, 45, 48, 50, 54, 60, 64, 72, 75,
];

/** Posições (índice no vetor) na ordem da espiral: cada anel começa no canto superior esquerdo. */
function spiralOrder(size: number): number[] {
  const order: number[] = [];
  for (let r = 0; r < size / 2; r++) {
    const last = size - 1 - r;
    for (let c = r; c <= last; c++) order.push(r * size + c);
    for (let y = r + 1; y <= last; y++) order.push(y * size + last);
    for (let c = last - 1; c >= r; c--) order.push(last * size + c);
    for (let y = last - 1; y > r; y--) order.push(y * size + r);
  }
  return order;
}

const rarity = (a: number, b: number) => (coverage().get(b)! - coverage().get(a)!) || a - b;

/** Sorteia valores (com repetição) onde cada um pesa `weight(value)`. */
function weighted(count: number, weight: (value: number) => number, rng: Rng, dice: DiceCount = 3): number[] {
  const values = universe(dice), weights = values.map(weight), total = weights.reduce((x, y) => x + y, 0);
  return Array.from({length: count}, () => {
    let r = rng() * total;
    for (let i = 0; i < values.length; i++) { r -= weights[i]; if (r < 0) return values[i]; }
    return values[values.length - 1];
  });
}

/** Distribui as casas igualmente entre quatro faixas de raridade (valores podem se repetir). */
function balanced(count: number, rng: Rng): number[] {
  const sorted = universe().sort(rarity), per = Math.ceil(sorted.length / 4);
  const bands = [0, 1, 2, 3].map(i => sorted.slice(i * per, (i + 1) * per));
  return shuffle(Array.from({length: count}, (_, i) => { const band = bands[i % 4]; return band[Math.floor(rng() * band.length)]; }), rng);
}

function dayKey(date = new Date()) {
  return date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
}

export const BOARD_DEFS: readonly BoardDef[] = [
  {id: 'puc', name: 'Oficial PUC', tagline: 'O clássico: 8×8 em espiral, de 0 a 180.', size: 8, line: 5, random: false, table: false, dice: 3, make: () => [...PUC]},
  {id: 'puc-shuffle', name: 'PUC embaralhado', tagline: 'Os mesmos 64 números, em lugares aleatórios.', size: 8, line: 5, random: true, table: false, dice: 3, make: () => shuffle(PUC, cryptoRng)},
  {id: 'random', name: 'Totalmente aleatório', tagline: '64 números sorteados (e que podem se repetir) entre todos os possíveis.', size: 8, line: 5, random: true, table: false, dice: 3, make: () => weighted(64, () => 1, cryptoRng)},
  {id: 'balanced', name: 'Equilibrado', tagline: 'Casas comuns e raras na mesma medida: justo e imprevisível.', size: 8, line: 5, random: true, table: false, dice: 3, make: () => balanced(64, cryptoRng)},
  {id: 'lucky', name: 'Sorte grande', tagline: 'Muitos números fáceis de formar. Partidas rápidas e cheias de linhas.', size: 8, line: 5, random: true, table: false, dice: 3, make: () => weighted(64, v => coverage().get(v)! ** 2, cryptoRng)},
  {id: 'inverted', name: 'Espiral invertida', tagline: 'O PUC de ponta-cabeça: os gigantes ficam nas bordas.', size: 8, line: 5, random: false, table: false, dice: 3, make: () => {const order = spiralOrder(8), out = new Array<number>(64); order.forEach((cell, i) => {out[cell] = PUC[order[63 - i]];}); return out;}},
  {id: 'rapido', name: 'Rápido 6×6', tagline: '36 casas e linha de 4. Dá para terminar num café.', size: 6, line: 4, random: false, table: false, dice: 3, make: () => [...RAPIDO]},
  {id: 'daily', name: 'Desafio do dia', tagline: 'Um PUC embaralhado que é igual para todo mundo hoje.', size: 8, line: 5, random: false, table: false, dice: 3, make: () => shuffle(PUC, seeded(dayKey() * 7919))},
  {id: 'mesao5-10', name: 'Mesão 10×10', tagline: '100 casas e números enormes (até 1296): 5 dados, descarte um.', size: 10, line: 6, random: true, table: true, dice: 5, make: () => weighted(100, v => coverage(5).get(v)!, cryptoRng, 5)},
  {id: 'mesao5-12', name: 'Mesão gigante 12×12', tagline: '144 casas para mesas cheias. 5 dados, descarte um.', size: 12, line: 7, random: true, table: true, dice: 5, make: () => weighted(144, v => coverage(5).get(v)!, cryptoRng, 5)},
  {id: 'mesao3-10', name: 'Mesão repetido 10×10', tagline: '100 casas com números repetidos. Regra normal de 3 dados.', size: 10, line: 6, random: true, table: true, dice: 3, make: () => weighted(100, v => coverage(3).get(v)!, cryptoRng)},
  {id: 'mesao3-12', name: 'Mesão repetido 12×12', tagline: '144 casas com números repetidos. Regra normal de 3 dados.', size: 12, line: 7, random: true, table: true, dice: 3, make: () => weighted(144, v => coverage(3).get(v)!, cryptoRng)},
];

export function boardFrom(def: BoardDef, cells = def.make()): BoardSpec {
  return {id: def.id, name: def.name, size: def.size, line: def.line, cells};
}
