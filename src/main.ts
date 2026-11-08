import {initial, reduce, die, participants, shuffledOrder, playerName, playerColor, sanitizeConfig, lineNeeded, roundOf, playable, diceOf, seatOf, initiativeOf, ACTION_TYPES, type State, type Player, type Action, type Config} from './game';
import {BOARD_DEFS, boardFrom, tier, TIER_LIMITS, type BoardSpec, type DiceCount} from './boards';
import {canForm} from './solver';
import {hash} from './hash';
import {Room, normalizeCode, CODE_LENGTH} from './room';
import {helpHtml} from './help';
import {creditsHtml, initCredits} from './credits';
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
const miniBoard = (board: BoardSpec, dice: DiceCount = 3) => `<span class="mini" style="--n:${board.size}" aria-hidden="true">${board.cells.map(v => `<i data-tier="${tier(v, dice)}"></i>`).join('')}</span>`;
const color = (p: Player) => `style="--pc:${playerColor(p)}"`;

document.querySelector('#app')!.innerHTML = `
<header class="topbar">
  <a class="brand" id="brand" href="#/menu"><span class="logo">60</span><span>Contig</span></a>
  <nav>
    <button class="ghost" id="help-open" type="button">Como jogar</button>
    <button class="ghost" id="credits-open" type="button">Créditos</button>
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
    <section class="card" id="rules-box" aria-labelledby="h-rules">
      <h2 id="h-rules"><i>2</i>Estilo e regras</h2>
      <div class="rule-grid">
        <div class="field wide"><span class="label">Estilo de jogo</span><div class="segmented" id="style" role="group" aria-label="Estilo"><button type="button" data-v="normal"><b>Normal</b><small>2 a 4 jogadores · 3 dados</small></button><button type="button" data-v="table"><b>Mesão</b><small>Muitos jogadores · vários ao mesmo tempo</small></button></div><small id="style-hint" class="hint"></small></div>
        <div class="field" id="dice-field"><span class="label">Dados do Mesão</span><div class="segmented" id="dice" role="group" aria-label="Dados"><button type="button" data-v="5">5 dados · descarte 1</button><button type="button" data-v="3">3 dados · números repetidos</button></div></div>
        <div class="field" id="initiative-field"><span class="label">Jogadores ativos ao mesmo tempo</span><div class="segmented" id="initiative" role="group" aria-label="Iniciativas"><button type="button" data-v="0">Auto</button><button type="button" data-v="3">3</button><button type="button" data-v="5">5</button></div><small class="hint">Auto: 3 até 10 jogadores, 5 acima disso.</small></div>
        <div class="field" id="count-field"><span class="label">Jogadores</span><div class="segmented" id="count" role="group" aria-label="Jogadores"><button type="button" data-v="2">2</button><button type="button" data-v="3">3</button><button type="button" data-v="4">4</button></div></div>
        <div class="field" id="table-count-field"><label class="label" for="table-count">Jogadores neste dispositivo</label><div class="stepper"><button type="button" class="ghost" id="tc-minus" aria-label="Menos um jogador">−</button><output id="table-count" aria-live="polite">6</output><button type="button" class="ghost" id="tc-plus" aria-label="Mais um jogador">+</button></div><small class="hint">Online, os jogadores entram pela sala.</small></div>
        <div class="field"><span class="label">Modo</span><div class="segmented" id="mode" role="group" aria-label="Modo"><button type="button" data-v="CONTIG">Contig 60</button><button type="button" data-v="CLASSIC">Clássico</button></div><small id="mode-hint" class="hint"></small></div>
        <div class="field"><span class="label">Duração</span><div class="segmented" id="rounds" role="group" aria-label="Duração"><button type="button" data-v="10">Curta</button><button type="button" data-v="20">Normal</button><button type="button" data-v="35">Longa</button><button type="button" data-v="0">Sem limite</button></div><small id="rounds-hint" class="hint"></small></div>
        <div class="field"><span class="label">Extras</span><div class="toggles"><button type="button" class="toggle" id="timer" aria-pressed="false">⏱ Blitz</button><button type="button" class="toggle" id="penalty" aria-pressed="false">⚠ Penalidade ao estourar</button></div><small id="timer-hint" class="hint"></small></div>
      </div>
    </section>
    <section class="card" id="board-box" aria-labelledby="h-board">
      <h2 id="h-board"><i>3</i>Escolha o tabuleiro</h2>
      <div id="boards" class="boards"></div>
      <p class="legend-line"><span class="dot" data-tier="0"></span>comum <span class="dot" data-tier="2"></span>médio <span class="dot" data-tier="4"></span>raro · a cor mostra a chance de cada número sair nos dados</p>
    </section>
    <section class="card" id="names-box" aria-labelledby="h-names">
      <h2 id="h-names"><i id="names-step">4</i>Quem joga?</h2>
      <div id="names" class="names"></div>
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
    <div class="card"><h2>Jogadores <span id="roster-count" class="count-pill"></span></h2><ul id="slots" class="slots"></ul>
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
      <div id="table-box" hidden><span class="eyebrow">ATIVOS AGORA</span><div id="seats" class="seats"></div><p id="queue" class="muted"></p></div>
      <div class="meta"><div><small>Rodada</small><b id="round"></b></div><div><small>Linha para vencer</small><b id="need"></b></div></div>
      <div class="dice-card"><span class="eyebrow" id="phase-label"></span><div id="dice"></div><p id="dice-hint" class="muted"></p><p id="last-move" class="muted"></p></div>
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

<section id="page-ajuda" class="page help" hidden>${helpHtml(TIER_LIMITS)}</section>
<section id="page-creditos" class="page credits" aria-labelledby="credits-title" hidden>${creditsHtml}</section>
</main>
<p id="status" role="status"></p>`;

/* ---------- estado ---------- */
let state: State | undefined, room: Room | undefined, me: Player = 'P1';
let online = false, busy = false, chain = '', session = '';
let history: unknown[] = [];
let resultSequence = -1, shownDice = '', autoFor = '', leaveArmed = 0, helpFrom = '#/menu';
let creditsFrom = '#/menu', creditsScroll = 0, creditsFocus: HTMLElement | null = null;
/** Local, Mesão: qual jogador ativo este dispositivo está controlando agora. */
let focus: Player | undefined;

type Form = {playMode: 'local' | 'host' | 'join'; style: 'normal' | 'table'; count: 2 | 3 | 4; tableCount: number; dice: DiceCount; initiative: 0 | 3 | 5; mode: Config['mode']; rounds: number; timer: boolean; penalty: boolean; board: string};
const form: Form = {playMode: 'local', style: 'normal', count: 2, tableCount: 6, dice: 5, initiative: 0, mode: 'CONTIG', rounds: 20, timer: false, penalty: false, board: 'puc'};
const previews: Record<string, BoardSpec> = Object.fromEntries(BOARD_DEFS.map(d => [d.id, boardFrom(d)]));
const boardsForForm = () => BOARD_DEFS.filter(d => d.table === (form.style === 'table') && (!d.table || d.dice === form.dice));

const notice = (message: string) => { el('status').textContent = message; };
function toast(message: string, ms = 3500) { notice(message); if (message) setTimeout(() => { if (el('status').textContent === message) notice(''); }, ms); }

function config(): Config {
  const table = form.style === 'table';
  return sanitizeConfig({mode: form.mode, timer: form.timer, penalty: form.penalty, rounds: form.rounds, playerCount: table ? (form.playMode === 'local' ? form.tableCount : 3) : form.count, dice: table ? form.dice : 3, table, initiative: table ? form.initiative : 1, board: previews[form.board]});
}
const connected = () => !online || !!room?.linked;

/* ---------- menu ---------- */
function press(group: string, value: string) {
  for (const b of el(group).querySelectorAll<HTMLButtonElement>('button')) b.setAttribute('aria-pressed', String(b.dataset.v === value));
}
const roundsHint = (n: number) => (n === 0 ? 'A partida só acaba com linha ou tabuleiro cheio.' : `Termina após ${n} rodadas, ou antes se alguém fizer a linha.`);
const modeHint = (m: Config['mode']) => (m === 'CONTIG' ? 'Comece com 60. Faça menos pontos e forme uma linha.' : 'Comece com 0. Some pontos; linhas não contam.');

function renderForm() {
  const table = form.style === 'table';
  if (!boardsForForm().some(d => d.id === form.board)) form.board = boardsForForm()[0].id;
  press('play-mode', form.playMode); press('style', form.style); press('dice', String(form.dice)); press('initiative', String(form.initiative));
  press('count', String(form.count)); press('mode', form.mode); press('rounds', String(form.rounds));
  for (const id of ['timer', 'penalty'] as const) el(id).setAttribute('aria-pressed', String(form[id]));
  el('table-count').textContent = String(form.tableCount);
  el('style-hint').textContent = table ? 'Qualquer número de jogadores. Alguns têm a iniciativa ao mesmo tempo; ao terminar, passam para o fim da fila. Sem roubo.' : 'Cada um joga na sua vez, e o próximo da ordem pode roubar uma jogada passada.';
  el('mode-hint').textContent = modeHint(form.mode);
  el('rounds-hint').textContent = roundsHint(form.rounds);
  el('timer-hint').textContent = form.timer ? `${table && form.dice === 5 ? 45 : 30} segundos para escolher a casa depois de rolar.` : '';
  const joining = form.playMode === 'join', local = form.playMode === 'local';
  el('join-box').hidden = !joining;
  el('rules-box').hidden = el('board-box').hidden = joining;
  el('dice-field').hidden = el('initiative-field').hidden = !table;
  el('count-field').hidden = table;
  el('table-count-field').hidden = !table || !local;
  el('names-step').textContent = joining ? '3' : '4';
  el('names-box').querySelector('h2 i')!.textContent = joining ? '3' : '4';
  el('names').hidden = !local;
  el('my-name-label').hidden = local;
  el('go').textContent = local ? 'Começar partida' : joining ? 'Entrar na sala' : 'Criar sala';
  const dice = table ? form.dice : 3;
  el('boards').innerHTML = boardsForForm().map(d => {
    const board = previews[d.id], selected = form.board === d.id;
    return `<button type="button" class="board-card" data-id="${d.id}" aria-pressed="${selected}">${miniBoard(board, dice)}<b>${escape(d.name)}</b><small>${escape(d.tagline)}</small><em>${board.size}×${board.size} · linha de ${board.line}${d.random && selected ? ' · ↻ toque para sortear outro' : ''}</em></button>`;
  }).join('');
  nameFields();
}
function nameFields() {
  const count = form.style === 'table' ? form.tableCount : form.count;
  const saved = Object.fromEntries(Array.from(el('names').querySelectorAll<HTMLInputElement>('input')).map(i => [i.dataset.p, i.value]));
  el('names').innerHTML = participants({playerCount: count}).map((p, i) => `<label class="name-field" ${color(p)}><span class="player-dot"></span><input data-p="${p}" maxlength="24" value="${escape(saved[p] ?? `Jogador ${i + 1}`)}" aria-label="Nome do jogador ${i + 1}"></label>`).join('');
}
const localNames = () => Object.fromEntries(Array.from(el('names').querySelectorAll<HTMLInputElement>('input')).map(i => [i.dataset.p!, playerName(i.value, i.dataset.p as Player)]));
const myName = () => el<HTMLInputElement>('my-name').value.trim().slice(0, 24) || 'Jogador';
const pick = (group: string, apply: (v: string) => void) => { el(group).onclick = e => { const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button'); if (b) { apply(b.dataset.v!); renderForm(); } }; };

pick('play-mode', v => { form.playMode = v as Form['playMode']; });
pick('style', v => { form.style = v as Form['style']; });
pick('dice', v => { form.dice = Number(v) as DiceCount; });
pick('initiative', v => { form.initiative = Number(v) as Form['initiative']; });
pick('count', v => { form.count = Number(v) as Form['count']; });
pick('mode', v => { form.mode = v as Config['mode']; });
pick('rounds', v => { form.rounds = Number(v); });
for (const id of ['timer', 'penalty'] as const) el(id).onclick = () => { form[id] = !form[id]; renderForm(); };
el('tc-minus').onclick = () => { form.tableCount = Math.max(3, form.tableCount - 1); renderForm(); };
el('tc-plus').onclick = () => { form.tableCount = Math.min(12, form.tableCount + 1); renderForm(); };
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
el<HTMLInputElement>('my-name').onchange = () => { store.set('name', el<HTMLInputElement>('my-name').value); room?.setName(myName()); };

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
  const allowed: Record<string, boolean> = {menu: !state && !room, sala: !!room && !state, partida: !!state, resultado: !!state?.winner, ajuda: true, creditos: true};
  if (!allowed[page]) { page = state ? 'partida' : room ? 'sala' : 'menu'; historyReplace('#/' + page); }
  const previousPage = document.body.dataset.page;
  if (page === 'creditos' && previousPage !== 'creditos') {
    creditsFrom = '#/' + (previousPage || (state ? 'partida' : room ? 'sala' : 'menu'));
    creditsScroll = window.scrollY;
    creditsFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }
  for (const id of ['menu', 'sala', 'partida', 'resultado', 'ajuda', 'creditos']) el('page-' + id).hidden = id !== page;
  el('resume').hidden = page !== 'resultado';
  el('leave').hidden = !room && !state;
  el('help-open').hidden = page === 'ajuda' || page === 'creditos';
  el('credits-open').hidden = page === 'creditos';
  el('brand').setAttribute('href', state ? '#/partida' : room ? '#/sala' : '#/menu');
  if (document.body.dataset.page !== page) window.scrollTo(0, 0);
  document.body.dataset.page = page;
  if (page === 'creditos' && previousPage !== page) el('credits-title').focus({preventScroll: true});
  if (previousPage === 'creditos' && page !== 'creditos' && '#/' + page === creditsFrom) {
    creditsFocus?.focus({preventScroll: true});
    window.scrollTo(0, creditsScroll);
  }
}
window.addEventListener('hashchange', route);
initCredits();
el('credits-open').onclick = () => go('creditos');
function closeCredits() { location.hash = creditsFrom; }
for (const button of document.querySelectorAll<HTMLElement>('[data-credits-back]')) button.onclick = closeCredits;
window.addEventListener('keydown', event => {
  if (event.key === 'Escape' && document.body.dataset.page === 'creditos') { event.preventDefault(); closeCredits(); }
});
el('help-open').onclick = () => { helpFrom = location.hash || '#/menu'; location.hash = '/ajuda'; };
for (const b of document.querySelectorAll<HTMLElement>('[data-help-back]')) b.onclick = () => { location.hash = helpFrom.startsWith('#/ajuda') ? '#/menu' : helpFrom; };
for (const a of document.querySelectorAll<HTMLAnchorElement>('.help-toc a')) a.onclick = e => { e.preventDefault(); document.getElementById(a.dataset.to!)?.scrollIntoView({behavior: 'smooth', block: 'start'}); };
el('resume').onclick = () => go('partida');
el('leave').onclick = () => {
  if (Date.now() < leaveArmed) { room?.close(); location.hash = '/menu'; location.reload(); return; }
  leaveArmed = Date.now() + 3000; el('leave').textContent = 'Toque de novo para sair';
  setTimeout(() => { el('leave').textContent = 'Sair'; }, 3000);
};

/* ---------- visão do jogador ---------- */
/** Quem este dispositivo controla agora. */
function viewer(): Player {
  if (online) return me;
  if (!state) return 'P1';
  if (!state.config.table) return state.currentTurn;
  return state.active.some(a => a.player === focus) ? focus! : state.active[0]?.player ?? 'P1';
}
/** O viewer pode agir (rolar/escolher/passar) agora? */
function turnOf(s: State, p: Player): 'ROLL_DICE' | 'INPUT_MATH' | 'STEAL_OPPORTUNITY' | null {
  if (s.winner) return null;
  if (s.config.table) return seatOf(s, p)?.phase ?? null;
  return s.currentTurn === p ? (s.phase as 'ROLL_DICE' | 'INPUT_MATH' | 'STEAL_OPPORTUNITY') : null;
}
function canAct() { return !!state && !busy && connected() && turnOf(state, viewer()) !== null; }
function flash(cell: number, success: boolean) {
  const button = el('board').querySelector<HTMLElement>(`[data-id="${cell}"]`);
  if (!button) return;
  button.classList.remove('accepted', 'rejected'); void button.offsetWidth; button.classList.add(success ? 'accepted' : 'rejected');
  setTimeout(() => button.classList.remove('accepted', 'rejected'), 650);
}

/* ---------- desenho ---------- */
function scoreCards(s: State, sort = false) {
  const list = sort ? [...s.order].sort((a, b) => (s.config.mode === 'CLASSIC' ? s.players[b].score - s.players[a].score : s.players[a].score - s.players[b].score)) : s.order;
  const activeNow = new Set(s.config.table ? s.active.map(a => a.player) : [s.currentTurn]);
  return list.map(p => `<div class="score${activeNow.has(p) && !s.winner ? ' active' : ''}${s.winner === p ? ' winner' : ''}" ${color(p)}><span title="${escape(s.players[p].name)}"><small>${online && p === me ? 'você' : !s.config.table && s.order.indexOf(p) === 0 ? 'começa' : '&nbsp;'}</small>${escape(s.players[p].name)}</span><strong>${s.players[p].score}</strong></div>`).join('');
}
const ENDED = {LINE: 'Linha completa', FULL: 'Tabuleiro cheio', ROUNDS: 'Fim das rodadas'} as const;

function banner(s: State): string {
  if (s.winner) return s.winner === 'DRAW' ? 'Empate!' : `${escape(s.players[s.winner].name)} venceu!`;
  if (online && !connected()) return 'Conexão perdida com o anfitrião.';
  const v = viewer(), mine = online;
  if (s.config.table) {
    const seat = seatOf(s, v);
    if (!seat) {
      const place = s.queue.indexOf(v) + 1;
      return online ? `Você está na fila${place ? `: ${place}º` : ''}. Aguarde a sua iniciativa.` : 'Toque num jogador ativo para jogar por ele.';
    }
    const name = escape(s.players[v].name);
    return seat.phase === 'ROLL_DICE' ? (mine ? 'Sua iniciativa: role os dados' : `${name}: role os dados`) : (mine ? `Combine ${s.config.dice === 5 ? '4 dos 5 dados' : 'os dados'} e toque numa casa` : `${name}: combine os dados e toque numa casa`);
  }
  const name = escape(s.players[s.currentTurn].name), me_ = online && s.currentTurn === me;
  if (s.phase === 'STEAL_OPPORTUNITY') return me_ ? 'Roubo! Forme uma casa com os mesmos dados (vale o dobro)' : `${name} pode roubar a jogada`;
  if (s.phase === 'ROLL_DICE') return me_ ? 'Sua vez: role os dados' : online ? `Vez de ${name}` : `Vez de ${name}: role os dados`;
  return me_ ? 'Combine os dados e toque numa casa' : online ? `${name} está pensando…` : `${name}: combine os dados e toque numa casa`;
}

function render() {
  if (!state) return;
  const s = state, n = s.config.board.size, v = viewer(), turn = turnOf(s, v), table = s.config.table, dice = s.config.dice;
  const placing = turn === 'INPUT_MATH' || turn === 'STEAL_OPPORTUNITY';
  el('scores').innerHTML = scoreCards(s);
  el('scores').classList.toggle('compact', s.order.length > 4);
  el('mode-label').textContent = `${table ? 'MESÃO · ' : ''}${s.config.mode === 'CLASSIC' ? 'CLÁSSICO · MAIOR VENCE' : 'CONTIG 60 · MENOR VENCE'}`;
  el('turn-banner').innerHTML = banner(s);
  el('turn-banner').dataset.state = s.winner ? 'over' : s.phase === 'STEAL_OPPORTUNITY' ? 'steal' : turn && online ? 'mine' : 'wait';
  const rounds = s.config.rounds, need = lineNeeded(s);
  el('round').textContent = rounds ? `${roundOf(s)} / ${rounds}` : String(roundOf(s));
  el('need').textContent = s.config.mode === 'CLASSIC' ? 'não vale' : `${need} em linha${need < s.config.board.line ? ' ↓' : ''}`;

  // dados do jogador observado
  const shown = table ? diceOf(s, v) : s.currentDice;
  const faces = shown.length ? shown : Array(dice).fill(0);
  el('phase-label').textContent = s.winner ? 'PARTIDA ENCERRADA' : table ? (turn === null ? 'AGUARDANDO A SUA INICIATIVA' : turn === 'ROLL_DICE' ? 'ROLE OS DADOS' : 'ESCOLHA UMA CASA') : s.phase === 'STEAL_OPPORTUNITY' ? 'CHANCE DE ROUBO' : s.phase === 'ROLL_DICE' ? 'ROLE OS DADOS' : 'ESCOLHA UMA CASA';
  const diceKey = faces.join() + ':' + v + ':' + (table ? seatOf(s, v)?.phase : s.phase);
  el('dice').innerHTML = faces.map(dieHtml).join('');
  el('dice').className = dice === 5 ? 'five' : '';
  el('dice').classList.toggle('roll', placing && shownDice !== diceKey && !s.winner);
  shownDice = diceKey;
  el('dice-hint').textContent = dice === 5 && !s.winner ? 'Use 4 dos 5 dados: descarte um à sua escolha.' : '';
  const last = s.placements.at(-1);
  el('last-move').textContent = last ? `Última: ${s.players[last.player].name} ocupou o ${last.value}${last.steal ? ' (roubo)' : ''} · ${last.points} pt${last.points === 1 ? '' : 's'}` : 'Nenhuma casa ocupada ainda.';

  // Mesão: quem está ativo e quem espera
  el('table-box').hidden = !table || !!s.winner;
  if (table) {
    el('seats').innerHTML = s.active.map(a => `<button type="button" class="seat${a.player === v ? ' focus' : ''}${online && a.player === me ? ' mine' : ''}" data-p="${a.player}" ${color(a.player)}${online ? ' disabled' : ''}><span class="seat-name">${escape(s.players[a.player].name)}${online && a.player === me ? ' <small>você</small>' : ''}</span><span class="seat-state">${a.phase === 'ROLL_DICE' ? 'vai rolar' : a.dice.join(' · ')}</span></button>`).join('');
    el('queue').textContent = s.queue.length ? `Próximos: ${s.queue.slice(0, 6).map(p => s.players[p].name).join(', ')}${s.queue.length > 6 ? ` e mais ${s.queue.length - 6}` : ''}` : 'Fila vazia.';
  }

  const boardEl = el('board');
  boardEl.style.setProperty('--n', String(n));
  boardEl.dataset.size = String(n);
  const click = canAct() && placing;
  boardEl.innerHTML = s.board.map(c => {
    const cls = ['cell', c.owner ? 'owned' : '', last?.cell === c.id ? 'last' : '', s.winningCells.includes(c.id) ? 'win' : ''].filter(Boolean).join(' ');
    return `<button class="${cls}" data-id="${c.id}" data-tier="${tier(c.value, dice)}"${c.owner ? ` ${color(c.owner)}` : ''} aria-label="${c.value}, ${escape(c.owner ? s.players[c.owner].name : 'livre')}"${!click || c.owner ? ' disabled' : ''}><span class="num">${c.value}</span>${c.owner ? `<i class="stone"></i>` : ''}</button>`;
  }).join('');
  el<HTMLButtonElement>('roll').disabled = !canAct() || turn !== 'ROLL_DICE';
  el('roll').hidden = !!s.winner;
  el<HTMLButtonElement>('pass').disabled = !canAct() || !placing;
  el('pass').hidden = !!s.winner;
  el('results-link').hidden = !s.winner;
  if (s.winner && resultSequence !== s.sequence) { resultSequence = s.sequence; fillResults(s); go('resultado'); }
  route();
  autoActions();
}

/** Dado descartado numa jogada de 5 dados, deduzido da conta: o que sobra do conjunto rolado. */
function discarded(dice: number[], expression?: string): string {
  if (dice.length !== 5 || !expression) return '';
  const used = [...expression.matchAll(/\d/g)].map(m => Number(m[0])), rest = [...dice];
  for (const d of used) { const i = rest.indexOf(d); if (i >= 0) rest.splice(i, 1); }
  return rest.length === 1 ? ` · descartou o ${rest[0]}` : '';
}

function fillResults(s: State) {
  const title = s.winner === 'DRAW' ? 'Empate!' : `${s.players[s.winner as Player].name} venceu!`;
  el('result-title').textContent = title;
  el('result-sub').textContent = `${s.endedBy ? ENDED[s.endedBy] : ''} · ${s.config.board.name} · ${roundOf(s)} rodada${roundOf(s) === 1 ? '' : 's'}`;
  el('final-scores').innerHTML = scoreCards(s, true);
  el('history').replaceChildren();
  for (const [i, move] of s.placements.entries()) {
    const row = document.createElement('details'), summary = document.createElement('summary');
    row.className = 'card';
    summary.textContent = `${i + 1}. ${s.players[move.player].name} · casa ${move.value} · ${move.points} ponto${move.points === 1 ? '' : 's'}${move.steal ? ' · roubo' : ''}`;
    const dice = document.createElement('p'), list = document.createElement('ul');
    dice.textContent = `Dados: ${move.dice.join(' · ')} — ${move.expressions.length}${move.dice.length > 3 && move.expressions.length >= 40 ? '+ (as primeiras 40)' : ''} expressões`;
    for (const expression of move.expressions) { const item = document.createElement('li'); item.textContent = `${expression} = ${move.value}${discarded(move.dice, expression)}`; list.append(item); }
    row.append(summary, dice, list);
    el('history').append(row);
  }
  if (!s.placements.length) el('history').textContent = 'Nenhuma casa foi ocupada nesta partida.';
}

/** Ações automáticas: passe sem casas possíveis; o anfitrião cobre jogadores que saíram. */
function autoActions() {
  const s = state;
  if (!s || s.winner) return;
  const v = viewer(), turn = turnOf(s, v), key = `${s.sequence}:${v}`;
  if ((turn === 'INPUT_MATH' || turn === 'STEAL_OPPORTUNITY') && canAct() && autoFor !== key && playable(s, diceOf(s, v)) === 0) {
    autoFor = key;
    toast(`Nenhuma casa possível com ${diceOf(s, v).join(' · ')}: ${turn === 'STEAL_OPPORTUNITY' ? 'sem roubo' : 'a vez passa'}.`, 2200);
    const seq = s.sequence;
    setTimeout(() => { if (state && state.sequence === seq && canAct()) void act({type: 'PASS'}); }, 1800);
  }
  if (online && room?.isHost) {
    const absent = (s.config.table ? s.active.map(a => a.player) : [s.currentTurn]).filter(p => p !== me && !room!.present(p));
    for (const p of absent) {
      const k = `${s.sequence}:away:${p}`, t = turnOf(s, p);
      if (autoFor === k || !t) continue;
      autoFor = k;
      const seq = s.sequence;
      setTimeout(() => { if (state && state.sequence === seq) void act({type: t === 'ROLL_DICE' ? 'SKIP' : 'PASS'}, p); }, 1200);
    }
  }
}

/* ---------- ações ---------- */
let mutex = Promise.resolve();
const serial = <T>(fn: () => Promise<T>) => { const run = mutex.then(fn, fn); mutex = run.then(() => undefined, () => undefined); return run; };

async function start() {
  const base = room ? room.config : config();
  const players = room ? room.roster.length : base.playerCount;
  const names = room ? room.names : localNames();
  const c = sanitizeConfig({...base, playerCount: base.table ? players : base.playerCount, names}), order = shuffledOrder(c);
  state = initial(c, order[0], order);
  session = crypto.randomUUID(); history = []; chain = await hash({session, state});
  if (online) { room!.lock(); room!.send({type: 'INIT', session, state, chain}); }
  history.push({session, initial: state, chain});
  focus = state.config.table ? state.active[0].player : undefined;
  notice(''); go('partida'); render();
}

/** Aplica uma ação válida (local ou anfitrião), transmitindo-a aos demais. */
async function apply(actor: Player, action: Action) {
  if (!state) return;
  const now = Date.now(), next = reduce(state, actor, action, now);
  const event = {type: 'ACTION', session, sequence: next.sequence, actor, action, now, previous: chain}, digest = await hash({event, state: next});
  if (online) room!.send({...event, digest});
  chain = digest; state = next; history.push({...event, digest});
}

async function act(action: Action, actor: Player = viewer()) {
  if (!state) return;
  if (online && !room!.isHost) {
    if (busy || !connected()) return;
    busy = true;
    room!.send({type: 'PROPOSE', session, action});
    setTimeout(() => { if (busy) { busy = false; render(); } }, 4000);
    render();
    return;
  }
  busy = true;
  await serial(async () => {
    try {
      await apply(actor, action);
      notice('');
      busy = false; render();
      if (action.type === 'PLACE') flash(action.cell, true);
    } catch (e) {
      busy = false; render();
      if (action.type === 'PLACE') flash(action.cell, false); else if (actor === viewer()) toast((e as Error).message);
    }
  });
}

let incoming = Promise.resolve();
async function receive(sender: Player, raw: unknown) {
  const m = raw as any;
  if (room?.isHost) {
    // Anfitrião: só aceita propostas, aplica na ordem de chegada e transmite.
    if (m?.type !== 'PROPOSE' || m.session !== session || !state || !ACTION_TYPES.includes(m.action?.type)) throw Error('Pacote inválido');
    await serial(async () => {
      try { await apply(sender, m.action); notice(''); render(); if (m.action.type === 'PLACE') flash(m.action.cell, true); }
      catch (e) { room!.sendTo(sender, {type: 'REJECT', session, reason: (e as Error).message, cell: m.action.type === 'PLACE' ? m.action.cell : undefined}); }
    });
    return;
  }
  if (sender !== 'P1') throw Error('Origem inválida');
  if (m.type === 'REJECT') {
    busy = false; render();
    if (typeof m.cell === 'number') flash(m.cell, false); else toast(String(m.reason).slice(0, 120));
    return;
  }
  if (m.type === 'INIT') {
    if (me === 'P1' || state || typeof m.session !== 'string' || !room?.config) throw Error('Inicialização inválida');
    const c = sanitizeConfig(m.state?.config), strip = ({names, playerCount, ...rest}: Config) => rest;
    if (JSON.stringify(strip(c)) !== JSON.stringify(strip(room.config))) throw Error('Configuração inválida');
    me = room.me;
    if (!participants(c).includes(me)) throw Error('Você não está nesta partida.');
    const expected = initial(c, m.state.currentTurn, m.state.order);
    if (JSON.stringify(expected) !== JSON.stringify(m.state) || await hash({session: m.session, state: expected}) !== m.chain) throw Error('Estado inicial inválido');
    state = expected; session = m.session; chain = m.chain; history = [{session, initial: state, chain}];
    notice(''); go('partida'); render();
    return;
  }
  if (!state || m.type !== 'ACTION' || m.session !== session || m.previous !== chain || m.sequence !== state.sequence + 1 || typeof m.actor !== 'string' || !Number.isFinite(m.now) || !ACTION_TYPES.includes(m.action?.type)) throw Error('Histórico divergente ou pacote inválido');
  const next = reduce(state, m.actor, m.action, m.now), {digest, ...event} = m;
  if (await hash({event, state: next}) !== digest) throw Error('Hash divergente');
  state = next; chain = digest; history.push(m);
  if (m.actor === me) busy = false;
  render();
  if (m.action.type === 'PLACE') flash(m.action.cell, true);
}

/* ---------- sala online ---------- */
function slots() {
  const r = room;
  if (!r?.config) return;
  const c = r.config, table = c.table, need = table ? 3 : c.playerCount;
  const entries = [...r.roster];
  const empty = table ? 0 : Math.max(0, c.playerCount - entries.length);
  el('slots').innerHTML = entries.map(e => `<li class="slot here" ${color(e.p)}><span class="player-dot"></span><span class="slot-name">${escape(e.name)}${e.p === r.me ? ' <small>você</small>' : e.p === 'P1' ? ' <small>anfitrião</small>' : ''}</span><span class="slot-state">${e.here ? 'pronto' : 'saiu'}</span></li>`).join('') + Array.from({length: empty}, () => `<li class="slot"><span class="player-dot" style="--pc:#556"></span><span class="slot-name">Aguardando jogador…</span><span class="slot-state"></span></li>`).join('');
  el('roster-count').textContent = table ? `${entries.length}` : `${entries.length} / ${c.playerCount}`;
  const rules = [c.board.name, `${c.board.size}×${c.board.size}`, ...(table ? [`Mesão`, c.dice === 5 ? '5 dados' : '3 dados', `${initiativeOf({...c, playerCount: Math.max(entries.length, need)})} ativos`] : []), c.mode === 'CLASSIC' ? 'Clássico' : 'Contig 60', c.rounds ? `${c.rounds} rodadas` : 'sem limite', ...(table ? [] : [`${c.playerCount} jogadores`]), ...(c.timer ? ['Blitz'] : []), ...(c.penalty ? ['Penalidade'] : [])];
  el('rules-summary').innerHTML = rules.map(x => `<span class="chip">${escape(x)}</span>`).join('');
  el('lobby-board').innerHTML = miniBoard(c.board, c.dice);
}
function lobby() {
  if (room?.config && !state) {
    slots();
    const host = room.isHost, c = room.config, count = room.roster.filter(e => e.here).length, ok = c.table ? count >= 3 : count === c.playerCount;
    me = room.me;
    el<HTMLButtonElement>('begin').disabled = !host || !ok;
    el('begin').hidden = !host;
    el('lobby-wait').textContent = host ? (ok ? (c.table ? `${count} jogadores na mesa. Podem entrar mais, ou comece agora.` : 'Todos prontos. É só começar!') : c.table ? `Faltam ${3 - count} jogador${3 - count > 1 ? 'es' : ''} (mínimo 3). Passe o código da sala.` : `Faltam ${c.playerCount - count} jogador${c.playerCount - count > 1 ? 'es' : ''}. Passe o código da sala.`) : 'Conectado! Aguardando o anfitrião iniciar a partida.';
  }
  if (state && !connected()) toast('Conexão perdida com o anfitrião.', 6000);
  render();
}
function onRoomError(message: string) { toast(message, 8000); render(); }
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
  receive: (sender: Player, data: unknown) => { incoming = incoming.then(() => receive(sender, data)).catch(e => onRoomError((e as Error).message)); },
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
el('begin').onclick = () => { if (room?.isHost && !state) void start().catch(e => toast(String(e))); };

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
  const id = Number(b.dataset.id), cell = state.board[id], dice = diceOf(state, viewer());
  if (cell.owner || !canForm(dice, cell.value)) { flash(id, false); return; }
  void act({type: 'PLACE', cell: id});
};
el('seats').onclick = e => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-p]');
  if (b && !online) { focus = b.dataset.p as Player; render(); }
};
el('roll').onclick = () => void act({type: 'ROLL', dice: Array.from({length: state?.config.dice ?? 3}, die)});
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
  const v = viewer(), deadline = state.config.table ? seatOf(state, v)?.deadline ?? null : state.deadline;
  const left = deadline ? Math.max(0, Math.ceil((deadline - Date.now()) / 1000)) : null;
  el('clock').textContent = left === null ? '' : `${left}s`;
  el('clock').classList.toggle('urgent', left !== null && left <= 10);
  if (deadline && Date.now() >= deadline && canAct() && turnOf(state, v) === 'INPUT_MATH') void act({type: 'TIMEOUT'});
}, 250);

el<HTMLInputElement>('my-name').value = store.get('name') ?? '';
renderForm(); route();
