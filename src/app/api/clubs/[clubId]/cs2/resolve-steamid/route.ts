import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const input = (searchParams.get("input") || "").trim();

  if (!input) {
    return NextResponse.json({ error: "Empty input" }, { status: 400 });
  }

  // 1. Direct SteamID64 (17 digits starting with 7656119)
  const directMatch = input.match(/\b(7656119\d{10})\b/);
  if (directMatch) {
    return NextResponse.json({ steamId: directMatch[1] });
  }

  // 2. Vanity URL: /id/<customURL>
  const vanityMatch = input.match(/steamcommunity\.com\/id\/([a-zA-Z0-9_\-]+)/i) || 
                      (!input.includes("/") && input.length >= 2 ? [null, input] : null);

  if (vanityMatch && vanityMatch[1]) {
    const vanity = vanityMatch[1];
    try {
      const res = await fetch(`https://steamcommunity.com/id/${encodeURIComponent(vanity)}/?xml=1`, {
        headers: { "User-Agent": "DashAdmin-SteamResolver/1.0" },
      });
      if (res.ok) {
        const text = await res.text();
        const idMatch = text.match(/<steamID64>(\d+)<\/steamID64>/);
        const nameMatch = text.match(/<steamID><!\[CDATA\[(.*?)\]\]><\/steamID>/);
        if (idMatch) {
          return NextResponse.json({
            steamId: idMatch[1],
            name: nameMatch ? nameMatch[1] : vanity,
          });
        }
      }
    } catch (e) {
      console.error("[Steam Resolver Error]", e);
    }
  }

  return NextResponse.json({ error: "Не удалось определить SteamID64" }, { status: 404 });
}
