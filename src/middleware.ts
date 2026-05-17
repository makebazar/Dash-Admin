import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const host = req.headers.get("host") || "";
  const { pathname } = req.nextUrl;

  // --- CONFIGURATION ---
  const isDev =
    process.env.NODE_ENV === "development" ||
    host.includes("localhost") ||
    host.includes("127.0.0.1") ||
    host.includes("0.0.0.0");

  // Skip subdomain logic in development unless specifically testing them
  if (isDev) {
    return NextResponse.next();
  }

  // 0. WWW TO NON-WWW REDIRECT (Production only)
  if (host.startsWith("www.")) {
    const url = req.nextUrl.clone();
    url.hostname = host.split(":")[0].replace(/^www\./, "");
    url.port = ""; // Remove port for the public redirect
    return NextResponse.redirect(url, 301);
  }

  const ADMIN_DOMAIN = process.env.ADMIN_DOMAIN || "admin.mydashadmin.ru";
  const GAME_DOMAIN =
    process.env.NEXT_PUBLIC_GAME_DOMAIN || "game.mydashadmin.ru";

  // 1. GAME DOMAIN LOGIC
  if (host.includes(GAME_DOMAIN)) {
    // Redirect root to promo lobby
    if (pathname === "/") {
      return NextResponse.rewrite(new URL("/promo", req.url));
    }

    // Prevent game domain from accessing admin panels or internal app routes
    const isAllowedPath =
      pathname.startsWith("/promo") ||
      pathname.startsWith("/api/promo") ||
      pathname.startsWith("/_next") ||
      pathname.startsWith("/favicon.ico") ||
      pathname.includes(".");

    if (!isAllowedPath) {
      return NextResponse.rewrite(new URL("/promo", req.url));
    }
  }

  // 2. ADMIN DOMAIN LOGIC
  if (host.includes(ADMIN_DOMAIN)) {
    // If the path already starts with /dashadmin-x, redirect to clean URL
    if (pathname.startsWith("/dashadmin-x")) {
      const cleanPath = pathname.replace("/dashadmin-x", "") || "/";
      return NextResponse.redirect(new URL(cleanPath, req.url), 307);
    }

    // Don't rewrite API, static files, auth routes, or internal Next.js routes
    if (
      pathname.startsWith("/api") ||
      pathname.startsWith("/_next") ||
      pathname.startsWith("/login") ||
      pathname.startsWith("/legal-consent") ||
      pathname.startsWith("/favicon.ico") ||
      pathname.includes(".")
    ) {
      return NextResponse.next();
    }

    // Rewrite everything else to /dashadmin-x
    const url = req.nextUrl.clone();
    url.pathname = `/dashadmin-x${pathname}`;
    return NextResponse.rewrite(url);
  }

  // Redirect from main domain /dashadmin-x to subdomain
  if (!host.includes(ADMIN_DOMAIN) && pathname.startsWith("/dashadmin-x")) {
    const url = new URL(req.url);
    url.hostname = ADMIN_DOMAIN;
    url.pathname = pathname.replace("/dashadmin-x", "") || "/";
    return NextResponse.redirect(url, 307);
  }

  return NextResponse.next();
}

// Ensure middleware only runs on relevant paths
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
