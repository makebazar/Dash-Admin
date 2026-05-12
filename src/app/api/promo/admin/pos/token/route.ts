import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { v4 as uuidv4 } from "uuid";

// Temporary in-memory store for pairing tokens.
// In production, this should be Redis or a database table with TTL.
const pairingTokens = new Map<string, { clubId: string; userId: string; createdAt: number }>();

// Cleanup old tokens every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [token, data] of pairingTokens.entries()) {
        if (now - data.createdAt > 5 * 60 * 1000) {
            pairingTokens.delete(token);
        }
    }
}, 5 * 60 * 1000);

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const clubId = searchParams.get("clubId");
    const userId = (await cookies()).get("session_user_id")?.value;

    if (!userId || !clubId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = uuidv4().slice(0, 8).toUpperCase();
    pairingTokens.set(token, { clubId, userId, createdAt: Date.now() });

    return NextResponse.json({ token });
}

export function getPairingData(token: string) {
    return pairingTokens.get(token);
}

export function removePairingToken(token: string) {
    pairingTokens.delete(token);
}
