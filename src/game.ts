import {canForm, expressionsFor} from './solver';
import {BOARD_DEFS, boardFrom, reachable, type BoardSpec, type DiceCount} from './boards';

/** P1 é sempre o anfitrião. O Mesão não tem limite de jogadores nas regras. */
export type Player = `P${number}`;
/** Só protege contra configurações absurdas vindas da rede (evita alocar milhões de jogadores); não é uma regra do jogo. */
export const SANITY_PLAYER_GUARD = 1000;
export type Config = {
  mode: 'CONTIG' | 'CLASSIC';
  timer: boolean;
  penalty: boolean;
  /** Rodadas até o jogo acabar por tempo. 0 = sem limite. */
  rounds: number;
  playerCount: number;
  /** 3 dados normais, ou 5 dados com descarte de um (só no Mesão). */
  dice: DiceCount;
  /** Mesão: muitos jogadores, vários ativos ao mesmo tempo. */
  table: boolean;
  /** Mesão: quantos jogadores têm a iniciativa ao mesmo tempo. 0 = automático (3, ou 5 com mesas grandes). */
  initiative: number;
  board: BoardSpec;
  names?: Partial<Record<Player, string>>;
};
export type Placement = {player: Player; cell: number; value: number; dice: number[]; expressions: readonly string[]; points: number; steal: boolean};
/** Jogador com a iniciativa no Mesão. */
export type Seat = {player: Player; phase: 'ROLL_DICE' | 'INPUT_MATH'; dice: number[]; deadline: number | null};
export type State = {
  board: {id: number; value: number; owner: Player | null}[];
  players: Record<Player, {score: number; color: string; name: string}>;
  currentTurn: Player;
  order: Player[];
  phase: 'ROLL_DICE' | 'INPUT_MATH' | 'STEAL_OPPORTUNITY' | 'GAME_OVER';
  currentDice: number[];
  winner: Player | 'DRAW' | null;
  /** Como a partida terminou. */
  endedBy: 'LINE' | 'FULL' | 'ROUNDS' | null;
  winningCells: number[];
  config: Config;
  turns: number;
  deadline: number | null;
  sequence: number;
  placements: Placement[];
  /** Mesão: quem tem a iniciativa agora, e a fila de espera. */
  active: Seat[];
  queue: Player[];
};
export type Action = {type: 'ROLL'; dice: number[]} | {type: 'PLACE'; cell: number} | {type: 'PASS'} | {type: 'TIMEOUT'} | {type: 'SKIP'};
export const ACTION_TYPES = ['ROLL', 'PLACE', 'PASS', 'TIMEOUT', 'SKIP'];

export const MIN_LINE = 3;
/** Registradas no máximo tantas contas por jogada quando há mais de 3 dados. */
const EXPRESSION_LIMIT = 40;
export const playerIds = (count: number): Player[] => Array.from({length: count}, (_, i) => `P${i + 1}` as Player);
export const other = (p: Player): Player => (p === 'P1' ? 'P2' : 'P1');
export function playerName(value: unknown, fallback: Player): string {
  return typeof value === 'string' ? value.trim().slice(0, 24) || fallback : fallback;
}
export function participants(config: Pick<Config, 'playerCount'>): Player[] { return playerIds(config.playerCount); }
export function nextPlayer(s: State): Player {
  return s.order[(s.order.indexOf(s.currentTurn) + 1) % s.order.length];
}
/** Quantos jogadores ficam ativos ao mesmo tempo no Mesão. */
export function initiativeOf(c: Pick<Config, 'initiative' | 'playerCount' | 'table'>): number {
  if (!c.table) return 1;
  return Math.min(c.playerCount, c.initiative || (c.playerCount > 10 ? 5 : 3));
}

const PALETTE = ['#4da3ff', '#ff6b6b', '#b084ff', '#ffc94d', '#4ade80', '#ff8fd0', '#2dd4bf', '#fb923c'];
/** Cor do jogador: oito cores fixas e, depois, matizes distribuídos. */
export function playerColor(p: Player): string {
  const i = Number(p.slice(1)) - 1;
  return i < PALETTE.length ? PALETTE[i] : `hsl(${Math.round((i * 137.5) % 360)} 75% 62%)`;
}

/** Valida e normaliza uma configuração vinda da rede ou da interface. Lança erro se for inválida. */
export function sanitizeConfig(raw: unknown): Config {
  const c = raw as Partial<Config> | null;
  if (!c || typeof c !== 'object') throw Error('Configuração inválida.');
  if (c.mode !== 'CONTIG' && c.mode !== 'CLASSIC') throw Error('Modo inválido.');
  if (typeof c.timer !== 'boolean' || typeof c.penalty !== 'boolean') throw Error('Regras inválidas.');
  if (!Number.isInteger(c.rounds) || c.rounds! < 0 || c.rounds! > 100) throw Error('Rodadas inválidas.');
  const table = c.table === true, count = c.playerCount, dice = c.dice ?? 3, initiative = c.initiative ?? (table ? 0 : 1);
  if (!Number.isInteger(count) || count! < 2 || count! > (table ? SANITY_PLAYER_GUARD : 4)) throw Error('Número de jogadores inválido.');
  if (dice !== 3 && dice !== 5) throw Error('Dados inválidos.');
  if (!table && (dice !== 3 || initiative !== 1)) throw Error('Regras do Mesão fora do Mesão.');
  if (!Number.isInteger(initiative) || initiative < 0 || initiative > 9) throw Error('Iniciativas inválidas.');
  const b = c.board as Partial<BoardSpec> | undefined;
  if (!b || typeof b.id !== 'string' || typeof b.name !== 'string' || !Number.isInteger(b.size) || !Number.isInteger(b.line) || !Array.isArray(b.cells)) throw Error('Tabuleiro inválido.');
  if (b.size! < 3 || b.size! > 12 || b.line! < MIN_LINE || b.line! > b.size! || b.cells.length !== b.size! ** 2 || !b.cells.every(v => reachable(v, dice))) throw Error('Tabuleiro inválido.');
  const config: Config = {
    mode: c.mode, timer: c.timer, penalty: c.penalty, rounds: c.rounds!, playerCount: count!, dice, table, initiative,
    board: {id: b.id.slice(0, 24), name: b.name.slice(0, 40), size: b.size!, line: b.line!, cells: [...b.cells]},
  };
  if (c.names) config.names = Object.fromEntries(participants(config).map(p => [p, playerName(c.names![p], p)]));
  return config;
}

/** Configuração padrão: tabuleiro oficial, Contig 60, 20 rodadas. */
export function defaultConfig(overrides: Partial<Config> = {}): Config {
  return sanitizeConfig({mode: 'CONTIG', timer: false, penalty: false, rounds: 20, playerCount: 2, dice: 3, table: false, initiative: 1, board: boardFrom(BOARD_DEFS[0]), ...overrides});
}

const blankSeat = (player: Player): Seat => ({player, phase: 'ROLL_DICE', dice: [], deadline: null});

export function initial(config: Config, first: Player, order?: Player[]): State {
  const ids = participants(config), start = ids.indexOf(first);
  if (start < 0) throw Error('Jogador inicial inválido');
  const sorted = order ?? [...ids.slice(start), ...ids.slice(0, start)];
  if (sorted.length !== ids.length || new Set(sorted).size !== ids.length || sorted.some(p => !ids.includes(p)) || sorted[0] !== first) throw Error('Ordem inválida');
  const players = Object.fromEntries(ids.map(p => [p, {score: config.mode === 'CLASSIC' ? 0 : 60, color: playerColor(p), name: playerName(config.names?.[p], p)}])) as State['players'];
  const k = config.table ? initiativeOf(config) : 0;
  return {
    board: config.board.cells.map((value, id) => ({id, value, owner: null})), players, currentTurn: first, order: sorted, phase: 'ROLL_DICE',
    currentDice: config.table ? [] : [0, 0, 0], winner: null, endedBy: null, winningCells: [], config, turns: 0, deadline: null, sequence: 0, placements: [],
    active: sorted.slice(0, k).map(blankSeat), queue: sorted.slice(k),
  };
}

export function shuffledOrder(config: Config): Player[] {
  const order = participants(config);
  for (let i = order.length - 1; i > 0; i--) {
    const a = new Uint32Array(1), limit = Math.floor(4294967296 / (i + 1)) * (i + 1);
    do { crypto.getRandomValues(a); } while (a[0] >= limit);
    const j = a[0] % (i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

// Recursive descent AST; only binary + - * / and parentheses are accepted.
type AST = {kind: 'number'; value: number} | {kind: 'binary'; op: string; left: AST; right: AST};
export function evaluate(expression: string, dice: number[]): number {
  if (expression.length > 120) throw Error('Expressão muito longa.');
  const tokens = expression.match(/\d+|[()+*/-]|\S/g) ?? [];
  let i = 0;
  const used: number[] = [];
  function atom(): AST {
    const t = tokens[i++];
    if (t === '(') { const n = sum(); if (tokens[i++] !== ')') throw Error('Feche os parênteses.'); return n; }
    if (!t || !/^\d+$/.test(t) || t.length !== 1) throw Error('Use apenas dados, operações e parênteses.');
    const value = Number(t);
    used.push(value);
    return {kind: 'number', value};
  }
  function product(): AST { let n = atom(); while (['*', '/'].includes(tokens[i])) { const op = tokens[i++]; n = {kind: 'binary', op, left: n, right: atom()}; } return n; }
  function sum(): AST { let n = product(); while (['+', '-'].includes(tokens[i])) { const op = tokens[i++]; n = {kind: 'binary', op, left: n, right: product()}; } return n; }
  const ast = sum();
  if (i !== tokens.length) throw Error('Expressão inválida.');
  if ([...used].sort().join() !== [...dice].sort().join()) throw Error('Use cada um dos três dados exatamente uma vez.');
  function calc(n: AST): number {
    if (n.kind === 'number') return n.value;
    const a = calc(n.left), b = calc(n.right);
    if (n.op === '/' && b === 0) throw Error('Divisão por zero.');
    return n.op === '+' ? a + b : n.op === '-' ? a - b : n.op === '*' ? a * b : a / b;
  }
  return calc(ast);
}

export const sizeOf = (s: Pick<State, 'config'>) => s.config.board.size;

export function neighbors(s: State, id: number): number {
  const n = sizeOf(s), r = Math.floor(id / n), c = id % n;
  return s.board.filter(x => x.id !== id && x.owner !== null && Math.abs(Math.floor(x.id / n) - r) <= 1 && Math.abs(x.id % n - c) <= 1).length;
}

/** Tamanho da linha exigida agora. Encolhe ao longo da partida para que ela sempre termine. */
export function lineNeeded(s: State): number {
  const {board, rounds, mode} = s.config;
  if (mode !== 'CONTIG') return board.line;
  const total = rounds * s.order.length, progress = total > 0 ? s.turns / total : 0;
  return Math.max(MIN_LINE, board.line - (progress >= 0.5 ? 1 : 0) - (progress >= 0.75 ? 1 : 0));
}

/** Rodada atual (1-based), limitada ao total quando há limite. */
export function roundOf(s: State): number {
  const round = Math.floor(s.turns / s.order.length) + 1;
  return s.config.rounds > 0 ? Math.min(round, s.config.rounds) : round;
}

/** Casas da primeira linha de `len` peças do jogador, ou null. */
export function lineCells(s: State, p: Player, len = lineNeeded(s)): number[] | null {
  const n = sizeOf(s);
  for (const c of s.board) for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
    const cells: number[] = [];
    for (let k = 0; k < len; k++) {
      const r = Math.floor(c.id / n) + dr * k, col = c.id % n + dc * k;
      if (r < 0 || r >= n || col < 0 || col >= n || s.board[r * n + col].owner !== p) break;
      cells.push(r * n + col);
    }
    if (cells.length === len) return cells;
  }
  return null;
}
export const line = (s: State, p: Player, len = lineNeeded(s)) => lineCells(s, p, len) !== null;

/** A vez (normal) ou a iniciativa (Mesão) de `p`; undefined se não está jogando agora. */
export function seatOf(s: State, p: Player): Seat | undefined {
  return s.config.table ? s.active.find(x => x.player === p) : undefined;
}
/** Dados que `p` tem em mãos agora. */
export function diceOf(s: State, p: Player): number[] {
  return s.config.table ? seatOf(s, p)?.dice ?? [] : p === s.currentTurn ? s.currentDice : [];
}

/** Quantas casas livres os dados informados conseguem formar. */
export function playable(s: State, dice: number[] = s.currentDice): number {
  if (dice.length === 0 || dice.some(d => d < 1)) return 0;
  return s.board.filter(c => c.owner === null && canForm(dice, c.value)).length;
}

function finish(s: State, actor: Player) {
  if (s.config.mode === 'CONTIG') {
    for (const p of [actor, ...s.order.filter(x => x !== actor)]) {
      const cells = lineCells(s, p);
      if (cells) { s.winner = p; s.endedBy = 'LINE'; s.winningCells = cells; break; }
    }
  }
  if (!s.winner) {
    const full = s.board.every(c => c.owner), timeUp = s.config.rounds > 0 && s.turns >= s.config.rounds * s.order.length;
    if (full || timeUp) {
      const scores = s.order.map(id => s.players[id].score), best = s.config.mode === 'CLASSIC' ? Math.max(...scores) : Math.min(...scores);
      const winners = s.order.filter(id => s.players[id].score === best);
      s.winner = winners.length === 1 ? winners[0] : 'DRAW';
      s.endedBy = full ? 'FULL' : 'ROUNDS';
    }
  }
  if (s.winner) { s.phase = 'GAME_OVER'; s.deadline = null; s.active = []; }
}

function place(s: State, actor: Player, cell: number, steal: boolean, dice: number[]) {
  const c = s.board[cell];
  if (!c || c.owner !== null) throw Error('Selecione uma casa livre.');
  if (!canForm(dice, c.value)) throw Error('Casa impossível.');
  const points = neighbors(s, cell) * (steal ? 2 : 1);
  s.placements.push({player: actor, cell, value: c.value, dice: [...dice], expressions: expressionsFor(dice, c.value, dice.length > 3 ? EXPRESSION_LIMIT : Infinity), points, steal});
  c.owner = actor;
  s.players[actor].score += points * (s.config.mode === 'CLASSIC' ? 1 : -1);
}

/** Mesão: o jogador termina sua vez, vai para o fim da fila e o próximo da fila ganha a iniciativa. */
function endTurn(s: State, actor: Player) {
  s.turns++;
  s.active = s.active.filter(x => x.player !== actor);
  s.queue.push(actor);
  s.active.push(blankSeat(s.queue.shift()!));
}

function reduceTable(s: State, actor: Player, a: Action, now: number) {
  const seat = s.active.find(x => x.player === actor);
  if (!seat || s.phase === 'GAME_OVER') throw Error('Você não tem a iniciativa agora.');
  const limit = s.config.dice === 5 ? 45000 : 30000;
  if (a.type === 'ROLL') {
    if (seat.phase !== 'ROLL_DICE' || a.dice.length !== s.config.dice || a.dice.some(n => !Number.isInteger(n) || n < 1 || n > 6)) throw Error('Dados inválidos.');
    seat.dice = a.dice;
    seat.phase = 'INPUT_MATH';
    seat.deadline = s.config.timer ? now + limit : null;
  } else if (a.type === 'PLACE') {
    if (seat.phase !== 'INPUT_MATH') throw Error('Role os dados primeiro.');
    if (seat.deadline !== null && now >= seat.deadline) throw Error('Tempo esgotado.');
    place(s, actor, a.cell, false, seat.dice);
    endTurn(s, actor);
    finish(s, actor);
  } else if (a.type === 'SKIP') {
    if (seat.phase !== 'ROLL_DICE') throw Error('Não é possível pular agora.');
    endTurn(s, actor);
    finish(s, actor);
  } else {
    if (seat.phase !== 'INPUT_MATH') throw Error('Não é possível passar agora.');
    if (a.type === 'TIMEOUT') {
      if (seat.deadline === null || now < seat.deadline) throw Error('O tempo ainda não acabou.');
      if (s.config.penalty) s.players[actor].score += s.config.mode === 'CLASSIC' ? -5 : 5;
    }
    endTurn(s, actor);
    finish(s, actor);
  }
}

export function reduce(before: State, actor: Player, a: Action, now: number): State {
  const s = structuredClone(before);
  if (s.config.table) { reduceTable(s, actor, a, now); s.sequence++; return s; }
  if (actor !== s.currentTurn || s.phase === 'GAME_OVER') throw Error('Aguarde sua vez.');
  if (a.type === 'ROLL') {
    if (s.phase !== 'ROLL_DICE' || a.dice.length !== 3 || a.dice.some(n => !Number.isInteger(n) || n < 1 || n > 6)) throw Error('Dados inválidos.');
    s.currentDice = a.dice;
    s.phase = 'INPUT_MATH';
    s.deadline = s.config.timer ? now + 30000 : null;
  } else if (a.type === 'PLACE') {
    if (!['INPUT_MATH', 'STEAL_OPPORTUNITY'].includes(s.phase)) throw Error('Role os dados primeiro.');
    if (s.deadline !== null && now >= s.deadline) throw Error('Tempo esgotado.');
    const steal = s.phase === 'STEAL_OPPORTUNITY';
    place(s, actor, a.cell, steal, s.currentDice);
    s.deadline = null;
    s.phase = 'ROLL_DICE';
    if (!steal) { s.turns++; s.currentTurn = nextPlayer(s); }
    finish(s, actor);
  } else if (a.type === 'SKIP') {
    // Jogador ausente: perde a vez sem rolar e sem oferecer roubo.
    if (s.phase !== 'ROLL_DICE') throw Error('Não é possível pular agora.');
    s.turns++; s.currentTurn = nextPlayer(s);
    finish(s, actor);
  } else {
    if (a.type === 'TIMEOUT' && (s.phase !== 'INPUT_MATH' || s.deadline === null || now < s.deadline)) throw Error('O tempo ainda não acabou.');
    if (!['INPUT_MATH', 'STEAL_OPPORTUNITY'].includes(s.phase)) throw Error('Não é possível passar agora.');
    if (a.type === 'TIMEOUT' && s.config.penalty) s.players[actor].score += s.config.mode === 'CLASSIC' ? -5 : 5;
    if (s.phase === 'INPUT_MATH') { s.phase = 'STEAL_OPPORTUNITY'; s.currentTurn = nextPlayer(s); s.turns++; }
    else { s.phase = 'ROLL_DICE'; finish(s, actor); }
    s.deadline = null;
  }
  s.sequence++;
  return s;
}

export function die() {
  const a = new Uint32Array(1);
  do { crypto.getRandomValues(a); } while (a[0] >= 4294967292);
  return a[0] % 6 + 1;
}
