import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const host = req.headers.get("host") || "";
  const { pathname } = req.nextUrl;

  // 0. WWW TO NON-WWW REDIRECT
  if (host.startsWith("www.")) {
    const newHost = host.replace(/^www\./, "");
    const url = new URL(req.nextUrl.href);
    url.host = newHost;
    return NextResponse.redirect(url, 301);
  }

  // --- CONFIGURATION ---
  // Change these to your actual production domains
  const ADMIN_DOMAIN =
    process.env.NEXT_PUBLIC_ADMIN_DOMAIN || "admin.mydashadmin.ru";
  const GAME_DOMAIN =
    process.env.NEXT_PUBLIC_GAME_DOMAIN || "game.mydashadmin.ru";

  // 1. GAME DOMAIN LOGIC
  if (host.includes(GAME_DOMAIN)) {
    // Redirect root to promo lobby
    if (pathname === "/") {
      return NextResponse.rewrite(new URL("/promo", req.url));
    }

    // Prevent game domain from accessing admin panels or internal app routes
    // Allow only /promo, /api/promo, and public assets
    const isAllowedPath =
      pathname.startsWith("/promo") ||
      pathname.startsWith("/api/promo") ||
      pathname.startsWith("/_next") ||
      pathname.startsWith("/favicon.ico") ||
      pathname.includes("."); // images, scripts, etc.

    if (!isAllowedPath) {
      // Rewrite unauthorized paths to the promo lobby
      return NextResponse.rewrite(new URL("/promo", req.url));
    }
  }

  // 2. ADMIN DOMAIN LOGIC (Optional: restrict /promo access from main domain)
  if (host.includes(ADMIN_DOMAIN)) {
    // If you want to keep admin domain clean, you can redirect /promo to the game domain
    // but for now we'll allow it for easier testing
  }

  return NextResponse.next();
}

// Ensure middleware only runs on relevant paths
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (internal api routes, we handle /api/promo separately above if needed)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
