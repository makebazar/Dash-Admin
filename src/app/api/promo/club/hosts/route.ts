import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSmartShellClientForClub } from "@/lib/smartshell/shift-sync";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const activeClubIdStr = cookieStore.get("promo_active_club_id")?.value;

    if (!activeClubIdStr) {
      return NextResponse.json({ error: "No active club selected" }, { status: 400 });
    }

    const clubId = parseInt(activeClubIdStr, 10);
    if (isNaN(clubId)) {
      return NextResponse.json({ error: "Invalid club ID" }, { status: 400 });
    }

    const ssClient = await getSmartShellClientForClub(clubId);
    if (!ssClient) {
      return NextResponse.json({ hosts: [], zones: [] });
    }

    const [hostsData, hostGroups] = await Promise.all([
      ssClient.getClubHostsWithSessions(),
      ssClient.getHostGroups(),
    ]);

    const formattedHosts = hostsData.map((h) => {
      const activeSession = h.client_sessions?.find((s) => !s.finished_at);
      return {
        id: h.id,
        alias: h.alias || `ПК #${h.id}`,
        online: h.online ?? true,
        is_occupied: !!activeSession,
        zone_id: h.group?.id ? String(h.group.id) : null,
        zone_name: h.group?.title || "Общий зал",
        active_client: activeSession?.client
          ? {
              login: activeSession.client.login,
              first_name: activeSession.client.first_name,
            }
          : null,
      };
    });

    const formattedZones = hostGroups.map((g) => ({
      id: String(g.id),
      title: g.title,
    }));

    return NextResponse.json({ hosts: formattedHosts, zones: formattedZones });
  } catch (err: any) {
    console.error("[GET /api/promo/club/hosts error]:", err);
    return NextResponse.json({ error: "Failed to fetch club hosts" }, { status: 500 });
  }
}
