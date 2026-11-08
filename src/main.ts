import {initial, reduce, die, participants, shuffledOrder, playerName, sanitizeConfig, lineNeeded, roundOf, playable, type State, type Player, type Action, type Config} from './game';
import {BOARD_DEFS, boardFrom, tier, type BoardSpec} from './boards';
import {solutions} from './solver';
import {hash} from './hash';
import {Room, normalizeCode, CODE_LENGTH} from './room';
import './style.css';

/* ---------- utilidades ---------- */
const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const escape = (value: string) => value.replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]!));
const store = {
  get(key: string) { try { return localStorage.getItem('contig60.' + key); } catch { return null; } },
  set(key: string, value: string) { try { localStorage.setItem('contig60.' + key, value); } catch { /* armazenamento indisponível */ } },
};
const PIPS: Record<number, number[]> = {1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8]};
const dieHtml = (d: number) => `<span class="die${d ? '' : ' blank'}" role="img" aria-label="${d ? 'Dado ' + d : 'Dado ainda não rolado'}">${Array.from({length: 9}, (_, i) => `<i${PIPS[d]?.includes(i) ? ' class="on"' : ''}></i>`).join('')}</span>`;
const isLocalHost = ['localhost', '127.0.0.1', '[::1]', 'appassets.androidplatform.net'].includes(location.hostname) || !location.protocol.startsWith('http');
const shareUrl = (code: string) => `${location.origin}${location.pathname}#/entrar/${code}`;
const miniBoard = (board: BoardSpec) => `<span class="mini" style="--n:${board.size}" aria-hidden="true">${board.cells.map(v => `<i data-tier="${tier(v)}"></i>`).join('')}</span>`;

document.querySelector('#app')!.innerHTML = `
<header class="topbar">
  <a class="brand" id="brand" href="#/menu"><span class="logo">60</span><span>Contig</span></a>
  <nav>
    <button class="ghost" id="help-open" type="button">Como jogar</button>
    <button class="ghost" id="resume" type="button" hidden>Voltar à partida</button>
    <button class="ghost danger" id="leave" type="button" hidden>Sair</button>
  </nav>
</header>
<main>
<section id="page-menu" class="page">
  <div class="hero">
    <span class="eyebrow">PENSE · COMBINE · CONQUISTE</span>
    <h1>Três dados.<br><em>Um tabuleiro inteiro.</em></h1>
    <p>Combine os dados com + − × ÷ e toque na casa que consegue formar. Faça uma linha antes do adversário.</p>
  </div>
  <div class="steps">
    <section class="card" aria-labelledby="h-how">
      <h2 id="h-how"><i>1</i>Como vocês vão jogar?</h2>
      <div class="segmented big" id="play-mode" role="group" aria-label="Modo de jogo">
        <button type="button" data-v="local"><b>Neste dispositivo</b><small>Passem o aparelho</small></button>
        <button type="button" data-v="host"><b>Criar sala online</b><small>Convide por código</small></button>
        <button type="button" data-v="join"><b>Entrar em sala</b><small>Tenho um código</small></button>
      </div>
    </section>
    <section class="card" id="join-box" aria-labelledby="h-join" hidden>
      <h2 id="h-join"><i>2</i>Código da sala</h2>
      <label class="field">Código de ${CODE_LENGTH} caracteres<input id="join-code" class="code-input" maxlength="${CODE_LENGTH}" autocomplete="off" autocapitalize="characters" spellcheck="false" inputmode="text" placeholder="ABC23"></label>
    </section>
    <section class="card" id="board-box" aria-labelledby="h-board">
      <h2 id="h-board"><i>2</i>Escolha o tabuleiro</h2>
      <div id="boards" class="boards"></div>
      <p class="legend-line"><span class="dot" data-tier="0"></span>comum <span class="dot" data-tier="2"></span>médio <span class="dot" data-tier="4"></span>raro · a cor mostra a chance de cada número sair nos dados</p>
    </section>
    <section class="card" id="rules-box" aria-labelledby="h-rules">
      <h2 id="h-rules"><i>3</i>Regras</h2>
      <div class="rule-grid">
        <div class="field"><span class="label">Jogadores</span><div class="segmented" id="count" role="group" aria-label="Jogadores"><button type="button" data-v="2">2</button><button type="button" data-v="3">3</button><button type="button" data-v="4">4</button></div></div>
        <div class="field"><span class="label">Modo</span><div class="segmented" id="mode" role="group" aria-label="Modo"><button type="button" data-v="CONTIG">Contig 60</button><button type="button" data-v="CLASSIC">Clássico</button></div><small id="mode-hint" class="hint"></small></div>
        <div class="field"><span class="label">Duração</span><div class="segmented" id="rounds" role="group" aria-label="Duração"><button type="button" data-v="10">Curta</button><button type="button" data-v="20">Normal</button><button type="button" data-v="35">Longa</button><button type="button" data-v="0">Sem limite</button></div><small id="rounds-hint" class="hint"></small></div>
        <div class="field"><span class="label">Extras</span><div class="toggles"><button type="button" class="toggle" id="timer" aria-pressed="false">⏱ Blitz de 30 s</button><button type="button" class="toggle" id="penalty" aria-pressed="false">⚠ Penalidade ao estourar</button></div></div>
      </div>
    </section>
    <section class="card" id="names-box" aria-labelledby="h-names">
      <h2 id="h-names"><i id="names-step">4</i>Quem joga?</h2>
      <div id="names"></div>
      <label class="field" id="my-name-label" hidden>Seu nome<input id="my-name" maxlength="24" autocomplete="nickname"></label>
    </section>
  </div>
  <div class="cta"><button id="go" class="primary big" type="button">Começar partida</button></div>
</section>

<section id="page-sala" class="page" hidden>
  <div class="lobby">
    <div class="card code-card">
      <span class="eyebrow">CÓDIGO DA SALA</span>
      <div id="room-code" class="code" aria-live="polite"></div>
      <div id="share-box">
        <input id="share-link" readonly aria-label="Link da sala">
        <div class="buttons"><button type="button" id="copy-code" class="ghost">Copiar código</button><button type="button" id="copy-link" class="ghost">Copiar link</button><button type="button" id="share" class="ghost" hidden>Compartilhar</button></div>
      </div>
      <p class="hint" id="share-hint"></p>
    </div>
    <div class="card"><h2>Jogadores</h2><ul id="slots" class="slots"></ul>
      <div class="lobby-actions"><button id="begin" class="primary big" type="button" disabled>Iniciar partida</button><p id="lobby-wait" class="hint"></p></div>
    </div>
    <div class="card"><h2>Regras da sala</h2><div id="rules-summary" class="chips"></div><div id="lobby-board"></div></div>
  </div>
</section>

<section id="page-partida" class="page" hidden>
  <div class="game">
    <aside class="hud card">
      <div class="hud-head"><span class="eyebrow" id="mode-label"></span><span id="clock" role="timer"></span></div>
      <div id="scores"></div>
      <div class="meta"><div><small>Rodada</small><b id="round"></b></div><div><small>Linha para vencer</small><b id="need"></b></div></div>
      <div class="dice-card"><span class="eyebrow" id="phase-label"></span><div id="dice"></div><p id="last-move" class="muted"></p></div>
      <div class="actions"><button id="roll" class="primary big" type="button">Rolar dados</button><button id="pass" class="ghost" type="button">Passar a vez</button><button id="results-link" class="primary" type="button" hidden>Ver resultado</button></div>
    </aside>
    <div class="board-col">
      <div id="turn-banner" class="banner" aria-live="polite"></div>
      <div id="board" aria-label="Tabuleiro"></div>
    </div>
  </div>
</section>

<section id="page-resultado" class="page results" hidden>
  <span class="eyebrow">FIM DE PARTIDA</span><h1 id="result-title"></h1><p id="result-sub" class="muted"></p>
  <div id="final-scores"></div>
  <div class="buttons"><a class="button ghost" href="#/partida">Ver tabuleiro</a><button id="export" class="ghost" type="button">Exportar histórico</button><button id="new-game" class="primary" type="button">Nova partida</button></div>
  <h2>As contas por trás das escolhas</h2><div id="history"></div>
</section>
</main>
<p id="status" role="status"></p>
<dialog id="help"><form method="dialog"><h2>Como jogar</h2>
<p><b>A jogada.</b> Role os três dados. Use cada um exatamente uma vez com +, −, ×, ÷ e parênteses, e toque numa casa livre cujo número consiga formar. Se der certo, ela vira sua; se não, a casa balança e você tenta outra. Sem nenhuma casa possível, a vez passa sozinha.</p>
<p><b>Pontos.</b> Cada casa ocupada ao redor da sua (diagonais valem) é um ponto. Roubar a vez do adversário dobra. No <b>Contig 60</b> você começa com 60 e quem fizer menos pontos vence; no <b>Clássico</b> começa em 0 e vence quem fizer mais.</p>
<p><b>Como termina.</b> No Contig 60, quem fizer uma linha (horizontal, vertical ou diagonal) vence na hora. Para a partida nunca se arrastar, a linha exigida diminui ao longo das rodadas. Também acaba com o tabuleiro cheio ou ao fim das rodadas: vence o melhor placar.</p>
<p><b>Roubo.</b> Se o jogador da vez passar, só o próximo na ordem pode tentar a mesma rolagem, valendo o dobro.</p>
<button class="primary">Entendi</button></form></dialog>`;

/* ---------- estado ---------- */
let state: State | undefined, room: Room | undefined, me: Player = 'P1';
let online = false, connected = false, busy = false, chain = '', session = '';
let history: unknown[] = [];
let resultSequence = -1, shownDice = '', autoFor = -1, leaveArmed = 0;

type Form = {playMode: 'local' | 'host' | 'join'; count: 2 | 3 | 4; mode: Config['mode']; rounds: number; timer: boolean; penalty: boolean; board: string};
const form: Form = {playMode: 'local', count: 2, mode: 'CONTIG', rounds: 20, timer: false, penalty: false, board: 'puc'};
const previews: Record<string, BoardSpec> = Object.fromEntries(BOARD_DEFS.map(d => [d.id, boardFrom(d)]));

const notice = (message: string) => { el('status').textContent = message; };
function toast(message: string, ms = 3500) { notice(message); if (message) setTimeout(() => { if (el('status').textContent === message) notice(''); }, ms); }

function config(): Config {
  return sanitizeConfig({mode: form.mode, timer: form.timer, penalty: form.penalty, rounds: form.rounds, expanded: form.count > 2, playerCount: form.count, board: previews[form.board]});
}

/* ---------- menu ---------- */
function press(group: string, value: string) {
  for (const b of el(group).querySelectorAll<HTMLButtonElement>('button')) b.setAttribute('aria-pressed', String(b.dataset.v === value));
}
const roundsHint = (n: number) => (n === 0 ? 'A partida só acaba com linha ou tabuleiro cheio.' : `Termina após ${n} rodadas, ou antes se alguém fizer a linha.`);
const modeHint = (m: Config['mode']) => (m === 'CONTIG' ? 'Comece com 60. Faça menos pontos e forme uma linha.' : 'Comece com 0. Some pontos; linhas não contam.');

function renderForm() {
  press('play-mode', form.playMode); press('count', String(form.count)); press('mode', form.mode); press('rounds', String(form.rounds));
  for (const id of ['timer', 'penalty'] as const) el(id).setAttribute('aria-pressed', String(form[id]));
  el('mode-hint').textContent = modeHint(form.mode);
  el('rounds-hint').textContent = roundsHint(form.rounds);
  const joining = form.playMode === 'join', local = form.playMode === 'local';
  el('join-box').hidden = !joining;
  el('board-box').hidden = el('rules-box').hidden = joining;
  el('names-step').textContent = joining ? '3' : '4';
  el('names').hidden = !local;
  el('my-name-label').hidden = local;
  el('go').textContent = local ? 'Começar partida' : joining ? 'Entrar na sala' : 'Criar sala';
  el('boards').innerHTML = BOARD_DEFS.map(d => {
    const board = previews[d.id], selected = form.board === d.id;
    return `<button type="button" class="board-card" data-id="${d.id}" aria-pressed="${selected}">${miniBoard(board)}<b>${escape(d.name)}</b><small>${escape(d.tagline)}</small><em>${board.size}×${board.size} · linha de ${board.line}${d.random && selected ? ' · ↻ toque para sortear outro' : ''}</em></button>`;
  }).join('');
}
function nameFields() {
  const saved = Object.fromEntries(Array.from(el('names').querySelectorAll<HTMLInputElement>('input')).map(i => [i.dataset.p, i.value]));
  el('names').innerHTML = participants({expanded: form.count > 2, playerCount: form.count}).map((p, i) => `<label class="name-field"><span class="player-dot ${p}"></span><input data-p="${p}" maxlength="24" value="${escape(saved[p] ?? `Jogador ${i + 1}`)}" aria-label="Nome do jogador ${i + 1}"></label>`).join('');
}
const localNames = () => Object.fromEntries(Array.from(el('names').querySelectorAll<HTMLInputElement>('input')).map(i => [i.dataset.p!, playerName(i.value, i.dataset.p as Player)]));
const myName = () => el<HTMLInputElement>('my-name').value.trim().slice(0, 24) || 'Jogador';

el('play-mode').onclick = e => { const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button'); if (b) { form.playMode = b.dataset.v as Form['playMode']; renderForm(); } };
el('count').onclick = e => { const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button'); if (b) { form.count = Number(b.dataset.v) as Form['count']; renderForm(); nameFields(); } };
el('mode').onclick = e => { const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button'); if (b) { form.mode = b.dataset.v as Config['mode']; renderForm(); } };
el('rounds').onclick = e => { const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button'); if (b) { form.rounds = Number(b.dataset.v); renderForm(); } };
for (const id of ['timer', 'penalty'] as const) el(id).onclick = () => { form[id] = !form[id]; renderForm(); };
el('boards').onclick = e => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-id]');
  if (!b) return;
  const def = BOARD_DEFS.find(d => d.id === b.dataset.id)!;
  if (form.board === def.id && def.random) previews[def.id] = boardFrom(def);
  form.board = def.id;
  renderForm();
  el('boards').querySelector<HTMLElement>(`[data-id="${def.id}"]`)?.focus();
};
el<HTMLInputElement>('join-code').oninput = e => { const input = e.target as HTMLInputElement; input.value = normalizeCode(input.value); };
el<HTMLInputElement>('my-name').onchange = () => { store.set('name', el<HTMLInputElement>('my-name').value); room?.setName(el<HTMLInputElement>('my-name').value); };

/* ---------- navegação ---------- */
function historyReplace(hash: string) { window.history.replaceState(null, '', hash); }
function go(page: string) { location.hash = '/' + page; route(); }
function route() {
  const [raw, arg] = location.hash.slice(2).split('/');
  let page = raw || 'menu';
  if (page === 'entrar' && !room && !state) {
    form.playMode = 'join'; renderForm(); el<HTMLInputElement>('join-code').value = normalizeCode(arg ?? '');
    page = 'menu'; historyReplace('#/menu');
  }
  const allowed: Record<string, boolean> = {menu: !state && !room, sala: !!room && !state, partida: !!state, resultado: !!state?.winner};
  if (!allowed[page]) { page = state ? 'partida' : room ? 'sala' : 'menu'; historyReplace('#/' + page); }
  for (const id of ['menu', 'sala', 'partida', 'resultado']) el('page-' + id).hidden = id !== page;
  el('resume').hidden = page !== 'resultado';
  el('leave').hidden = !room && !state;
  el('brand').setAttribute('href', state ? '#/partida' : room ? '#/sala' : '#/menu');
  if (document.body.dataset.page !== page) window.scrollTo(0, 0);
  document.body.dataset.page = page;
}
window.addEventListener('hashchange', route);
el('help-open').onclick = () => el<HTMLDialogElement>('help').showModal();
el('resume').onclick = () => go('partida');
el('leave').onclick = () => {
  if (Date.now() < leaveArmed) { room?.close(); location.hash = '/menu'; location.reload(); return; }
  leaveArmed = Date.now() + 3000; el('leave').textContent = 'Toque de novo para sair';
  setTimeout(() => { el('leave').textContent = 'Sair'; }, 3000);
};

/* ---------- partida ---------- */
function canAct() { return !!state && !busy && (!online || connected && state.currentTurn === me) && !state.winner; }
function flash(cell: number, success: boolean) {
  const button = el('board').querySelector<HTMLElement>(`[data-id="${cell}"]`);
  if (!button) return;
  button.classList.remove('accepted', 'rejected'); void button.offsetWidth; button.classList.add(success ? 'accepted' : 'rejected');
  setTimeout(() => button.classList.remove('accepted', 'rejected'), 650);
}

function scoreCards(s: State) {
  return s.order.map(p => `<div class="score ${p}${s.currentTurn === p && !s.winner ? ' active' : ''}${s.winner === p ? ' winner' : ''}"><span title="${escape(s.players[p].name)}"><small>${online && p === me ? 'você' : s.order.indexOf(p) === 0 ? 'começa' : '&nbsp;'}</small>${escape(s.players[p].name)}</span><strong>${s.players[p].score}</strong></div>`).join('');
}
const ENDED = {LINE: 'Linha completa', FULL: 'Tabuleiro cheio', ROUNDS: 'Fim das rodadas'} as const;

function banner(s: State): string {
  if (s.winner) return s.winner === 'DRAW' ? 'Empate!' : `${escape(s.players[s.winner].name)} venceu!`;
  const name = escape(s.players[s.currentTurn].name), mine = online && s.currentTurn === me;
  if (online && !connected) return 'Conexão perdida. Partida pausada.';
  if (s.phase === 'STEAL_OPPORTUNITY') return mine ? 'Roubo! Forme uma casa com os mesmos dados (vale o dobro)' : `${name} pode roubar a jogada`;
  if (s.phase === 'ROLL_DICE') return mine ? 'Sua vez: role os dados' : online ? `Vez de ${name}` : `Vez de ${name}: role os dados`;
  return mine ? 'Combine os dados e toque numa casa' : online ? `${name} está pensando…` : `${name}: combine os dados e toque numa casa`;
}

function render() {
  if (!state) return;
  const s = state, n = s.config.board.size, placing = ['INPUT_MATH', 'STEAL_OPPORTUNITY'].includes(s.phase);
  el('scores').innerHTML = scoreCards(s);
  el('mode-label').textContent = s.config.mode === 'CLASSIC' ? 'CLÁSSICO · MAIOR VENCE' : 'CONTIG 60 · MENOR VENCE';
  el('turn-banner').innerHTML = banner(s);
  el('turn-banner').dataset.state = s.winner ? 'over' : s.phase === 'STEAL_OPPORTUNITY' ? 'steal' : online && s.currentTurn === me ? 'mine' : 'wait';
  const rounds = s.config.rounds, need = lineNeeded(s);
  el('round').textContent = rounds ? `${roundOf(s)} / ${rounds}` : String(roundOf(s));
  el('need').textContent = s.config.mode === 'CLASSIC' ? 'não vale' : `${need} em linha${need < s.config.board.line ? ' ↓' : ''}`;
  el('phase-label').textContent = s.winner ? 'PARTIDA ENCERRADA' : s.phase === 'STEAL_OPPORTUNITY' ? 'CHANCE DE ROUBO' : s.phase === 'ROLL_DICE' ? 'ROLE OS DADOS' : 'ESCOLHA UMA CASA';
  const diceKey = s.currentDice.join() + ':' + s.sequence;
  el('dice').innerHTML = s.currentDice.map(dieHtml).join('');
  el('dice').classList.toggle('roll', s.phase !== 'ROLL_DICE' && s.currentDice[0] > 0 && shownDice !== diceKey && !s.winner);
  shownDice = diceKey;
  const last = s.placements.at(-1);
  el('last-move').textContent = last ? `Última: ${s.players[last.player].name} ocupou o ${last.value}${last.steal ? ' (roubo)' : ''} · ${last.points} pt${last.points === 1 ? '' : 's'}` : 'Nenhuma casa ocupada ainda.';
  const boardEl = el('board');
  boardEl.style.setProperty('--n', String(n));
  boardEl.innerHTML = s.board.map(c => {
    const cls = ['cell', c.owner ?? '', last?.cell === c.id ? 'last' : '', s.winningCells.includes(c.id) ? 'win' : ''].filter(Boolean).join(' ');
    return `<button class="${cls}" data-id="${c.id}" data-tier="${tier(c.value)}" aria-label="${c.value}, ${escape(c.owner ? s.players[c.owner].name : 'livre')}"${!canAct() || !placing || c.owner ? ' disabled' : ''}><span class="num">${c.value}</span>${c.owner ? `<i class="stone"></i>` : ''}</button>`;
  }).join('');
  el<HTMLButtonElement>('roll').disabled = !canAct() || s.phase !== 'ROLL_DICE';
  el('roll').hidden = !!s.winner;
  el<HTMLButtonElement>('pass').disabled = !canAct() || !placing;
  el('pass').hidden = !!s.winner;
  el('results-link').hidden = !s.winner;
  if (s.winner && resultSequence !== s.sequence) { resultSequence = s.sequence; fillResults(s); go('resultado'); }
  route();
  autoPass();
}

function fillResults(s: State) {
  const title = s.winner === 'DRAW' ? 'Empate!' : `${s.players[s.winner as Player].name} venceu!`;
  el('result-title').textContent = title;
  el('result-sub').textContent = `${s.endedBy ? ENDED[s.endedBy] : ''} · ${s.config.board.name} · ${roundOf(s)} rodada${roundOf(s) === 1 ? '' : 's'}`;
  el('final-scores').innerHTML = scoreCards(s);
  el('history').replaceChildren();
  for (const [i, move] of s.placements.entries()) {
    const row = document.createElement('details'), summary = document.createElement('summary');
    row.className = 'card';
    summary.textContent = `${i + 1}. ${s.players[move.player].name} · casa ${move.value} · ${move.points} ponto${move.points === 1 ? '' : 's'}${move.steal ? ' · roubo' : ''}`;
    const dice = document.createElement('p'), list = document.createElement('ul');
    dice.textContent = `Dados: ${move.dice.join(' · ')} — ${move.expressions.length} expressões`;
    for (const expression of move.expressions) { const item = document.createElement('li'); item.textContent = `${expression} = ${move.value}`; list.append(item); }
    row.append(summary, dice, list);
    el('history').append(row);
  }
  if (!s.placements.length) el('history').textContent = 'Nenhuma casa foi ocupada nesta partida.';
}

/** Sem nenhuma casa possível a vez passa sozinha, para ninguém travar a partida. */
function autoPass() {
  if (!state || state.winner || !['INPUT_MATH', 'STEAL_OPPORTUNITY'].includes(state.phase) || !canAct() || autoFor === state.sequence || playable(state) > 0) return;
  const seq = autoFor = state.sequence;
  toast(`Nenhuma casa possível com ${state.currentDice.join(' · ')}: ${state.phase === 'STEAL_OPPORTUNITY' ? 'sem roubo' : 'a vez passa'}.`, 2200);
  setTimeout(() => { if (state && state.sequence === seq && canAct()) void act({type: 'PASS'}); }, 1800);
}

async function start() {
  const base = room?.config ?? config(), c = sanitizeConfig({...base, names: room ? {...room.names} : localNames()}), order = shuffledOrder(c);
  state = initial(c, order[0], order);
  session = crypto.randomUUID(); history = []; chain = await hash({session, state});
  if (online) room!.send({type: 'INIT', session, state, chain});
  history.push({session, initial: state, chain});
  notice(''); go('partida'); render();
}

async function act(action: Action) {
  if (!state || busy) return;
  busy = true;
  try {
    if (online && (!connected || me !== state.currentTurn)) throw Error('Aguarde sua vez e a conexão.');
    const actor = state.currentTurn, now = Date.now(), next = reduce(state, actor, action, now);
    const event = {type: 'ACTION', session, sequence: next.sequence, actor, action, now, previous: chain}, digest = await hash({event, state: next});
    if (online) room!.send({...event, digest});
    chain = digest; state = next; history.push({...event, digest});
    notice(''); busy = false; render();
    if (action.type === 'PLACE') flash(action.cell, true);
  } catch (e) {
    busy = false; render();
    if (action.type === 'PLACE') flash(action.cell, false); else toast((e as Error).message);
  }
}

let incoming = Promise.resolve();
async function receive(sender: Player, raw: unknown) {
  const m = raw as any;
  if (m.type === 'INIT') {
    if (sender !== 'P1' || me === 'P1' || state || typeof m.session !== 'string' || !room?.config) throw Error('Inicialização inválida');
    const c = sanitizeConfig(m.state?.config), strip = ({names, ...rest}: Config) => rest;
    if (JSON.stringify(strip(c)) !== JSON.stringify(strip(room.config))) throw Error('Configuração inválida');
    if (participants(c).some(p => c.names?.[p] !== playerName(room!.names[p], p))) throw Error('Nomes divergentes');
    const expected = initial(c, m.state.currentTurn, m.state.order);
    if (JSON.stringify(expected) !== JSON.stringify(m.state) || await hash({session: m.session, state: expected}) !== m.chain) throw Error('Estado inicial inválido');
    state = expected; session = m.session; chain = m.chain; history = [{session, initial: state, chain}];
    notice(''); go('partida'); render();
    return;
  }
  if (!state || m.type !== 'ACTION' || m.session !== session || m.previous !== chain || m.sequence !== state.sequence + 1 || m.actor !== sender || !Number.isFinite(m.now) || Math.abs(Date.now() - m.now) > 120000 || !['ROLL', 'PLACE', 'PASS', 'TIMEOUT'].includes(m.action?.type)) throw Error('Histórico divergente ou pacote inválido');
  const next = reduce(state, m.actor, m.action, m.now), {digest, ...event} = m;
  if (await hash({event, state: next}) !== digest) throw Error('Hash divergente');
  state = next; chain = digest; history.push(m); render();
  if (m.action.type === 'PLACE') flash(m.action.cell, true);
}

/* ---------- sala online ---------- */
function slots() {
  if (!room?.config) return;
  const r = room;
  el('slots').innerHTML = r.members.map(p => {
    const here = r.present(p), you = p === r.me;
    return `<li class="slot ${p}${here ? ' here' : ''}"><span class="player-dot ${p}"></span><span class="slot-name">${escape(here ? r.names[p] ?? p : 'Aguardando jogador…')}${you ? ' <small>você</small>' : p === 'P1' ? ' <small>anfitrião</small>' : ''}</span><span class="slot-state">${here ? (r.ready.has(p) ? 'pronto' : 'conectando…') : ''}</span></li>`;
  }).join('');
  const c = r.config!, rules = [c.board.name, `${c.board.size}×${c.board.size}`, c.mode === 'CLASSIC' ? 'Clássico' : 'Contig 60', c.rounds ? `${c.rounds} rodadas` : 'sem limite', `${participants(c).length} jogadores`, ...(c.timer ? ['Blitz 30 s'] : []), ...(c.penalty ? ['Penalidade'] : [])];
  el('rules-summary').innerHTML = rules.map(x => `<span class="chip">${escape(x)}</span>`).join('');
  el('lobby-board').innerHTML = miniBoard(c.board);
}
function lobby() {
  connected = room?.complete ?? false;
  if (room?.config) {
    slots();
    const host = me === 'P1';
    el<HTMLButtonElement>('begin').disabled = !host || !connected || !!state;
    el('begin').hidden = !host;
    const missing = room.members.length - room.members.filter(p => room!.present(p)).length;
    el('lobby-wait').textContent = host ? (connected ? 'Todos prontos. É só começar!' : missing ? `Faltam ${missing} jogador${missing > 1 ? 'es' : ''}. Passe o código da sala.` : 'Estabelecendo conexões…') : connected ? 'Tudo pronto! Aguardando o anfitrião iniciar a partida.' : 'Conectando aos outros jogadores…';
  }
  if (state && !connected) toast('Partida pausada: conexão incompleta.', 6000);
  render();
}
function onRoomError(message: string) { connected = false; toast(`Partida pausada: ${message}`, 8000); render(); }
function openRoom(r: Room) {
  room = r; me = r.me; online = true;
  el('room-code').textContent = r.code;
  const link = !isLocalHost;
  el('share-link').hidden = !link; el('copy-link').hidden = !link;
  el<HTMLInputElement>('share-link').value = shareUrl(r.code);
  el('share').hidden = !link || !navigator.share;
  el('share-hint').textContent = link ? 'Quem abrir o link entra direto na sala.' : 'Os outros jogadores abrem o Contig 60, escolhem "Entrar em sala" e digitam este código.';
  lobby(); go('sala');
}
const roomEvents = {
  receive: (sender: Player, data: unknown) => { incoming = incoming.then(() => receive(sender, data)).catch(e => { connected = false; onRoomError((e as Error).message); }); },
  changed: lobby,
  failed: onRoomError,
};

async function copy(text: string, ok: string) {
  try { await navigator.clipboard.writeText(text); toast(ok); return; } catch { /* tenta o método antigo */ }
  const input = document.createElement('input');
  input.value = text; document.body.append(input); input.select();
  try { document.execCommand('copy'); toast(ok); } catch { toast('Copie manualmente: ' + text, 8000); }
  input.remove();
}
el('copy-code').onclick = () => void copy(room!.code, 'Código copiado');
el('copy-link').onclick = () => void copy(shareUrl(room!.code), 'Link copiado');
el('share').onclick = () => void navigator.share({title: 'Contig 60', text: `Entre na minha sala do Contig 60: ${room!.code}`, url: shareUrl(room!.code)}).catch(() => {});
el<HTMLInputElement>('share-link').onclick = e => (e.target as HTMLInputElement).select();
el('begin').onclick = () => { if (room?.complete && me === 'P1' && !state) void start().catch(e => toast(String(e))); };

el('go').onclick = async () => {
  const button = el<HTMLButtonElement>('go'), label = button.textContent;
  if (form.playMode === 'local') { online = false; void start(); return; }
  button.disabled = true; button.textContent = form.playMode === 'host' ? 'Criando sala…' : 'Entrando…';
  try {
    store.set('name', el<HTMLInputElement>('my-name').value);
    openRoom(form.playMode === 'host' ? await Room.host(config(), myName(), roomEvents) : await Room.join(el<HTMLInputElement>('join-code').value, myName(), roomEvents));
  } catch (e) { toast((e as Error).message, 6000); }
  button.disabled = false; button.textContent = label;
};

/* ---------- jogo ---------- */
el('board').onclick = e => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-id]');
  if (!b || !canAct() || !state) return;
  const id = Number(b.dataset.id), cell = state.board[id];
  if (cell.owner || !solutions(state.currentDice)[cell.value]?.length) { flash(id, false); return; }
  void act({type: 'PLACE', cell: id});
};
el('roll').onclick = () => void act({type: 'ROLL', dice: [die(), die(), die()]});
el('pass').onclick = () => void act({type: 'PASS'});
el('results-link').onclick = () => go('resultado');
el('new-game').onclick = () => { room?.close(); location.hash = '/menu'; location.reload(); };
el('export').onclick = () => {
  if (!state?.winner) return;
  const url = URL.createObjectURL(new Blob([JSON.stringify({events: history, placements: state.placements}, null, 2)], {type: 'application/json'}));
  const a = document.createElement('a'); a.href = url; a.download = 'contig-historico.json'; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
setInterval(() => {
  if (!state) return;
  const left = state.deadline ? Math.max(0, Math.ceil((state.deadline - Date.now()) / 1000)) : null;
  el('clock').textContent = left === null ? '' : `${left}s`;
  el('clock').classList.toggle('urgent', left !== null && left <= 10);
  if (state.deadline && Date.now() >= state.deadline && (!online || connected && me === state.currentTurn)) void act({type: 'TIMEOUT'});
}, 250);

el<HTMLInputElement>('my-name').value = store.get('name') ?? '';
renderForm(); nameFields(); route();
