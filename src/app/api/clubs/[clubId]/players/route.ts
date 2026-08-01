import { NextResponse } from "next/server";
import { query } from "@/db";
import { requireClubApiAccess } from "@/lib/club-api-access";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ clubId: string }> },
) {
  try {
    const { clubId } = await params;
    await requireClubApiAccess(clubId);

    const url = new URL(request.url);
    const search = url.searchParams.get("search") || "";

    // Fetch club's inventory settings to check if remote integration is enabled
    const clubSettingsResult = await query(
      `SELECT inventory_settings FROM clubs WHERE id = $1`,
      [clubId]
    );

    const inventorySettings = clubSettingsResult.rows[0]?.inventory_settings || {};
    const isDashLockEnabled = Boolean(inventorySettings.dashlock_integration_enabled);
    const dashlockUrl = inventorySettings.dashlock_url || "http://localhost:47200";

    if (isDashLockEnabled && dashlockUrl) {
      try {
        const baseUrl = dashlockUrl.replace(/\/$/, "");
        const graphqlUrl = `${baseUrl}/graphql`;

        const queryStr = `
          query($search: String) {
            players(search: $search) {
              id
              phone
              fullName
              balance
              bonusBalance
              totalHours
              totalSpent
              updatedAt
              tier
              visitsCount
            }
          }
        `;

        const res = await fetch(graphqlUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query: queryStr,
            variables: { search: search.trim() || null }
          }),
          signal: AbortSignal.timeout(5000),
          next: { revalidate: 0 }
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const body = await res.json();
        if (body.errors && body.errors.length > 0) {
          throw new Error(body.errors[0].message);
        }

        const remotePlayers = body.data?.players || [];

        return NextResponse.json({
          success: true,
          players: remotePlayers.map((p: any) => ({
            id: p.id,
            phone: p.phone,
            full_name: p.fullName || 'Игрок',
            balance: parseFloat(p.balance || 0),
            bonus_balance: parseFloat(p.bonusBalance || 0),
            total_hours: parseFloat(p.totalHours || 0),
            total_spent: parseFloat(p.totalSpent || 0),
            updated_at: p.updatedAt,
            tier: p.tier || '—',
            visits_count: parseInt(p.visitsCount || 0)
          }))
        });
      } catch (remoteError: any) {
        console.error("Remote DashLock GraphQL fetch failed:", remoteError);
        return NextResponse.json({
          success: false,
          error: `Ошибка получения данных от DashLock API: ${remoteError.message || remoteError}`
        }, { status: 502 });
      }
    }

    // Fallback: query local database
    let sqlQuery = `
      SELECT id, phone, full_name, balance, bonus_balance, total_hours, total_spent, updated_at
      FROM club_players
      WHERE club_id = $1
    `;
    const queryParams: any[] = [clubId];

    if (search.trim()) {
      queryParams.push(`%${search.trim()}%`);
      sqlQuery += ` AND (full_name ILIKE $2 OR phone ILIKE $2)`;
    }

    sqlQuery += ` ORDER BY total_spent DESC, updated_at DESC LIMIT 200`;

    const result = await query(sqlQuery, queryParams);

    return NextResponse.json({
        success: true,
        players: result.rows.map(row => ({
            ...row,
            balance: parseFloat(row.balance),
            bonus_balance: parseFloat(row.bonus_balance),
            total_hours: parseFloat(row.total_hours),
            total_spent: parseFloat(row.total_spent)
        }))
    });

  } catch (error: any) {
    const status = error?.status;
    if (status) {
      return NextResponse.json(
        { error: status === 401 ? "Unauthorized" : "Forbidden" },
        { status },
      );
    }
    console.error("Get Club Players Error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}


