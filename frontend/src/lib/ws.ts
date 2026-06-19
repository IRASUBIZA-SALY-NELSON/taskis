'use client';

import { Client, type IMessage } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

// sockjs-client expects a `global` reference in some bundlers.
if (typeof window !== 'undefined' && !(window as any).global) {
  (window as any).global = window;
}

type Handler = (body: any) => void;

interface Registration {
  destination: string;
  handler: Handler;
  sub?: { unsubscribe: () => void };
}

let client: Client | null = null;
const registrations = new Set<Registration>();

function wsUrl() {
  return `http://${window.location.hostname}:8080/ws`;
}

function ensureClient(): Client {
  if (client) return client;
  client = new Client({
    webSocketFactory: () => new SockJS(wsUrl()) as any,
    connectHeaders: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
    reconnectDelay: 3000,
    heartbeatIncoming: 10000,
    heartbeatOutgoing: 10000,
    onConnect: () => {
      // (Re)subscribe every active registration on each (re)connect.
      registrations.forEach((reg) => {
        reg.sub = client!.subscribe(reg.destination, (msg: IMessage) => {
          let body: any = msg.body;
          try { body = JSON.parse(msg.body); } catch { /* keep raw */ }
          reg.handler(body);
        });
      });
    },
  });
  client.activate();
  return client;
}

/** Subscribe to a STOMP destination; returns an unsubscribe fn. Survives reconnects. */
export function subscribe(destination: string, handler: Handler): () => void {
  const c = ensureClient();
  const reg: Registration = { destination, handler };
  registrations.add(reg);
  if (c.connected) {
    reg.sub = c.subscribe(destination, (msg: IMessage) => {
      let body: any = msg.body;
      try { body = JSON.parse(msg.body); } catch { /* keep raw */ }
      handler(body);
    });
  }
  return () => {
    try { reg.sub?.unsubscribe(); } catch { /* noop */ }
    registrations.delete(reg);
  };
}

/** Publish a JSON message to an application destination (e.g. /app/chat.typing). */
export function publish(destination: string, body: unknown) {
  const c = ensureClient();
  if (c.connected) c.publish({ destination, body: JSON.stringify(body) });
}

/** Tear the connection down (e.g. on logout). */
export function disconnectWs() {
  registrations.clear();
  client?.deactivate();
  client = null;
}
