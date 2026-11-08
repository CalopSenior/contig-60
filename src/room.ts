import Peer, {type DataConnection} from 'peerjs';
import {participants, playerName, sanitizeConfig, PLAYERS, type Config, type Player} from './game';

/**
 * Sala online. Um corretor público (PeerJS) só apresenta os jogadores uns aos outros;
 * depois disso as jogadas trafegam direto entre os dispositivos (WebRTC, malha completa).
 *
 * O anfitrião é sempre P1 e tem o ID `contig60-CODIGO-1`. Quem entra assume o primeiro
 * assento livre (P2, P3, P4) e a ligação entre dois convidados é aberta pelo de número maior.
 */
const PREFIX = 'contig60-';
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 5;

export const newCode = () => Array.from(crypto.getRandomValues(new Uint8Array(CODE_LENGTH)), n => ALPHABET[n % ALPHABET.length]).join('');
export const normalizeCode = (raw: string) => raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LENGTH);
const peerId = (code: string, p: Player) => `${PREFIX}${code}-${p[1]}`;
const playerOf = (code: string, id: string): Player | undefined => PLAYERS.find(p => peerId(code, p) === id);

export type RoomEvents = {
  receive: (sender: Player, data: unknown) => void;
  changed: () => void;
  /** Problema depois que a sala já estava aberta. */
  failed: (message: string) => void;
};

type Wire = {type: 'HELLO'; room: string; name: string; config?: Config} | {type: 'READY'; room: string; name: string} | {type: 'NOT_READY'; room: string};

function describe(error: {type?: string; message?: string}): string {
  switch (error.type) {
    case 'peer-unavailable': return 'Sala não encontrada. Confira o código.';
    case 'network': case 'server-error': case 'socket-error': case 'socket-closed': return 'Não foi possível falar com o servidor de salas. Verifique sua internet.';
    case 'browser-incompatible': return 'Este navegador não suporta partidas online.';
    default: return error.message || 'Falha na conexão online.';
  }
}

function openPeer(id: string): Promise<Peer> {
  return new Promise((resolve, reject) => {
    const peer = new Peer(id, {debug: 0});
    const timer = setTimeout(() => { peer.destroy(); reject({type: 'network'}); }, 12000);
    peer.once('open', () => { clearTimeout(timer); resolve(peer); });
    peer.once('error', e => { clearTimeout(timer); peer.destroy(); reject(e); });
  });
}

export class Room {
  readonly names: Partial<Record<Player, string>> = {};
  readonly ready = new Set<Player>();
  readonly links = new Map<Player, DataConnection>();
  config?: Config;
  private closed = false;
  private constructor(readonly code: string, readonly me: Player, private peer: Peer, private events: RoomEvents, config?: Config) {
    this.config = config;
    peer.on('connection', conn => this.accept(conn));
    peer.on('error', e => { if (!this.closed && e.type !== 'peer-unavailable') this.events.failed(describe(e)); });
    peer.on('disconnected', () => { if (!this.closed) peer.reconnect(); });
  }

  /** Cria uma sala nova. Repete com outro código se o sorteado já estiver em uso. */
  static async host(config: Config, name: string, events: RoomEvents): Promise<Room> {
    for (let attempt = 0; ; attempt++) {
      const code = newCode();
      try {
        const room = new Room(code, 'P1', await openPeer(peerId(code, 'P1')), events, config);
        room.names.P1 = playerName(name, 'P1');
        return room;
      } catch (e) {
        if ((e as {type?: string}).type !== 'unavailable-id' || attempt >= 4) throw Error(describe(e as {type?: string}));
      }
    }
  }

  /** Entra numa sala existente no primeiro assento livre. */
  static async join(rawCode: string, name: string, events: RoomEvents): Promise<Room> {
    const code = normalizeCode(rawCode);
    if (code.length !== CODE_LENGTH) throw Error('O código da sala tem 5 letras ou números.');
    for (const me of PLAYERS.slice(1)) {
      let peer: Peer;
      try { peer = await openPeer(peerId(code, me)); } catch (e) {
        if ((e as {type?: string}).type === 'unavailable-id') continue;
        throw Error(describe(e as {type?: string}));
      }
      const room = new Room(code, me, peer, events);
      room.names[me] = playerName(name, me);
      await room.enter();
      return room;
    }
    throw Error('Sala cheia.');
  }

  /** Liga ao anfitrião e espera as regras da sala. */
  private enter(): Promise<void> {
    return new Promise((resolve, reject) => {
      let settled = false;
      const fail = (message: string) => { if (settled) return; settled = true; clearTimeout(timer); this.close(); reject(Error(message)); };
      const timer = setTimeout(() => fail('Sala não encontrada. Confira o código.'), 10000);
      this.peer.on('error', e => { if (e.type === 'peer-unavailable' && !this.config) fail(describe(e)); });
      this.onConfig = () => { if (settled) return; settled = true; clearTimeout(timer); resolve(); };
      this.onReject = fail;
      this.dial('P1');
    });
  }
  private onConfig: () => void = () => {};
  private onReject: (message: string) => void = () => {};

  get members(): Player[] { return this.config ? participants(this.config) : []; }
  get others(): Player[] { return this.members.filter(p => p !== this.me); }
  private isOpen(p: Player) { return !!this.links.get(p)?.open; }
  get linked() { return this.config !== undefined && this.others.every(p => this.isOpen(p)); }
  get complete() { return this.linked && this.members.every(p => this.ready.has(p)); }
  /** Jogadores já conectados a mim (para a lista da sala). */
  present(p: Player) { return p === this.me || this.isOpen(p); }

  setName(name: string) { this.names[this.me] = playerName(name, this.me); this.refresh(); }

  private dial(target: Player) {
    if (this.closed || this.links.get(target)) return;
    this.bind(target, this.peer.connect(peerId(this.code, target), {serialization: 'json', reliable: true}));
  }

  private accept(conn: DataConnection) {
    const from = playerOf(this.code, conn.peer);
    const stale = from ? this.links.get(from) : undefined;
    if (!from || from === this.me || (this.config && !this.members.includes(from)) || (stale?.open)) { conn.close(); return; }
    this.bind(from, conn);
  }

  private bind(who: Player, conn: DataConnection) {
    this.links.set(who, conn);
    const opened = () => {
      this.send1(conn, {type: 'HELLO', room: this.code, name: this.names[this.me] ?? this.me, ...(this.me === 'P1' ? {config: this.config} : {})});
      this.refresh();
    };
    if (conn.open) opened(); else conn.on('open', opened);
    conn.on('data', data => this.onData(who, conn, data));
    const gone = () => { if (this.links.get(who) !== conn) return; this.ready.delete(who); this.refresh(); };
    conn.on('close', gone);
    conn.on('error', gone);
  }

  private onData(who: Player, conn: DataConnection, raw: unknown) {
    if (this.links.get(who) !== conn) return;
    try {
      const m = raw as Wire;
      if (typeof m !== 'object' || m === null) throw Error('Pacote inválido');
      if (m.type === 'HELLO' || m.type === 'READY' || m.type === 'NOT_READY') {
        if (m.room !== this.code) throw Error('Sala inválida');
        if (m.type === 'HELLO') this.hello(who, m);
        else if (m.type === 'READY') { this.names[who] = playerName(m.name, who); this.ready.add(who); this.events.changed(); }
        else { this.ready.delete(who); this.events.changed(); }
        return;
      }
      this.events.receive(who, raw);
    } catch (e) {
      this.events.failed((e as Error).message);
    }
  }

  private hello(who: Player, m: Extract<Wire, {type: 'HELLO'}>) {
    this.names[who] = playerName(m.name, who);
    if (who === 'P1' && !this.config) {
      const config = sanitizeConfig(m.config);
      if (!participants(config).includes(this.me)) { this.onReject('Sala cheia.'); return; }
      this.config = config;
      for (const p of this.others) if (p !== 'P1' && PLAYERS.indexOf(p) < PLAYERS.indexOf(this.me)) this.dial(p);
      this.onConfig();
    }
    this.refresh();
  }

  private send1(conn: DataConnection, data: unknown) { if (conn.open) conn.send(data); }

  /** Anuncia se já estou ligado a todos e avisa a interface. */
  private refresh() {
    if (this.closed) return;
    if (this.linked) {
      this.ready.add(this.me);
      for (const conn of this.links.values()) this.send1(conn, {type: 'READY', room: this.code, name: this.names[this.me] ?? this.me});
    } else {
      this.ready.delete(this.me);
      for (const conn of this.links.values()) this.send1(conn, {type: 'NOT_READY', room: this.code});
    }
    this.events.changed();
  }

  send(data: unknown) {
    if (!this.complete) throw Error('Todos os jogadores precisam estar conectados.');
    for (const conn of this.links.values()) conn.send(data);
  }

  close() {
    this.closed = true;
    for (const conn of this.links.values()) conn.close();
    this.peer.destroy();
  }
}
