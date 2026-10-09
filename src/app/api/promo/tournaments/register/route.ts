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

    // Ensure column promo_team_id exists on tournament_competitors
    await client.query(`
      ALTER TABLE tournament_competitors ADD COLUMN IF NOT EXISTS promo_team_id INTEGER REFERENCES promo_teams(id) ON DELETE SET NULL;
    `);

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

    // Fetch caller player details
    const callerRes = await client.query(
      `SELECT id, full_name, nickname, phone_number FROM promo_players WHERE id = $1`,
      [playerId]
    );
    if (callerRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Игрок не найден" }, { status: 404 });
    }
    const caller = callerRes.rows[0];

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
    let pPromoTeamId: number | null = null;
    let pPlayerId: string | null = null;
    let metaPayload: any = {};

    // Check if player is already registered in this tournament (either solo or in any team)
    const checkUserReg = await client.query(
      `SELECT c.id, c.type, c.display_name, e.status as payment_status
       FROM tournament_competitors c
       JOIN tournament_entries e ON c.id = e.competitor_id
       LEFT JOIN team_members tm ON c.team_id = tm.team_id
       LEFT JOIN promo_team_members ptm ON c.promo_team_id = ptm.team_id
       WHERE c.tournament_id = $1 
         AND (c.player_id = $2 OR tm.player_id = $2 OR ptm.phone = $3)`,
      [tournamentId, playerId, caller.phone_number]
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
    const isTeamTournament = tournament.type === "team" || tournament.type === "2vs2" || tournament.type === "5vs5";
    const isTeam = isTeamTournament && teamId !== null && teamId !== undefined && teamId !== "";

    if (isTeam) {
      // Check promo_teams first
      const isNumericTeamId = !isNaN(Number(teamId));
      let promoTeam: any = null;
      let legacyTeam: any = null;

      if (isNumericTeamId) {
        const ptRes = await client.query(
          `SELECT id, name, tag, logo_url, format_type, captain_phone, club_id 
           FROM promo_teams 
           WHERE id = $1`,
          [Number(teamId)]
        );
        if (ptRes.rows.length > 0) {
          promoTeam = ptRes.rows[0];
        }
      }

      if (!promoTeam) {
        // Try finding by UUID in legacy teams
        const legacyRes = await client.query(
          `SELECT id, name, captain_id, club_id, logo_url FROM teams WHERE id = $1`,
          [teamId]
        );
        if (legacyRes.rows.length > 0) {
          legacyTeam = legacyRes.rows[0];
        }
      }

      if (!promoTeam && !legacyTeam) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "Команда не найдена" }, { status: 404 });
      }

      if (promoTeam) {
        // Captain check for promo_teams
        if (promoTeam.captain_phone !== caller.phone_number) {
          await client.query("ROLLBACK");
          return NextResponse.json({ error: "Регистрацию команды может произвести только её капитан" }, { status: 403 });
        }

        // Fetch team members
        const membersRes = await client.query(
          `SELECT ptm.phone, ptm.role, COALESCE(p.nickname, p.full_name, ptm.phone) as member_name, p.id as player_id
           FROM promo_team_members ptm
           LEFT JOIN promo_players p ON ptm.phone = p.phone_number
           WHERE ptm.team_id = $1`,
          [promoTeam.id]
        );

        const members = membersRes.rows;
        const requiredTeamSize = tournament.type === "2vs2" ? 2 : 5;

        // Verify format compatibility & member count
        if (tournament.type === "5vs5" && promoTeam.format_type === "2vs2") {
          await client.query("ROLLBACK");
          return NextResponse.json({ 
            error: "Для турнира 5x5 требуется команда формата 5vs5 (минимум 5 игроков)." 
          }, { status: 400 });
        }

        if (members.length < requiredTeamSize) {
          await client.query("ROLLBACK");
          return NextResponse.json({ 
            error: `В команде должно быть минимум ${requiredTeamSize} игрок(а/ов) для регистрации на турнир` 
          }, { status: 400 });
        }

        // Check if any member of this team is already registered for this tournament
        const existingMembersCheck = await client.query(
          `SELECT COALESCE(p.nickname, p.full_name, ptm.phone) as name
           FROM promo_team_members ptm
           LEFT JOIN promo_players p ON ptm.phone = p.phone_number
           WHERE ptm.team_id = $1
             AND EXISTS (
               SELECT 1 
               FROM tournament_competitors c
               LEFT JOIN team_members tm2 ON c.team_id = tm2.team_id
               LEFT JOIN promo_team_members ptm2 ON c.promo_team_id = ptm2.team_id
               LEFT JOIN promo_players pp2 ON ptm2.phone = pp2.phone_number
               WHERE c.tournament_id = $2
                 AND (
                   (p.id IS NOT NULL AND c.player_id = p.id) OR 
                   (p.id IS NOT NULL AND tm2.player_id = p.id) OR 
                   ptm2.phone = ptm.phone
                 )
             )`,
          [promoTeam.id, tournamentId]
        );

        if (existingMembersCheck.rows.length > 0) {
          await client.query("ROLLBACK");
          const names = existingMembersCheck.rows.map((r: any) => r.name).join(", ");
          return NextResponse.json(
            { error: `Регистрация невозможна: игрок(и) уже зарегистрирован(ы) на этот турнир: ${names}` },
            { status: 400 }
          );
        }

        displayName = promoTeam.name;
        pPromoTeamId = promoTeam.id;
        metaPayload = {
          tag: promoTeam.tag,
          logoUrl: promoTeam.logo_url,
          formatType: promoTeam.format_type || "5vs5",
        };
      } else if (legacyTeam) {
        // Captain check for legacy teams
        if (legacyTeam.captain_id !== playerId) {
          await client.query("ROLLBACK");
          return NextResponse.json({ error: "Регистрацию может произвести только капитан команды" }, { status: 403 });
        }

        const countRes = await client.query(
          `SELECT COUNT(*)::int as count FROM team_members WHERE team_id = $1`,
          [legacyTeam.id]
        );
        const requiredTeamSize = tournament.type === "2vs2" ? 2 : 5;
        if (countRes.rows[0].count < requiredTeamSize) {
          await client.query("ROLLBACK");
          return NextResponse.json({ error: `В команде должно быть минимум ${requiredTeamSize} игроков` }, { status: 400 });
        }

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
          [legacyTeam.id, tournamentId]
        );
        if (existingMembersCheck.rows.length > 0) {
          await client.query("ROLLBACK");
          const names = existingMembersCheck.rows.map((r: any) => r.full_name).join(", ");
          return NextResponse.json(
            { error: `Регистрация невозможна: игрок(и) уже зарегистрирован(ы) на этот турнир: ${names}` },
            { status: 400 }
          );
        }

        displayName = legacyTeam.name;
        pTeamId = legacyTeam.id;
        metaPayload = {
          logoUrl: legacyTeam.logo_url,
        };
      }
    } else {
      // 3. Handle solo / mix registration (registers the player individually as Free Agent)
      displayName = caller.nickname || caller.full_name || "Игрок";
      pPlayerId = playerId;
    }

    // 4. Create Competitor
    const competitorRes = await client.query(
      `INSERT INTO tournament_competitors (tournament_id, type, display_name, team_id, promo_team_id, player_id, meta)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        tournamentId,
        isTeam ? "TEAM" : "SOLO",
        displayName,
        pTeamId,
        pPromoTeamId,
        pPlayerId,
        JSON.stringify(metaPayload),
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

    // Notify connected clients via SSE
    await client.query(`SELECT pg_notify('tournament_updates', $1)`, [String(tournamentId)]).catch(() => {});

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
