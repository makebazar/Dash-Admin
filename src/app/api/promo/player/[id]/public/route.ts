import { NextResponse } from "next/server";
import { getClient } from "@/db";
import { cookies } from "next/headers";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  const targetPlayerId = resolvedParams.id;
  if (!targetPlayerId) {
    return NextResponse.json({ error: "Player ID is required" }, { status: 400 });
  }

  const client = await getClient();
  try {
    const cookieStore = await cookies();
    const currentPlayerId = cookieStore.get("promo_player_id")?.value;
    const activeClubId = cookieStore.get("promo_active_club_id")?.value;

    // Ensure columns exist in promo_players
    await client.query(`
      ALTER TABLE promo_players ADD COLUMN IF NOT EXISTS nickname VARCHAR(100);
      ALTER TABLE promo_players ADD COLUMN IF NOT EXISTS avatar_url TEXT;
      ALTER TABLE promo_players ADD COLUMN IF NOT EXISTS lft_status VARCHAR(30) DEFAULT 'none';
      ALTER TABLE promo_players ADD COLUMN IF NOT EXISTS faceit_elo INTEGER;
      ALTER TABLE promo_players ADD COLUMN IF NOT EXISTS faceit_lvl INTEGER;
      ALTER TABLE promo_players ADD COLUMN IF NOT EXISTS faceit_kd NUMERIC(5,2);
      ALTER TABLE promo_players ADD COLUMN IF NOT EXISTS faceit_winrate NUMERIC(5,2);
      ALTER TABLE promo_players ADD COLUMN IF NOT EXISTS faceit_matches INTEGER;
      ALTER TABLE promo_players ADD COLUMN IF NOT EXISTS faceit_avatar TEXT;
    `);

    // 1. Fetch target player base info
    const playerRes = await client.query(
      `SELECT p.id, p.full_name, p.nickname, p.steam_link, p.steam_id, p.faceit_link, p.phone_number, p.created_at,
              p.avatar_url, p.lft_status, p.faceit_lvl, p.faceit_elo, p.faceit_kd, p.faceit_winrate, p.faceit_matches, p.faceit_avatar,
              COALESCE(b.total_xp, 0) as total_xp,
              c.name as club_name, c.id as club_id
       FROM promo_players p
       LEFT JOIN promo_player_balances b ON p.id = b.player_id
       LEFT JOIN clubs c ON b.club_id = c.id
       WHERE p.id::text = $1 OR p.phone_number = $1
       ORDER BY b.total_xp DESC
       LIMIT 1`,
      [targetPlayerId]
    );

    if (playerRes.rowCount === 0) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 });
    }

    const row = playerRes.rows[0];
    const playerPhone = row.phone_number;

    // 2. Fetch player teams
    let teams: any[] = [];
    if (playerPhone) {
      const teamsRes = await client.query(
        `SELECT t.id, t.name, t.captain_phone, t.created_at,
                tm.role as member_role,
                (SELECT COUNT(*)::int FROM promo_team_members WHERE team_id = t.id) as members_count
         FROM promo_teams t
         JOIN promo_team_members tm ON t.id = tm.team_id
         WHERE tm.phone = $1
         ORDER BY t.created_at DESC`,
        [playerPhone]
      );
      teams = teamsRes.rows.map((t: any) => ({
        id: t.id,
        name: t.name,
        isCaptain: t.captain_phone === playerPhone,
        role: t.member_role || (t.captain_phone === playerPhone ? "captain" : "player"),
        membersCount: t.members_count,
        createdAt: t.created_at,
      }));
    }

    // 3. Fetch Frag Match stats if available
    let fragStats = {
      matchesCount: 0,
      wins: 0,
      kills: 0,
      deaths: 0,
      headshots: 0,
      kdRatio: 0,
      cs2Rating: row.faceit_elo || 1000,
    };

    try {
      const fragRes = await client.query(
        `SELECT COUNT(*)::int as matches_count,
                COALESCE(SUM(score), 0)::int as total_score,
                COALESCE(SUM(kills), 0)::int as total_kills,
                COALESCE(SUM(deaths), 0)::int as total_deaths,
                COALESCE(SUM(headshots), 0)::int as total_headshots
         FROM promo_frag_matches
         WHERE player_id = $1`,
        [targetPlayerId]
      );

      if (fragRes.rowCount && fragRes.rows[0] && fragRes.rows[0].matches_count > 0) {
        const f = fragRes.rows[0];
        const deaths = f.total_deaths > 0 ? f.total_deaths : 1;
        fragStats = {
          matchesCount: f.matches_count || 0,
          wins: 0,
          kills: f.total_kills || 0,
          deaths: f.total_deaths || 0,
          headshots: f.total_headshots || 0,
          kdRatio: Number((f.total_kills / deaths).toFixed(2)),
          cs2Rating: row.faceit_elo || (1000 + (f.total_kills * 15) - (f.total_deaths * 10)),
        };
      }
    } catch (e) {
      console.warn("[Public Player API] Frag stats query skipped/empty:", e);
    }

    // 4. Fetch recent tournaments / participation
    let recentTournaments: any[] = [];
    try {
      const tourneyRes = await client.query(
        `SELECT DISTINCT t.id, t.title, t.status, t.created_at
         FROM promo_tournaments t
         JOIN promo_tournament_participants tp ON t.id = tp.tournament_id
         JOIN promo_team_members tm ON tp.team_id = tm.team_id
         WHERE tm.phone = $1
         ORDER BY t.created_at DESC
         LIMIT 5`,
        [playerPhone]
      );
      recentTournaments = tourneyRes.rows;
    } catch (e) {
      console.warn("[Public Player API] Tournament query skipped/empty:", e);
    }

    // 5. Viewer captained teams (so viewer can invite player to their team)
    let viewerCaptainedTeams: any[] = [];
    if (currentPlayerId && currentPlayerId !== targetPlayerId) {
      try {
        const viewerRes = await client.query(
          `SELECT phone_number FROM promo_players WHERE id = $1`,
          [currentPlayerId]
        );
        if (viewerRes.rowCount && viewerRes.rows[0]?.phone_number) {
          const vPhone = viewerRes.rows[0].phone_number;
          const capTeamsRes = await client.query(
            `SELECT t.id, t.name,
                    (SELECT COUNT(*)::int FROM promo_team_members WHERE team_id = t.id) as members_count,
                    EXISTS(SELECT 1 FROM promo_team_members WHERE team_id = t.id AND phone = $2) as already_in_team,
                    EXISTS(SELECT 1 FROM promo_team_invitations WHERE team_id = t.id AND player_id = $3 AND status = 'PENDING') as has_pending_invite
             FROM promo_teams t
             WHERE t.captain_phone = $1`,
            [vPhone, playerPhone, targetPlayerId]
          );
          viewerCaptainedTeams = capTeamsRes.rows.map((t: any) => ({
            id: t.id,
            name: t.name,
            membersCount: t.members_count,
            alreadyInTeam: t.already_in_team,
            hasPendingInvite: t.has_pending_invite,
            canInvite: t.members_count < 7 && !t.already_in_team && !t.has_pending_invite,
          }));
        }
      } catch (e) {
        console.warn("[Public Player API] Viewer teams check error:", e);
      }
    }

    // Extract Faceit username from link if present
    let faceitNickname = null;
    if (row.faceit_link) {
      const match = row.faceit_link.match(/\/players\/([^\/\?]+)/);
      if (match) {
        faceitNickname = match[1];
      }
    }

    // Level calculation based on XP
    const totalXp = Number(row.total_xp || 0);
    const calculatedLevel = Math.max(1, Math.floor(Math.sqrt(totalXp / 100)) + 1);

    return NextResponse.json({
      success: true,
      isSelf: currentPlayerId === targetPlayerId,
      player: {
        id: row.id,
        fullName: row.full_name || "Неизвестный игрок",
        nickname: row.nickname || null,
        avatarUrl: row.avatar_url || row.faceit_avatar || null,
        lftStatus: row.lft_status || (teams.length > 0 ? "in_team" : "none"),
        level: calculatedLevel,
        totalXp: totalXp,
        clubName: row.club_name || null,
        clubId: row.club_id || null,
        steamLink: row.steam_link || null,
        steamId: row.steam_id || null,
        faceitLink: row.faceit_link || null,
        faceitNickname: faceitNickname,
        faceitLvl: row.faceit_lvl || null,
        faceitElo: row.faceit_elo || null,
        faceitKd: row.faceit_kd ? parseFloat(row.faceit_kd) : null,
        faceitWinrate: row.faceit_winrate ? parseFloat(row.faceit_winrate) : null,
        faceitMatches: row.faceit_matches || null,
        createdAt: row.created_at,
      },
      stats: fragStats,
      teams,
      recentTournaments,
      viewerCaptainedTeams,
    });
  } catch (error) {
    console.error("Public Player Profile GET Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  } finally {
    client.release();
  }
}
