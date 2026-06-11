import { NextResponse } from "next/server";
import { getClient } from "@/db";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  const client = await getClient();
  try {
    const cookieStore = await cookies();
    const playerId = cookieStore.get("promo_player_id")?.value;
    const activeClubId = cookieStore.get("promo_active_club_id")?.value;

    if (!playerId || !activeClubId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { tournamentId, teamId, consent } = body;

    if (!tournamentId) {
      return NextResponse.json({ error: "ID турнира обязателен" }, { status: 400 });
    }

    if (!consent) {
      return NextResponse.json({ error: "Вы должны согласиться с правилами турнира" }, { status: 400 });
    }

    await client.query("BEGIN");

    // 1. Fetch tournament details
    const tournamentRes = await client.query(
      `SELECT id, status, type, entry_fee, club_id, config FROM club_tournaments WHERE id = $1`,
      [tournamentId]
    );

    if (tournamentRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Турнир не найден" }, { status: 404 });
    }

    const tournament = tournamentRes.rows[0];

    // Enforce max participants slot limit
    const tConfig = tournament.config || {};
    const maxParticipants = tConfig.maxParticipants ? parseInt(tConfig.maxParticipants) : null;
    let isReserve = false;
    if (maxParticipants) {
      const countRes = await client.query(
        `SELECT COUNT(*)::int as count 
         FROM tournament_competitors c
         JOIN tournament_entries e ON c.id = e.competitor_id
         WHERE c.tournament_id = $1 AND e.status != 'RESERVE'`,
        [tournamentId]
      );
      if (countRes.rows[0].count >= maxParticipants) {
        isReserve = true;
      }
    }
    if (tournament.status !== "DRAFT" && tournament.status !== "REGISTRATION") {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Регистрация на данный турнир закрыта" }, { status: 400 });
    }

    let displayName = "";
    let pTeamId: string | null = null;
    let pPlayerId: string | null = null;

    // Check if player is already registered in this tournament (either solo or in any team)
    const checkUserReg = await client.query(
      `SELECT c.id, c.type, c.display_name, e.status as payment_status
       FROM tournament_competitors c
       JOIN tournament_entries e ON c.id = e.competitor_id
       LEFT JOIN team_members tm ON c.team_id = tm.team_id
       WHERE c.tournament_id = $1 
         AND (c.player_id = $2 OR tm.player_id = $2)`,
      [tournamentId, playerId]
    );

    if (checkUserReg.rows.length > 0) {
      await client.query("ROLLBACK");
      const existing = checkUserReg.rows[0];
      let message = "";
      if (existing.payment_status === "RESERVE") {
        message = existing.type === "TEAM"
          ? `Ваша команда "${existing.display_name}" уже находится в списке резерва`
          : `Вы уже находитесь в списке резерва в качестве Свободного Агента`;
      } else {
        message = existing.type === "TEAM" 
          ? `Вы уже зарегистрированы на этот турнир в составе команды "${existing.display_name}"`
          : `Вы уже зарегистрированы на этот турнир в качестве Свободного Агента`;
      }
      return NextResponse.json({ error: message }, { status: 400 });
    }

    // 2. Handle team registration (only if teamId is provided and tournament supports teams)
    const isTeam = (tournament.type === "team" || tournament.type === "2vs2" || tournament.type === "5vs5") && teamId !== null;
    if (isTeam) {
      // Check if captain
      const teamRes = await client.query(
        `SELECT name, captain_id FROM teams WHERE id = $1 AND club_id = $2`,
        [teamId, activeClubId]
      );
      if (teamRes.rows.length === 0) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "Команда не найдена" }, { status: 404 });
      }
      const team = teamRes.rows[0];
      if (team.captain_id !== playerId) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "Регистрацию может произвести только капитан команды" }, { status: 403 });
      }

      // Check member count (must be exactly 5 members for CS2, or 2 for 2vs2)
      const countRes = await client.query(
        `SELECT COUNT(*)::int as count FROM team_members WHERE team_id = $1`,
        [teamId]
      );
      const requiredTeamSize = tournament.type === "2vs2" ? 2 : 5;
      if (countRes.rows[0].count < requiredTeamSize) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: `В команде должно быть ровно ${requiredTeamSize} игроков` }, { status: 400 });
      }

      // Check if any member of this team is already registered for this tournament (either solo or in another team)
      const existingMembersCheck = await client.query(
        `SELECT p.full_name
         FROM team_members tm
         JOIN promo_players p ON tm.player_id = p.id
         WHERE tm.team_id = $1
           AND EXISTS (
             SELECT 1 
             FROM tournament_competitors c
             LEFT JOIN team_members tm2 ON c.team_id = tm2.team_id
             WHERE c.tournament_id = $2
               AND (c.player_id = tm.player_id OR tm2.player_id = tm.player_id)
           )`,
        [teamId, tournamentId]
      );
      if (existingMembersCheck.rows.length > 0) {
        await client.query("ROLLBACK");
        const names = existingMembersCheck.rows.map(r => r.full_name).join(", ");
        return NextResponse.json(
          { error: `Регистрация невозможна: игрок(и) уже зарегистрирован(ы) на этот турнир: ${names}` },
          { status: 400 }
        );
      }

      displayName = team.name;
      pTeamId = teamId;
    } else {
      // 3. Handle solo / mix registration (registers the player individually as Free Agent)
      const playerRes = await client.query(
        `SELECT full_name FROM promo_players WHERE id = $1`,
        [playerId]
      );
      displayName = playerRes.rows[0]?.full_name || "Игрок";
      pPlayerId = playerId;
    }

    // 4. Create Competitor
    const competitorRes = await client.query(
      `INSERT INTO tournament_competitors (tournament_id, type, display_name, team_id, player_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [
        tournamentId,
        isTeam ? "TEAM" : "SOLO",
        displayName,
        pTeamId,
        pPlayerId,
      ]
    );
    const competitorId = competitorRes.rows[0].id;

    // 5. Create Entry (PAID if fee = 0, otherwise PENDING_PAYMENT, or RESERVE if reserve)
    const initialStatus = isReserve
      ? "RESERVE"
      : parseFloat(tournament.entry_fee) === 0
      ? "PAID"
      : "PENDING_PAYMENT";
    await client.query(
      `INSERT INTO tournament_entries (tournament_id, competitor_id, status)
       VALUES ($1, $2, $3)`,
      [tournamentId, competitorId, initialStatus]
    );

    // Update tournament status to REGISTRATION if it was in DRAFT
    if (tournament.status === "DRAFT") {
      await client.query(
        `UPDATE club_tournaments SET status = 'REGISTRATION' WHERE id = $1`,
        [tournamentId]
      );
    }

    await client.query("COMMIT");

    return NextResponse.json({
      success: true,
      competitorId,
      paymentStatus: initialStatus,
    });
  } catch (error) {
    console.error("Tournament Register POST Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  } finally {
    client.release();
  }
}
