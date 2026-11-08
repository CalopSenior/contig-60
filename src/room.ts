import Peer, {type DataConnection} from 'peerjs';
import {SANITY_PLAYER_GUARD, playerName, sanitizeConfig, type Config, type Player} from './game';

/**
 * Sala online em estrela. Um corretor público (PeerJS) só apresenta os jogadores ao anfitrião;
 * depois as mensagens passam direto por WebRTC. O anfitrião (P1) distribui os assentos,
 * é quem põe as jogadas em ordem e as repassa a todos. Funciona com qualquer número de jogadores
 * sem precisar de uma conexão entre cada par.
 */
const PREFIX = 'contig60-';
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 5;

export const newCode = () => Array.from(crypto.getRandomValues(new Uint8Array(CODE_LENGTH)), n => ALPHABET[n % ALPHABET.length]).join('');
export const normalizeCode = (raw: string) => raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LENGTH);
const hostId = (code: string) => PREFIX + code;
const seatName = (index: number) => `P${index + 2}` as Player;

export type Entry = {p: Player; name: string; here: boolean};
export type RoomEvents = {
  /** Mensagem de jogo (não da sala). `sender` é o assento de onde veio. */
  receive: (sender: Player, data: unknown) => void;
  changed: () => void;
  /** Problema depois que a sala já estava aberta. */
  failed: (message: string) => void;
};

type Wire =
  | {type: 'HELLO'; room: string; name: string}
  | {type: 'NAME'; name: string}
  | {type: 'WELCOME'; room: string; you: Player; config: Config; roster: Entry[]}
  | {type: 'ROSTER'; roster: Entry[]}
  | {type: 'SEAT'; you: Player}
  | {type: 'DENIED'; reason: string};
const CONTROL = ['HELLO', 'NAME', 'WELCOME', 'ROSTER', 'SEAT', 'DENIED'];

function describe(error: {type?: string; message?: string}): string {
  switch (error.type) {
    case 'peer-unavailable': return 'Sala não encontrada. Confira o código.';
    case 'network': case 'server-error': case 'socket-error': case 'socket-closed': return 'Não foi possível falar com o servidor de salas. Verifique sua internet.';
    case 'browser-incompatible': return 'Este navegador não suporta partidas online.';
    default: return error.message || 'Falha na conexão online.';
  }
}

function openPeer(id?: string): Promise<Peer> {
  return new Promise((resolve, reject) => {
    const peer = id ? new Peer(id, {debug: 0}) : new Peer({debug: 0});
    const timer = setTimeout(() => { peer.destroy(); reject({type: 'network'}); }, 12000);
    peer.once('open', () => { clearTimeout(timer); resolve(peer); });
    peer.once('error', e => { clearTimeout(timer); peer.destroy(); reject(e); });
  });
}

type Seat = {conn: DataConnection; name: string; here: boolean};

export class Room {
  config: Config;
  me: Player = 'P1';
  roster: Entry[] = [];
  readonly isHost: boolean;
  private closed = false;
  private locked = false;
  private seats: Seat[] = []; // anfitrião: assentos P2, P3, ... em ordem
  private hostLink?: DataConnection; // convidado
  private hostName = 'P1';
  private onWelcome: (error?: string) => void = () => {};

  private constructor(readonly code: string, private peer: Peer, private events: RoomEvents, config: Config, host: boolean) {
    this.config = config;
    this.isHost = host;
    peer.on('error', e => { if (!this.closed && e.type !== 'peer-unavailable') this.events.failed(describe(e)); });
    peer.on('disconnected', () => { if (!this.closed) peer.reconnect(); });
    if (host) peer.on('connection', conn => this.accept(conn));
  }

  /** Cria uma sala nova. Repete com outro código se o sorteado já estiver em uso. */
  static async host(config: Config, name: string, events: RoomEvents): Promise<Room> {
    for (let attempt = 0; ; attempt++) {
      const code = newCode();
      try {
        const room = new Room(code, await openPeer(hostId(code)), events, config, true);
        room.hostName = playerName(name, 'P1');
        room.publish();
        return room;
      } catch (e) {
        if ((e as {type?: string}).type !== 'unavailable-id' || attempt >= 4) throw Error(describe(e as {type?: string}));
      }
    }
  }

  /** Entra numa sala existente. O anfitrião define o assento. */
  static async join(rawCode: string, name: string, events: RoomEvents): Promise<Room> {
    const code = normalizeCode(rawCode);
    if (code.length !== CODE_LENGTH) throw Error('O código da sala tem 5 letras ou números.');
    let peer: Peer;
    try { peer = await openPeer(); } catch (e) { throw Error(describe(e as {type?: string})); }
    const room = new Room(code, peer, events, undefined as unknown as Config, false);
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const done = (error?: string) => { if (settled) return; settled = true; clearTimeout(timer); if (error) { room.close(); reject(Error(error)); } else resolve(); };
      const timer = setTimeout(() => done('Sala não encontrada. Confira o código.'), 10000);
      peer.on('error', e => { if (e.type === 'peer-unavailable') done(describe(e)); });
      room.onWelcome = done;
      const conn = peer.connect(hostId(code), {serialization: 'json', reliable: true});
      room.hostLink = conn;
      const hello = () => conn.send({type: 'HELLO', room: code, name: playerName(name, 'P2')} satisfies Wire);
      if (conn.open) hello(); else conn.on('open', hello);
      conn.on('data', data => room.onGuestData(conn, data));
      conn.on('close', () => { if (!settled) done('A sala fechou a conexão.'); else room.lost(); });
    });
    return room;
  }

  /** Interface: o jogador está ligado ao anfitrião? */
  get linked() { return this.isHost || !!this.hostLink?.open; }
  present(p: Player) { return this.roster.find(e => e.p === p)?.here ?? false; }
  nameOf(p: Player): string { return this.roster.find(e => e.p === p)?.name ?? p; }
  get names(): Partial<Record<Player, string>> { return Object.fromEntries(this.roster.map(e => [e.p, e.name])); }
  get capacity() { return this.config.table ? SANITY_PLAYER_GUARD : this.config.playerCount; }

  /* ---------- anfitrião ---------- */
  private build(): Entry[] {
    return [{p: 'P1', name: this.hostName, here: true}, ...this.seats.map((s, i) => ({p: seatName(i), name: s.name, here: s.here}))];
  }
  private publish() {
    this.roster = this.build();
    for (const s of this.seats) if (s.here && s.conn.open) s.conn.send({type: 'ROSTER', roster: this.roster} satisfies Wire);
    this.events.changed();
  }
  /** Depois de iniciar a partida ninguém mais entra e os assentos ficam fixos. */
  lock() { this.locked = true; }

  private accept(conn: DataConnection) {
    let seat: Seat | undefined;
    const deny = (reason: string) => { if (conn.open) conn.send({type: 'DENIED', reason} satisfies Wire); setTimeout(() => conn.close(), 300); };
    conn.on('data', raw => {
      try {
        const m = raw as Wire;
        if (!m || typeof m !== 'object') throw Error('Pacote inválido');
        if (!seat) {
          if (m.type !== 'HELLO' || m.room !== this.code) throw Error('Sala inválida');
          if (this.locked) return deny('A partida já começou.');
          if (this.seats.length + 1 >= this.capacity) return deny('Sala cheia.');
          seat = {conn, name: playerName(m.name, seatName(this.seats.length)), here: true};
          this.seats.push(seat);
          const you = seatName(this.seats.length - 1);
          this.roster = this.build();
          conn.send({type: 'WELCOME', room: this.code, you, config: this.config, roster: this.roster} satisfies Wire);
          this.publish();
          return;
        }
        const who = seatName(this.seats.indexOf(seat));
        if (m.type === 'NAME') { seat.name = playerName(m.name, who); this.publish(); return; }
        if (CONTROL.includes(m.type)) return;
        this.events.receive(who, raw);
      } catch (e) {
        this.events.failed((e as Error).message);
      }
    });
    const gone = () => {
      if (!seat || !seat.here || this.closed) return;
      seat.here = false;
      if (!this.locked) {
        const at = this.seats.indexOf(seat);
        this.seats.splice(at, 1);
        this.seats.slice(at).forEach((s, i) => { if (s.conn.open) s.conn.send({type: 'SEAT', you: seatName(at + i)} satisfies Wire); });
      }
      this.publish();
    };
    conn.on('close', gone);
    conn.on('error', gone);
  }

  /* ---------- convidado ---------- */
  private onGuestData(conn: DataConnection, raw: unknown) {
    try {
      const m = raw as Wire;
      if (!m || typeof m !== 'object') throw Error('Pacote inválido');
      if (m.type === 'WELCOME') {
        if (m.room !== this.code) throw Error('Sala inválida');
        this.config = sanitizeConfig(m.config);
        this.me = m.you; this.roster = m.roster;
        this.onWelcome();
        this.events.changed();
      } else if (m.type === 'DENIED') { this.onWelcome(m.reason); }
      else if (m.type === 'ROSTER') { this.roster = m.roster; this.events.changed(); }
      else if (m.type === 'SEAT') { this.me = m.you; this.events.changed(); }
      else if (!CONTROL.includes(m.type)) this.events.receive('P1', raw);
    } catch (e) {
      this.events.failed((e as Error).message);
    }
  }
  private lost() {
    if (this.closed) return;
    this.events.failed('A conexão com o anfitrião caiu.');
    this.events.changed();
  }

  setName(name: string) {
    if (this.isHost) { this.hostName = playerName(name, 'P1'); this.publish(); }
    else if (this.hostLink?.open) this.hostLink.send({type: 'NAME', name: playerName(name, this.me)} satisfies Wire);
  }

  /** Convidado: envia ao anfitrião. Anfitrião: envia a todos. */
  send(data: unknown) {
    if (this.isHost) { for (const s of this.seats) if (s.here && s.conn.open) s.conn.send(data); }
    else if (this.hostLink?.open) this.hostLink.send(data);
    else throw Error('Conexão indisponível.');
  }
  /** Só o anfitrião: envia a um assento. */
  sendTo(p: Player, data: unknown) {
    const s = this.seats[Number(p.slice(1)) - 2];
    if (s?.here && s.conn.open) s.conn.send(data);
  }

  close() {
    this.closed = true;
    for (const s of this.seats) s.conn.close();
    this.hostLink?.close();
    this.peer.destroy();
  }
}
