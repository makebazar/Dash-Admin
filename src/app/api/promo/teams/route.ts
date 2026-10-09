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

    // Ensure all tables and columns exist
    await client.query(`
      ALTER TABLE promo_teams ADD COLUMN IF NOT EXISTS tag VARCHAR(10);
      ALTER TABLE promo_teams ADD COLUMN IF NOT EXISTS logo_url TEXT;
      ALTER TABLE promo_teams ADD COLUMN IF NOT EXISTS format_type VARCHAR(20) DEFAULT '5vs5';
      ALTER TABLE promo_players ADD COLUMN IF NOT EXISTS nickname VARCHAR(100);
      ALTER TABLE promo_players ADD COLUMN IF NOT EXISTS lft_status VARCHAR(30) DEFAULT 'none';
      ALTER TABLE promo_players ADD COLUMN IF NOT EXISTS faceit_elo INTEGER;
      ALTER TABLE promo_players ADD COLUMN IF NOT EXISTS faceit_lvl INTEGER;
      ALTER TABLE promo_players ADD COLUMN IF NOT EXISTS avatar_url TEXT;
      ALTER TABLE promo_players ADD COLUMN IF NOT EXISTS faceit_avatar TEXT;
      ALTER TABLE promo_team_members ADD COLUMN IF NOT EXISTS role VARCHAR(30) DEFAULT 'player';

      CREATE TABLE IF NOT EXISTS promo_team_invitations (
        id SERIAL PRIMARY KEY,
        team_id INTEGER NOT NULL REFERENCES promo_teams(id) ON DELETE CASCADE,
        player_id UUID NOT NULL REFERENCES promo_players(id) ON DELETE CASCADE,
        invited_by_phone VARCHAR(30) NOT NULL,
        type VARCHAR(20) DEFAULT 'INVITE',
        status VARCHAR(20) DEFAULT 'PENDING',
        role VARCHAR(20) DEFAULT 'player',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_promo_team_inv_player ON promo_team_invitations(player_id, status);
      CREATE INDEX IF NOT EXISTS idx_promo_team_inv_team ON promo_team_invitations(team_id, status);

      -- Normalize any captain roles so only the true team captain has role = 'captain'
      UPDATE promo_team_members tm
      SET role = 'player'
      FROM promo_teams t
      WHERE tm.team_id = t.id AND tm.phone != t.captain_phone AND tm.role = 'captain';

      UPDATE promo_team_members tm
      SET role = 'captain'
      FROM promo_teams t
      WHERE tm.team_id = t.id AND tm.phone = t.captain_phone;

      -- Normalize LFT status: if player is already in a team, they are no longer LFT
      UPDATE promo_players p
      SET lft_status = 'in_team'
      FROM promo_team_members tm
      JOIN promo_teams t ON tm.team_id = t.id
      WHERE p.phone_number = tm.phone AND p.lft_status = 'lft';
    `);

    const playerRes = await client.query(
      `SELECT phone_number FROM promo_players WHERE id = $1`,
      [playerId]
    );
    if (playerRes.rowCount === 0) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 });
    }
    const phone = playerRes.rows[0].phone_number;

    // 1. Fetch player teams with full member stats and format_type
    const teamRes = await client.query(
      `SELECT t.id, t.name, t.tag, t.logo_url, COALESCE(t.format_type, '5vs5') as format_type, t.captain_phone, t.join_code, t.created_at,
              (
                SELECT json_agg(json_build_object(
                  'playerId', p.id,
                  'phone', tm2.phone,
                  'role', CASE WHEN tm2.phone = t.captain_phone THEN 'captain' ELSE COALESCE(tm2.role, 'player') END,
                  'isCaptain', (tm2.phone = t.captain_phone),
                  'joinedAt', tm2.joined_at,
                  'fullName', COALESCE(p.full_name, tm2.phone),
                  'nickname', p.nickname,
                  'avatarUrl', COALESCE(p.avatar_url, p.faceit_avatar),
                  'faceitLvl', p.faceit_lvl,
                  'faceitElo', p.faceit_elo,
                  'hasSteam', (p.steam_id IS NOT NULL AND p.steam_id != ''),
                  'steamId', p.steam_id
                ) ORDER BY 
                  CASE WHEN tm2.phone = t.captain_phone THEN 1 WHEN tm2.role = 'player' THEN 2 ELSE 3 END,
                  tm2.joined_at ASC)
                FROM promo_team_members tm2
                LEFT JOIN promo_players p ON tm2.phone = p.phone_number
                WHERE tm2.team_id = t.id
              ) as members
       FROM promo_teams t
       JOIN promo_team_members tm ON t.id = tm.team_id
       WHERE tm.phone = $1 AND t.club_id = $2
       ORDER BY t.created_at DESC`,
      [phone, activeClubId]
    );

    const userTeamIds: number[] = [];
    const captainTeamIds: number[] = [];

    // 2. Compute avg ELO and active tournament registrations for each team
    const teams = await Promise.all(
      teamRes.rows.map(async (row: any) => {
        userTeamIds.push(row.id);
        const isUserCaptain = row.captain_phone === phone;
        if (isUserCaptain) {
          captainTeamIds.push(row.id);
        }

        const formatType = row.format_type === "2vs2" ? "2vs2" : "5vs5";
        const maxSlots = formatType === "2vs2" ? 3 : 7;
        const maxMain = formatType === "2vs2" ? 2 : 5;

        const rawMembers = row.members || [];
        const members = rawMembers.map((m: any) => ({
          ...m,
          isCaptain: m.phone === row.captain_phone,
          role: m.phone === row.captain_phone ? 'captain' : (m.role === 'sub' ? 'sub' : 'player'),
        }));
        
        // Calculate average ELO
        const elos = members.map((m: any) => Number(m.faceitElo || 1000));
        const avgElo = elos.length > 0 ? Math.round(elos.reduce((a: number, b: number) => a + b, 0) / elos.length) : 1000;

        // Fetch active registered tournaments
        let activeTournaments: any[] = [];
        try {
          const tRes = await client.query(
            `SELECT tr.id, tr.title, tr.status
             FROM promo_tournaments tr
             JOIN promo_tournament_participants tp ON tr.id = tp.tournament_id
             WHERE tp.team_id = $1 AND tr.status IN ('REGISTRATION', 'ACTIVE', 'DRAFT')
             ORDER BY tr.created_at DESC`,
            [row.id]
          );
          activeTournaments = tRes.rows;
        } catch (e) {
          // Table might not exist in some setups
        }

        return {
          id: row.id,
          name: row.name,
          tag: row.tag || null,
          logoUrl: row.logo_url || null,
          formatType,
          maxSlots,
          maxMain,
          captainPhone: row.captain_phone,
          isCaptain: isUserCaptain,
          joinCode: row.join_code,
          createdAt: row.created_at,
          avgElo,
          activeTournaments,
          members,
        };
      })
    );

    // 3. Fetch incoming invites for current player
    let incomingInvites: any[] = [];
    try {
      const invRes = await client.query(
        `SELECT i.id, i.team_id, i.role, i.created_at,
                t.name as team_name, t.tag as team_tag, t.logo_url as team_logo_url, COALESCE(t.format_type, '5vs5') as format_type,
                (SELECT COUNT(*)::int FROM promo_team_members WHERE team_id = t.id) as members_count,
                (
                  SELECT ROUND(AVG(COALESCE(p2.faceit_elo, 1000)))
                  FROM promo_team_members tm2
                  LEFT JOIN promo_players p2 ON tm2.phone = p2.phone_number
                  WHERE tm2.team_id = t.id
                ) as avg_elo,
                COALESCE(cp.nickname, cp.full_name, t.captain_phone) as captain_name
         FROM promo_team_invitations i
         JOIN promo_teams t ON i.team_id = t.id
         LEFT JOIN promo_players cp ON t.captain_phone = cp.phone_number
         WHERE i.player_id = $1 AND i.status = 'PENDING' AND i.type = 'INVITE'
         ORDER BY i.created_at DESC`,
        [playerId]
      );
      incomingInvites = invRes.rows.map((r: any) => ({
        id: r.id,
        teamId: r.team_id,
        teamName: r.team_name,
        teamTag: r.team_tag,
        teamLogoUrl: r.team_logo_url,
        formatType: r.format_type || "5vs5",
        membersCount: r.members_count || 1,
        maxSlots: r.format_type === "2vs2" ? 3 : 7,
        avgElo: Number(r.avg_elo || 1000),
        captainName: r.captain_name,
        role: r.role || "player",
        createdAt: r.created_at,
      }));
    } catch (e) {
      console.warn("[Teams GET] incomingInvites query error:", e);
    }

    // 4. Fetch outgoing pending invites for teams where current player is captain
    let outgoingInvites: any[] = [];
    if (captainTeamIds.length > 0) {
      try {
        const outRes = await client.query(
          `SELECT i.id, i.team_id, i.player_id, i.role, i.created_at,
                  t.name as team_name, COALESCE(t.format_type, '5vs5') as format_type,
                  p.full_name, p.nickname, p.avatar_url, p.faceit_avatar, p.faceit_elo, p.faceit_lvl,
                  (p.steam_id IS NOT NULL AND p.steam_id != '') as has_steam
           FROM promo_team_invitations i
           JOIN promo_teams t ON i.team_id = t.id
           JOIN promo_players p ON i.player_id = p.id
           WHERE i.team_id = ANY($1::int[]) AND i.status = 'PENDING'
           ORDER BY i.created_at DESC`,
          [captainTeamIds]
        );
        outgoingInvites = outRes.rows.map((r: any) => ({
          id: r.id,
          teamId: r.team_id,
          teamName: r.team_name,
          formatType: r.format_type,
          playerId: r.player_id,
          fullName: r.full_name,
          nickname: r.nickname,
          avatarUrl: r.avatar_url || r.faceit_avatar || null,
          faceitElo: r.faceit_elo || 1000,
          faceitLvl: r.faceit_lvl || null,
          hasSteam: Boolean(r.has_steam),
          role: r.role,
          createdAt: r.created_at,
        }));
      } catch (e) {
        console.warn("[Teams GET] outgoingInvites query error:", e);
      }
    }

    // 5. Fetch LFT (Looking for Team) free agents from the club (only players not currently in a team)
    let lftPlayers: any[] = [];
    try {
      const lftRes = await client.query(
        `SELECT p.id, p.full_name, p.nickname, p.avatar_url, p.faceit_avatar, p.faceit_lvl, p.faceit_elo,
                (p.steam_id IS NOT NULL AND p.steam_id != '') as has_steam,
                EXISTS (
                  SELECT 1 FROM promo_team_invitations i
                  WHERE i.player_id = p.id 
                    AND i.team_id = ANY($2::int[])
                    AND i.status = 'PENDING'
                ) as has_pending_invite
         FROM promo_players p
         WHERE p.lft_status = 'lft' 
           AND p.id != $1
           AND NOT EXISTS (
             SELECT 1 FROM promo_team_members tm
             JOIN promo_teams t ON tm.team_id = t.id
             WHERE tm.phone = p.phone_number AND t.club_id = $3
           )
         ORDER BY p.faceit_elo DESC NULLS LAST
         LIMIT 12`,
        [playerId, captainTeamIds.length > 0 ? captainTeamIds : [-1], parseInt(activeClubId)]
      );
      lftPlayers = lftRes.rows.map((r: any) => ({
        id: r.id,
        fullName: r.full_name,
        nickname: r.nickname,
        avatarUrl: r.avatar_url || r.faceit_avatar || null,
        faceitLvl: r.faceit_lvl || null,
        faceitElo: r.faceit_elo || 1000,
        hasSteam: Boolean(r.has_steam),
        hasPendingInvite: Boolean(r.has_pending_invite),
      }));
    } catch (e) {
      console.warn("[Teams GET] LFT players query error:", e);
    }

    return NextResponse.json({
      teams,
      incomingInvites,
      outgoingInvites,
      lftPlayers,
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

    // Ensure columns and tables exist
    await client.query(`
      ALTER TABLE promo_teams ADD COLUMN IF NOT EXISTS tag VARCHAR(10);
      ALTER TABLE promo_teams ADD COLUMN IF NOT EXISTS logo_url TEXT;
      ALTER TABLE promo_teams ADD COLUMN IF NOT EXISTS format_type VARCHAR(20) DEFAULT '5vs5';
      ALTER TABLE promo_team_members ADD COLUMN IF NOT EXISTS role VARCHAR(30) DEFAULT 'player';

      CREATE TABLE IF NOT EXISTS promo_team_invitations (
        id SERIAL PRIMARY KEY,
        team_id INTEGER NOT NULL REFERENCES promo_teams(id) ON DELETE CASCADE,
        player_id UUID NOT NULL REFERENCES promo_players(id) ON DELETE CASCADE,
        invited_by_phone VARCHAR(30) NOT NULL,
        type VARCHAR(20) DEFAULT 'INVITE',
        status VARCHAR(20) DEFAULT 'PENDING',
        role VARCHAR(20) DEFAULT 'player',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    const playerRes = await client.query(
      `SELECT phone_number FROM promo_players WHERE id = $1`,
      [playerId]
    );
    if (playerRes.rowCount === 0) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 });
    }
    const phone = playerRes.rows[0].phone_number;

    const body = await request.json();
    const { action, teamId } = body;

    // 1. CREATE TEAM (5x5 or 2x2)
    if (action === "create") {
      const { name, tag, logoUrl, formatType } = body;
      if (!name || name.trim().length < 2) {
        return NextResponse.json({ error: "Название команды должно быть не менее 2 символов" }, { status: 400 });
      }

      const nameCheck = await client.query(
        `SELECT id FROM promo_teams WHERE name = $1 AND club_id = $2`,
        [name.trim(), activeClubId]
      );
      if (nameCheck.rows.length > 0) {
        return NextResponse.json({ error: "Команда с таким названием уже существует" }, { status: 400 });
      }

      const inviteCode = generateInviteCode();
      const cleanTag = tag ? tag.trim().toUpperCase().slice(0, 8) : null;
      const cleanFormat = formatType === "2vs2" ? "2vs2" : "5vs5";

      await client.query("BEGIN");
      const insertTeamRes = await client.query(
        `INSERT INTO promo_teams (club_id, name, tag, logo_url, format_type, captain_phone, join_code)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [activeClubId, name.trim(), cleanTag, logoUrl || null, cleanFormat, phone, inviteCode]
      );
      const newTeamId = insertTeamRes.rows[0].id;

      await client.query(
        `INSERT INTO promo_team_members (team_id, phone, role) VALUES ($1, $2, 'captain')`,
        [newTeamId, phone]
      );
      await client.query(
        `UPDATE promo_players SET lft_status = 'in_team' WHERE id = $1`,
        [playerId]
      );
      await client.query("COMMIT");
      return NextResponse.json({ success: true, teamId: newTeamId });
    }

    // 2. EDIT TEAM (Name, Tag, Logo, Format)
    if (action === "edit") {
      if (!teamId) return NextResponse.json({ error: "ID команды обязателен" }, { status: 400 });

      const teamInfo = await client.query(`SELECT captain_phone, format_type FROM promo_teams WHERE id = $1`, [teamId]);
      if (teamInfo.rows.length === 0 || teamInfo.rows[0].captain_phone !== phone) {
        return NextResponse.json({ error: "Только капитан может редактировать команду" }, { status: 403 });
      }

      const { name, tag, logoUrl, formatType } = body;
      const cleanTag = tag ? tag.trim().toUpperCase().slice(0, 8) : null;
      const cleanFormat = formatType === "2vs2" || formatType === "5vs5" ? formatType : null;

      // If switching to 2vs2, check if current member count <= 3
      if (cleanFormat === "2vs2") {
        const countRes = await client.query(
          `SELECT COUNT(*)::int as count FROM promo_team_members WHERE team_id = $1`,
          [teamId]
        );
        if (countRes.rows[0].count > 3) {
          return NextResponse.json({
            error: "Для перехода в формат 2x2 в составе должно быть не более 3 игроков (2 основных + 1 запасной). Исключите лишних игроков перед сменой формата.",
          }, { status: 400 });
        }
      }

      await client.query(
        `UPDATE promo_teams 
         SET name = COALESCE($1, name), tag = $2, logo_url = $3, format_type = COALESCE($4, format_type)
         WHERE id = $5`,
        [name ? name.trim() : null, cleanTag, logoUrl || null, cleanFormat, teamId]
      );
      return NextResponse.json({ success: true });
    }

    // 3. JOIN BY CODE
    if (action === "join") {
      const { joinCode } = body;
      if (!joinCode) {
        return NextResponse.json({ error: "Код приглашения обязателен" }, { status: 400 });
      }

      const targetTeamRes = await client.query(
        `SELECT id, COALESCE(format_type, '5vs5') as format_type FROM promo_teams WHERE join_code = $1 AND club_id = $2`,
        [joinCode.trim().toUpperCase(), activeClubId]
      );
      if (targetTeamRes.rows.length === 0) {
        return NextResponse.json({ error: "Команда с таким кодом не найдена" }, { status: 404 });
      }
      const targetTeam = targetTeamRes.rows[0];
      const targetTeamId = targetTeam.id;
      const isDuo = targetTeam.format_type === "2vs2";
      const maxSlots = isDuo ? 3 : 7;
      const maxMain = isDuo ? 2 : 5;

      const memberCheck = await client.query(
        `SELECT phone FROM promo_team_members WHERE team_id = $1 AND phone = $2`,
        [targetTeamId, phone]
      );
      if (memberCheck.rows.length > 0) {
        return NextResponse.json({ error: "Вы уже состоите в этой команде" }, { status: 400 });
      }

      const countRes = await client.query(
        `SELECT COUNT(*)::int as count FROM promo_team_members WHERE team_id = $1`,
        [targetTeamId]
      );
      if (countRes.rows[0].count >= maxSlots) {
        return NextResponse.json({
          error: isDuo
            ? "Дуэт полностью укомплектован (максимум 3 игрока: 2 основы + 1 запасной)"
            : "Команда полностью укомплектована (максимум 7 игроков)",
        }, { status: 400 });
      }

      const assignedRole = countRes.rows[0].count >= maxMain ? "sub" : "player";

      await client.query("BEGIN");
      await client.query(
        `INSERT INTO promo_team_members (team_id, phone, role) VALUES ($1, $2, $3)`,
        [targetTeamId, phone, assignedRole]
      );
      await client.query(
        `UPDATE promo_players SET lft_status = 'in_team' WHERE id = $1`,
        [playerId]
      );
      await client.query("COMMIT");
      return NextResponse.json({ success: true, teamId: targetTeamId });
    }

    // 4. INVITE PLAYER (Captain creates a pending invitation for player)
    if (action === "invite_player") {
      const { targetPlayerId } = body;
      if (!teamId || !targetPlayerId) {
        return NextResponse.json({ error: "ID команды и ID игрока обязательны" }, { status: 400 });
      }

      const teamInfo = await client.query(
        `SELECT id, name, captain_phone, COALESCE(format_type, '5vs5') as format_type FROM promo_teams WHERE id = $1`,
        [teamId]
      );
      if (teamInfo.rows.length === 0 || teamInfo.rows[0].captain_phone !== phone) {
        return NextResponse.json({ error: "Только капитан может приглашать игроков" }, { status: 403 });
      }

      const isDuo = teamInfo.rows[0].format_type === "2vs2";
      const maxSlots = isDuo ? 3 : 7;

      const targetRes = await client.query(`SELECT id, phone_number FROM promo_players WHERE id = $1`, [targetPlayerId]);
      if (targetRes.rows.length === 0 || !targetRes.rows[0].phone_number) {
        return NextResponse.json({ error: "Игрок не найден" }, { status: 404 });
      }
      const targetPhone = targetRes.rows[0].phone_number;

      // Check if already in this team
      const memberCheck = await client.query(
        `SELECT phone FROM promo_team_members WHERE team_id = $1 AND phone = $2`,
        [teamId, targetPhone]
      );
      if (memberCheck.rows.length > 0) {
        return NextResponse.json({ error: "Игрок уже состоит в этой команде" }, { status: 400 });
      }

      // Check member count
      const countRes = await client.query(
        `SELECT COUNT(*)::int as count FROM promo_team_members WHERE team_id = $1`,
        [teamId]
      );
      if (countRes.rows[0].count >= maxSlots) {
        return NextResponse.json({
          error: isDuo
            ? "В дуэте уже максимум игроков (3 слота: 2 основы + 1 запасной)"
            : "В команде уже максимум игроков (7 слотов)",
        }, { status: 400 });
      }

      // Check if already invited
      const existingInvite = await client.query(
        `SELECT id FROM promo_team_invitations WHERE team_id = $1 AND player_id = $2 AND status = 'PENDING'`,
        [teamId, targetPlayerId]
      );
      if (existingInvite.rows.length > 0) {
        return NextResponse.json({ error: "Приглашение уже отправлено этому игроку" }, { status: 400 });
      }

      await client.query(
        `INSERT INTO promo_team_invitations (team_id, player_id, invited_by_phone, type, status, role)
         VALUES ($1, $2, $3, 'INVITE', 'PENDING', 'player')`,
        [teamId, targetPlayerId, phone]
      );

      return NextResponse.json({ success: true, message: "Приглашение успешно отправлено игроку!" });
    }

    // 5. ACCEPT INVITATION (Player accepts team invitation)
    if (action === "accept_invite") {
      const { inviteId } = body;
      if (!inviteId) {
        return NextResponse.json({ error: "ID приглашения обязателен" }, { status: 400 });
      }

      const inviteRes = await client.query(
        `SELECT i.id, i.team_id, i.role, t.name as team_name, COALESCE(t.format_type, '5vs5') as format_type
         FROM promo_team_invitations i
         JOIN promo_teams t ON i.team_id = t.id
         WHERE i.id = $1 AND i.player_id = $2 AND i.status = 'PENDING'`,
        [inviteId, playerId]
      );

      if (inviteRes.rows.length === 0) {
        return NextResponse.json({ error: "Приглашение не найдено или уже обработано" }, { status: 404 });
      }

      const inv = inviteRes.rows[0];
      const targetTeamId = inv.team_id;
      const isDuo = inv.format_type === "2vs2";
      const maxSlots = isDuo ? 3 : 7;
      const maxMain = isDuo ? 2 : 5;

      // Check slots
      const countRes = await client.query(
        `SELECT COUNT(*)::int as count FROM promo_team_members WHERE team_id = $1`,
        [targetTeamId]
      );
      if (countRes.rows[0].count >= maxSlots) {
        return NextResponse.json({
          error: isDuo
            ? "В дуэте уже нет свободных мест (максимум 3 игрока)"
            : "В команде уже нет свободных мест (максимум 7)",
        }, { status: 400 });
      }

      const assignedRole = countRes.rows[0].count >= maxMain ? "sub" : "player";

      await client.query("BEGIN");
      await client.query(
        `INSERT INTO promo_team_members (team_id, phone, role)
         VALUES ($1, $2, $3)
         ON CONFLICT (team_id, phone) DO NOTHING`,
        [targetTeamId, phone, assignedRole]
      );
      await client.query(
        `UPDATE promo_team_invitations SET status = 'ACCEPTED', updated_at = NOW() WHERE id = $1`,
        [inviteId]
      );
      await client.query(
        `UPDATE promo_players SET lft_status = 'in_team' WHERE id = $1`,
        [playerId]
      );
      await client.query("COMMIT");

      return NextResponse.json({
        success: true,
        teamId: targetTeamId,
        message: `Вы успешно вступили в команду ${inv.team_name}!`,
      });
    }

    // 6. DECLINE INVITATION (Player declines invitation)
    if (action === "decline_invite") {
      const { inviteId } = body;
      if (!inviteId) {
        return NextResponse.json({ error: "ID приглашения обязателен" }, { status: 400 });
      }

      const inviteRes = await client.query(
        `UPDATE promo_team_invitations
         SET status = 'DECLINED', updated_at = NOW()
         WHERE id = $1 AND player_id = $2 AND status = 'PENDING'
         RETURNING id`,
        [inviteId, playerId]
      );

      if (inviteRes.rows.length === 0) {
        return NextResponse.json({ error: "Приглашение не найдено" }, { status: 404 });
      }

      return NextResponse.json({ success: true, message: "Приглашение отклонено" });
    }

    // 7. CANCEL INVITATION (Captain revokes sent invitation)
    if (action === "cancel_invite") {
      const { inviteId } = body;
      if (!inviteId) {
        return NextResponse.json({ error: "ID приглашения обязателен" }, { status: 400 });
      }

      // Verify captaincy
      const invCheck = await client.query(
        `SELECT i.id, t.captain_phone
         FROM promo_team_invitations i
         JOIN promo_teams t ON i.team_id = t.id
         WHERE i.id = $1`,
        [inviteId]
      );

      if (invCheck.rows.length === 0 || invCheck.rows[0].captain_phone !== phone) {
        return NextResponse.json({ error: "Только капитан команды может отозвать приглашение" }, { status: 403 });
      }

      await client.query(
        `UPDATE promo_team_invitations SET status = 'CANCELED', updated_at = NOW() WHERE id = $1`,
        [inviteId]
      );

      return NextResponse.json({ success: true, message: "Приглашение отозвано" });
    }

    // 8. TRANSFER CAPTAINCY
    if (action === "transfer_captain") {
      const { targetPlayerId } = body;
      if (!teamId || !targetPlayerId) {
        return NextResponse.json({ error: "ID команды и ID игрока обязательны" }, { status: 400 });
      }

      const teamInfo = await client.query(`SELECT captain_phone FROM promo_teams WHERE id = $1`, [teamId]);
      if (teamInfo.rows.length === 0 || teamInfo.rows[0].captain_phone !== phone) {
        return NextResponse.json({ error: "Только текущий капитан может передать права" }, { status: 403 });
      }

      const targetRes = await client.query(`SELECT phone_number FROM promo_players WHERE id = $1`, [targetPlayerId]);
      if (targetRes.rows.length === 0 || !targetRes.rows[0].phone_number) {
        return NextResponse.json({ error: "Игрок не найден" }, { status: 404 });
      }
      const targetPhone = targetRes.rows[0].phone_number;

      await client.query("BEGIN");
      await client.query(`UPDATE promo_teams SET captain_phone = $1 WHERE id = $2`, [targetPhone, teamId]);
      await client.query(`UPDATE promo_team_members SET role = 'player' WHERE team_id = $1 AND phone = $2`, [teamId, phone]);
      await client.query(`UPDATE promo_team_members SET role = 'captain' WHERE team_id = $1 AND phone = $2`, [teamId, targetPhone]);
      await client.query("COMMIT");

      return NextResponse.json({ success: true, message: "Права капитана успешно переданы" });
    }

    // 9. SET ROLE (Main / Sub)
    if (action === "set_role") {
      const { targetPlayerId, newRole } = body;
      if (!teamId || !targetPlayerId || !["player", "sub"].includes(newRole)) {
        return NextResponse.json({ error: "Неверные параметры роли" }, { status: 400 });
      }

      const teamInfo = await client.query(
        `SELECT captain_phone, COALESCE(format_type, '5vs5') as format_type FROM promo_teams WHERE id = $1`,
        [teamId]
      );
      if (teamInfo.rows.length === 0 || teamInfo.rows[0].captain_phone !== phone) {
        return NextResponse.json({ error: "Только капитан может менять роли" }, { status: 403 });
      }

      const isDuo = teamInfo.rows[0].format_type === "2vs2";
      const maxMain = isDuo ? 2 : 5;
      const maxSub = isDuo ? 1 : 2;

      const targetRes = await client.query(`SELECT phone_number FROM promo_players WHERE id = $1`, [targetPlayerId]);
      if (targetRes.rows.length === 0) {
        return NextResponse.json({ error: "Игрок не найден" }, { status: 404 });
      }
      const targetPhone = targetRes.rows[0].phone_number;

      if (targetPhone === phone) {
        return NextResponse.json({ error: "Капитан всегда находится в основном составе" }, { status: 400 });
      }

      // Check slot limits if moving to player or sub
      if (newRole === "player") {
        const mainCountRes = await client.query(
          `SELECT COUNT(*)::int as count FROM promo_team_members WHERE team_id = $1 AND (role = 'player' OR phone = $2)`,
          [teamId, teamInfo.rows[0].captain_phone]
        );
        if (mainCountRes.rows[0].count >= maxMain) {
          return NextResponse.json({
            error: isDuo
              ? "В основном составе дуэта уже максимум игроков (2)"
              : "В основном составе команды уже максимум игроков (5)",
          }, { status: 400 });
        }
      } else if (newRole === "sub") {
        const subCountRes = await client.query(
          `SELECT COUNT(*)::int as count FROM promo_team_members WHERE team_id = $1 AND role = 'sub'`,
          [teamId]
        );
        if (subCountRes.rows[0].count >= maxSub) {
          return NextResponse.json({
            error: isDuo
              ? "В запасе дуэта уже максимум игроков (1)"
              : "В запасе команды уже максимум игроков (2)",
          }, { status: 400 });
        }
      }

      await client.query(
        `UPDATE promo_team_members SET role = $1 WHERE team_id = $2 AND phone = $3`,
        [newRole, teamId, targetPhone]
      );
      return NextResponse.json({
        success: true,
        message: newRole === "sub" ? "Игрок переведен в запас" : "Игрок переведен в основной состав",
      });
    }

    // 10. KICK MEMBER (Delete player from team)
    if (action === "kick" || action === "remove_member") {
      const targetPlayerId = body.targetPlayerId || body.playerIdToKick;
      if (!teamId || !targetPlayerId) {
        return NextResponse.json({ error: "ID команды и игрока обязательны" }, { status: 400 });
      }

      const teamInfo = await client.query(`SELECT captain_phone FROM promo_teams WHERE id = $1`, [teamId]);
      if (teamInfo.rows.length === 0 || teamInfo.rows[0].captain_phone !== phone) {
        return NextResponse.json({ error: "Только капитан может исключать игроков из команды" }, { status: 403 });
      }

      const targetRes = await client.query(`SELECT phone_number FROM promo_players WHERE id = $1`, [targetPlayerId]);
      if (targetRes.rows.length === 0) {
        return NextResponse.json({ error: "Игрок не найден" }, { status: 404 });
      }
      const targetPhone = targetRes.rows[0].phone_number;

      if (targetPhone === phone) {
        return NextResponse.json({ error: "Капитан не может исключить сам себя" }, { status: 400 });
      }

      await client.query(`DELETE FROM promo_team_members WHERE team_id = $1 AND phone = $2`, [teamId, targetPhone]);
      
      const otherTeams = await client.query(`SELECT 1 FROM promo_team_members WHERE phone = $1`, [targetPhone]);
      if (otherTeams.rows.length === 0) {
        await client.query(`UPDATE promo_players SET lft_status = 'none' WHERE phone_number = $1`, [targetPhone]);
      }

      return NextResponse.json({ success: true, message: "Игрок успешно удален из команды" });
    }

    // 11. LEAVE TEAM
    if (action === "leave") {
      if (!teamId) return NextResponse.json({ error: "ID команды обязателен" }, { status: 400 });

      const teamInfo = await client.query(`SELECT captain_phone FROM promo_teams WHERE id = $1`, [teamId]);
      if (teamInfo.rows.length > 0 && teamInfo.rows[0].captain_phone === phone) {
        return NextResponse.json({ error: "Капитан не может покинуть команду, только распустить или передать права" }, { status: 400 });
      }

      await client.query(`DELETE FROM promo_team_members WHERE team_id = $1 AND phone = $2`, [teamId, phone]);
      
      const otherTeams = await client.query(`SELECT 1 FROM promo_team_members WHERE phone = $1`, [phone]);
      if (otherTeams.rows.length === 0) {
        await client.query(`UPDATE promo_players SET lft_status = 'none' WHERE phone_number = $1`, [phone]);
      }

      return NextResponse.json({ success: true, message: "Вы покинули команду" });
    }

    // 12. DISBAND TEAM
    if (action === "disband") {
      if (!teamId) return NextResponse.json({ error: "ID команды обязателен" }, { status: 400 });

      const teamInfo = await client.query(`SELECT captain_phone FROM promo_teams WHERE id = $1`, [teamId]);
      if (teamInfo.rows.length === 0 || teamInfo.rows[0].captain_phone !== phone) {
        return NextResponse.json({ error: "Только капитан может распустить команду" }, { status: 403 });
      }

      const teamMems = await client.query(`SELECT phone FROM promo_team_members WHERE team_id = $1`, [teamId]);
      await client.query(`DELETE FROM promo_teams WHERE id = $1`, [teamId]);
      
      for (const m of teamMems.rows) {
        const otherTeams = await client.query(`SELECT 1 FROM promo_team_members WHERE phone = $1`, [m.phone]);
        if (otherTeams.rows.length === 0) {
          await client.query(`UPDATE promo_players SET lft_status = 'none' WHERE phone_number = $1`, [m.phone]);
        }
      }

      return NextResponse.json({ success: true, message: "Команда распущена" });
    }

    return NextResponse.json({ error: "Неверное действие" }, { status: 400 });
  } catch (error) {
    console.error("Teams POST Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  } finally {
    client.release();
  }
}
