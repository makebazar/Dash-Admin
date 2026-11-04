import crypto from "crypto";
import type { ReadonlyRequestCookies } from "next/dist/server/web/spec-extension/adapters/request-cookies";

interface PromoSessionState {
  revokedTokens: Set<string>;
  activePlayerTokens: Map<string, string>;
  loggedOutPlayers: Set<string>;
}

const globalForPromoSession = globalThis as unknown as {
  __promoSessionState?: PromoSessionState;
};

function getSessionState(): PromoSessionState {
  if (!globalForPromoSession.__promoSessionState) {
    globalForPromoSession.__promoSessionState = {
      revokedTokens: new Set<string>(),
      activePlayerTokens: new Map<string, string>(),
      loggedOutPlayers: new Set<string>(),
    };
  }
  return globalForPromoSession.__promoSessionState;
}

export function issuePromoSessionToken(playerId: string): string {
  const state = getSessionState();
  const token = crypto.randomUUID();
  const prevToken = state.activePlayerTokens.get(String(playerId));
  if (prevToken) {
    state.revokedTokens.add(prevToken);
  }
  state.activePlayerTokens.set(String(playerId), token);
  state.loggedOutPlayers.delete(String(playerId));
  return token;
}

export function revokePromoSession(playerId?: string, token?: string) {
  const state = getSessionState();
  if (token) {
    state.revokedTokens.add(token);
  }
  if (playerId) {
    const pid = String(playerId);
    const activeToken = state.activePlayerTokens.get(pid);
    if (activeToken) {
      state.revokedTokens.add(activeToken);
      state.activePlayerTokens.delete(pid);
    }
    state.loggedOutPlayers.add(pid);
  }
}

export function isPromoSessionValid(cookieStore: ReadonlyRequestCookies, playerId?: string): boolean {
  if (!playerId) return false;
  const state = getSessionState();
  const pid = String(playerId);
  const token = cookieStore.get("promo_player_token")?.value;

  if (token && state.revokedTokens.has(token)) {
    return false;
  }
  if (state.loggedOutPlayers.has(pid)) {
    return false;
  }
  const expectedToken = state.activePlayerTokens.get(pid);
  if (expectedToken && token !== expectedToken) {
    return false;
  }
  return true;
}
