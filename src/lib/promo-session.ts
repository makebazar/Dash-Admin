import crypto from "crypto";
import type { ReadonlyRequestCookies } from "next/dist/server/web/spec-extension/adapters/request-cookies";

interface PromoSessionState {
  revokedTokens: Set<string>;
  activePlayerTokens: Map<string, string>;
  loggedOutPlayers: Set<string>;
  ipSessions: Map<string, string>;
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
      ipSessions: new Map<string, string>(),
    };
  }
  if (!globalForPromoSession.__promoSessionState.ipSessions) {
    globalForPromoSession.__promoSessionState.ipSessions = new Map<string, string>();
  }
  return globalForPromoSession.__promoSessionState;
}

export function extractClientIp(request: Request): string {
  const cfIp = request.headers.get("cf-connecting-ip");
  const realIp = request.headers.get("x-real-ip");
  const forwardedFor = request.headers.get("x-forwarded-for");
  const rawIp = cfIp || realIp || (forwardedFor ? forwardedFor.split(",")[0].trim() : "127.0.0.1");
  return rawIp.replace(/^::ffff:/, "");
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

export function registerBrowserSession(playerId: string, _clientIp?: string, _cookieString?: string) {
  const state = getSessionState();
  state.loggedOutPlayers.delete(String(playerId));
}

export function getAgentSessionByIp(_clientIp: string): string | null {
  return null;
}

export function revokePromoSession(playerId?: string, token?: string, clientIp?: string) {
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
  if (clientIp) {
    state.ipSessions.delete(clientIp);
  }
}

export function isPromoSessionValid(
  cookieStore: ReadonlyRequestCookies,
  playerId?: string,
  isFromAgent?: boolean
): boolean {
  if (!playerId) return false;
  const state = getSessionState();
  const pid = String(playerId);
  const token = cookieStore.get("promo_player_token")?.value;

  if (token && state.revokedTokens.has(token)) {
    return false;
  }
  if (state.loggedOutPlayers.has(pid)) {
    if (!isFromAgent) {
      // Browser still has valid promo_player_id cookie (user is logged in on browser)
      state.loggedOutPlayers.delete(pid);
      return true;
    }
    return false;
  }
  return true;
}
