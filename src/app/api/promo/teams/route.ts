import { NextResponse } from "next/server";
import { getClient } from "@/db";
import { cookies } from "next/headers";

function generateInviteCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export async function GET(request: Request) {
  const client = await getClient();
  try {
    const cookieStore = await cookies();
    const playerId = cookieStore.get("promo_player_id")?.value;
    const activeClubId = cookieStore.get("promo_active_club_id")?.value;

    if (!playerId || !activeClubId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1. Fetch all teams the player belongs to with member details aggregated in JSON
    const teamRes = await client.query(
      `SELECT t.id, t.name, t.captain_id, t.invite_code, t.logo_url, t.created_at,
              (
                SELECT json_agg(json_build_object(
                  'id', p.id,
                  'fullName', p.full_name,
                  'phoneNumber', p.phone_number,
                  'joinedAt', tm2.joined_at,
                  'elo', COALESCE(elo.elo, 1000),
                  'matchesPlayed', COALESCE(elo.matches_played, 0),
                  'isCalibrated', COALESCE(elo.is_calibrated, false)
                ) ORDER BY tm2.joined_at ASC)
                FROM team_members tm2
                JOIN promo_players p ON tm2.player_id = p.id
                LEFT JOIN discipline_elo elo ON p.id = elo.player_id AND elo.discipline = 'cs2'
                WHERE tm2.team_id = t.id
              ) as members,
              (
                SELECT COALESCE(AVG(COALESCE(elo.elo, 1000)), 1000)::int
                FROM team_members tm2
                LEFT JOIN discipline_elo elo ON tm2.player_id = elo.player_id AND elo.discipline = 'cs2'
                WHERE tm2.team_id = t.id
              ) as average_elo,
              (
                SELECT COUNT(*)::int
                FROM tournament_matches m
                JOIN tournament_competitors c ON (m.competitor_a_id = c.id OR m.competitor_b_id = c.id)
                WHERE c.team_id = t.id AND LOWER(m.status) = 'finished'
              ) as total_matches,
              (
                SELECT COUNT(*)::int
                FROM tournament_matches m
                JOIN tournament_competitors c ON (m.competitor_a_id = c.id OR m.competitor_b_id = c.id)
                WHERE c.team_id = t.id AND LOWER(m.status) = 'finished' AND m.winner_competitor_id = c.id
              ) as matches_won,
              (
                SELECT COUNT(DISTINCT tournament_id)::int
                FROM tournament_competitors
                WHERE team_id = t.id
              ) as total_tournaments,
              (
                SELECT COALESCE(SUM(p.amount), 0)::float
                FROM tournament_payouts p
                JOIN tournament_competitors c ON p.competitor_id = c.id
                WHERE c.team_id = t.id
              ) as total_prizes,
              (
                SELECT json_agg(json_build_object(
                  'id', t_ct.id,
                  'name', t_ct.name,
                  'discipline', t_ct.discipline,
                  'type', t_ct.type,
                  'status', t_ct.status,
                  'registeredAt', e.created_at,
                  'paymentStatus', e.status,
                  'prizeWon', (
                    SELECT COALESCE(SUM(p_pay.amount), 0)::float
                    FROM tournament_payouts p_pay
                    WHERE p_pay.competitor_id = c_comp.id
                  )
                ) ORDER BY t_ct.starts_at DESC)
                FROM tournament_competitors c_comp
                JOIN tournament_entries e ON c_comp.id = e.competitor_id
                JOIN club_tournaments t_ct ON c_comp.tournament_id = t_ct.id
                WHERE c_comp.team_id = t.id
              ) as tournaments_history
       FROM teams t
       JOIN team_members tm ON t.id = tm.team_id
       WHERE tm.player_id = $1 AND t.club_id = $2
       ORDER BY t.created_at DESC`,
      [playerId, activeClubId]
    );

    return NextResponse.json({
      teams: teamRes.rows.map(row => ({
        id: row.id,
        name: row.name,
        captainId: row.captain_id,
        inviteCode: row.invite_code,
        logoUrl: row.logo_url,
        createdAt: row.created_at,
        members: (row.members || []).map((m: any) => ({
          id: m.id,
          fullName: m.fullName,
          phoneNumber: m.phoneNumber,
          joinedAt: m.joinedAt,
          elo: parseInt(m.elo),
          matchesPlayed: m.matchesPlayed,
          isCalibrated: m.isCalibrated
        })),
        stats: {
          averageElo: parseInt(row.average_elo || 1000),
          totalMatches: parseInt(row.total_matches || 0),
          matchesWon: parseInt(row.matches_won || 0),
          totalTournaments: parseInt(row.total_tournaments || 0),
          totalPrizes: parseFloat(row.total_prizes || 0),
        },
        tournamentsHistory: (row.tournaments_history || []).map((th: any) => ({
          id: th.id,
          name: th.name,
          discipline: th.discipline,
          type: th.type,
          status: th.status,
          registeredAt: th.registeredAt,
          paymentStatus: th.paymentStatus,
          prizeWon: parseFloat(th.prizeWon || 0)
        }))
      }))
    });
  } catch (error) {
    console.error("Teams GET Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  } finally {
    client.release();
  }
}

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
    const { action, teamId } = body;

    // ACTION: CREATE
    if (action === "create") {
      const { name } = body;
      if (!name || name.trim().length < 2) {
        return NextResponse.json({ error: "Неверное название команды" }, { status: 400 });
      }

      // Check if team name already exists in this club
      const nameCheck = await client.query(
        `SELECT id FROM teams WHERE name = $1 AND club_id = $2`,
        [name.trim(), activeClubId]
      );
      if (nameCheck.rows.length > 0) {
        return NextResponse.json({ error: "Команда с таким названием уже существует в этом клубе" }, { status: 400 });
      }

      // Generate unique invite code
      let inviteCode = generateInviteCode();
      const codeCheck = await client.query("SELECT id FROM teams WHERE invite_code = $1", [inviteCode]);
      if (codeCheck.rows.length > 0) {
        inviteCode = generateInviteCode();
      }

      await client.query("BEGIN");

      const insertTeamRes = await client.query(
        `INSERT INTO teams (name, captain_id, club_id, invite_code)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [name.trim(), playerId, activeClubId, inviteCode]
      );
      const newTeamId = insertTeamRes.rows[0].id;

      await client.query(
        `INSERT INTO team_members (team_id, player_id)
         VALUES ($1, $2)`,
        [newTeamId, playerId]
      );

      await client.query("COMMIT");

      return NextResponse.json({ success: true, teamId: newTeamId });
    }

    // ACTION: EDIT
    if (action === "edit") {
      const { teamId, name, logoUrl } = body;
      if (!teamId) {
        return NextResponse.json({ error: "ID команды обязателен" }, { status: 400 });
      }

      const checkCapRes = await client.query(
        `SELECT name, captain_id, logo_url FROM teams WHERE id = $1 AND club_id = $2`,
        [teamId, activeClubId]
      );
      if (checkCapRes.rows.length === 0) {
        return NextResponse.json({ error: "Команда не найдена" }, { status: 404 });
      }
      if (checkCapRes.rows[0].captain_id !== playerId) {
        return NextResponse.json({ error: "Только капитан может редактировать команду" }, { status: 403 });
      }

      const currentName = checkCapRes.rows[0].name;
      const currentLogoUrl = checkCapRes.rows[0].logo_url;
      let finalName = currentName;
      let finalLogoUrl = currentLogoUrl;

      if (name !== undefined) {
        if (!name || name.trim().length < 2) {
          return NextResponse.json({ error: "Название команды должно содержать не менее 2 символов" }, { status: 400 });
        }
        if (name.trim() !== currentName) {
          const nameCheck = await client.query(
            `SELECT id FROM teams WHERE name = $1 AND club_id = $2 AND id <> $3`,
            [name.trim(), activeClubId, teamId]
          );
          if (nameCheck.rows.length > 0) {
            return NextResponse.json({ error: "Команда с таким названием уже существует в этом клубе" }, { status: 400 });
          }
          finalName = name.trim();
        }
      }

      if (logoUrl !== undefined) {
        finalLogoUrl = logoUrl;
      }

      await client.query(
        `UPDATE teams SET name = $1, logo_url = $2 WHERE id = $3`,
        [finalName, finalLogoUrl, teamId]
      );

      return NextResponse.json({ success: true });
    }

    // Resolve target team details for other actions
    let targetTeamId = teamId;
    if (action === "join") {
      const { inviteCode } = body;
      if (!inviteCode) {
        return NextResponse.json({ error: "Код приглашения обязателен" }, { status: 400 });
      }
      const targetTeamRes = await client.query(
        `SELECT id FROM teams WHERE invite_code = $1 AND club_id = $2`,
        [inviteCode.trim().toUpperCase(), activeClubId]
      );
      if (targetTeamRes.rows.length === 0) {
        return NextResponse.json({ error: "Команда с таким кодом приглашения не найдена" }, { status: 404 });
      }
      targetTeamId = targetTeamRes.rows[0].id;
    }

    if (!targetTeamId) {
      return NextResponse.json({ error: "ID команды обязателен" }, { status: 400 });
    }

    // Fetch details of membership/captain status in the target team
    const checkMemberRes = await client.query(
      `SELECT t.captain_id, tm.player_id 
       FROM teams t
       LEFT JOIN team_members tm ON t.id = tm.team_id AND tm.player_id = $1
       WHERE t.id = $2 AND t.club_id = $3`,
      [playerId, targetTeamId, activeClubId]
    );

    if (checkMemberRes.rows.length === 0) {
      return NextResponse.json({ error: "Команда не найдена" }, { status: 404 });
    }

    const isCaptain = checkMemberRes.rows[0].captain_id === playerId;
    const isMember = checkMemberRes.rows[0].player_id !== null;

    // ACTION: JOIN
    if (action === "join") {
      if (isMember) {
        return NextResponse.json({ error: "Вы уже состоите в этой команде" }, { status: 400 });
      }

      // Check current member count (maximum 5 players)
      const countRes = await client.query(
        `SELECT COUNT(*)::int as count FROM team_members WHERE team_id = $1`,
        [targetTeamId]
      );
      if (countRes.rows[0].count >= 5) {
        return NextResponse.json({ error: "Команда уже заполнена (максимум 5 участников)" }, { status: 400 });
      }

      await client.query(
        `INSERT INTO team_members (team_id, player_id)
         VALUES ($1, $2)`,
        [targetTeamId, playerId]
      );

      return NextResponse.json({ success: true, teamId: targetTeamId });
    }

    // Actions requiring captain permissions
    if (action === "kick" || action === "disband") {
      if (!isCaptain) {
        return NextResponse.json({ error: "Доступ запрещен: вы не являетесь капитаном этой команды" }, { status: 403 });
      }

      // ACTION: KICK
      if (action === "kick") {
        const { playerIdToKick } = body;
        if (!playerIdToKick) {
          return NextResponse.json({ error: "ID игрока обязателен" }, { status: 400 });
        }
        if (playerIdToKick === playerId) {
          return NextResponse.json({ error: "Вы не можете исключить сами себя" }, { status: 400 });
        }

        await client.query(
          `DELETE FROM team_members WHERE team_id = $1 AND player_id = $2`,
          [targetTeamId, playerIdToKick]
        );

        return NextResponse.json({ success: true });
      }

      // ACTION: DISBAND
      if (action === "disband") {
        await client.query(
          `DELETE FROM teams WHERE id = $1`,
          [targetTeamId]
        );
        return NextResponse.json({ success: true });
      }
    }

    // ACTION: LEAVE
    if (action === "leave") {
      if (!isMember) {
        return NextResponse.json({ error: "Вы не состоите в этой команде" }, { status: 400 });
      }
      if (isCaptain) {
        return NextResponse.json({ error: "Капитан не может покинуть команду, только распустить её" }, { status: 400 });
      }

      await client.query(
        `DELETE FROM team_members WHERE team_id = $1 AND player_id = $2`,
        [targetTeamId, playerId]
      );

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Неверное действие" }, { status: 400 });
  } catch (error) {
    console.error("Teams POST Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  } finally {
    client.release();
  }
}
