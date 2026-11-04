/** Minimal in-memory WebSocket used to drive the remote-session client in tests. */
export class FakeWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  static instances: FakeWebSocket[] = [];

  readonly CONNECTING = 0;
  readonly OPEN = 1;
  readonly CLOSING = 2;
  readonly CLOSED = 3;

  readyState = FakeWebSocket.CONNECTING;
  readonly sent: unknown[] = [];
  private readonly listeners = new Map<string, Set<(event: unknown) => void>>();

  constructor(readonly url: string) {
    FakeWebSocket.instances.push(this);
  }

  static latest(): FakeWebSocket {
    const socket = FakeWebSocket.instances.at(-1);
    if (!socket) throw new Error('No FakeWebSocket was created');
    return socket;
  }

  static reset(): void {
    FakeWebSocket.instances = [];
  }

  addEventListener(type: string, listener: (event: unknown) => void): void {
    const bucket = this.listeners.get(type) ?? new Set();
    bucket.add(listener);
    this.listeners.set(type, bucket);
  }

  removeEventListener(type: string, listener: (event: unknown) => void): void {
    this.listeners.get(type)?.delete(listener);
  }

  send(data: string): void {
    this.sent.push(JSON.parse(data));
  }

  close(): void {
    if (this.readyState === FakeWebSocket.CLOSED) return;
    this.readyState = FakeWebSocket.CLOSED;
    this.emit('close', {});
  }

  // --- test controls -------------------------------------------------------

  open(): void {
    this.readyState = FakeWebSocket.OPEN;
    this.emit('open', {});
  }

  receive(message: unknown): void {
    this.emit('message', { data: typeof message === 'string' ? message : JSON.stringify(message) });
  }

  fail(): void {
    this.emit('error', {});
  }

  dropConnection(): void {
    this.readyState = FakeWebSocket.CLOSED;
    this.emit('close', {});
  }

  private emit(type: string, event: unknown): void {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
}
