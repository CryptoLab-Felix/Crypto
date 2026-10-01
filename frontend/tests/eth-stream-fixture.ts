import type { Page, WebSocketRoute } from "@playwright/test";
import type { OrderBookSnapshot } from "../src/EthOrderBook";

export const bookFixture = (price = "2000.00"): OrderBookSnapshot => ({
  symbol: "ETHUSDT", price,
  asks: [["2000.10", "2"], ["2000.20", "3"], ["2001.20", "4"]],
  bids: [["1999.90", "1.5"], ["1999.80", "2.5"], ["1998.50", "6"]],
  book_status: "live", price_status: "live",
  book_time: Date.now(), price_time: Date.now(),
  book_received_at: Date.now(), price_received_at: Date.now(), server_time: Date.now(),
});

export async function mockEthStream(page: Page, initial = bookFixture()) {
  const connections: WebSocketRoute[] = [];
  const active = new Set<WebSocketRoute>();
  let state = initial;
  let autoSend = true;
  const send = (update: Partial<OrderBookSnapshot> = {}) => {
    state = { ...state, server_time: Date.now(), ...update };
    for (const socket of active) socket.send(JSON.stringify(state));
  };
  const timer = setInterval(() => {
    if (autoSend) send({ book_received_at: state.book_status === "live" ? Date.now() : state.book_received_at });
  }, 500);
  page.on("close", () => clearInterval(timer));
  await page.routeWebSocket("**/api/markets/futures/eth/orderbook", (socket) => {
    connections.push(socket);
    active.add(socket);
    socket.onClose(() => active.delete(socket));
    if (autoSend) send();
  });
  return {
    connections, active, send,
    pause: () => { autoSend = false; },
    resume: () => { autoSend = true; send(); },
  };
}
