import { NextResponse } from "next/server";
import { query } from "@/db";
import { cookies } from "next/headers";
import { isSuperAdmin } from "@/lib/admin";

async function checkUserClubAccess(clubId: string) {
  const userId = (await cookies()).get("session_user_id")?.value;
  if (!userId)
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };

  const adminCheck = await query(
    `SELECT is_super_admin, is_staff, phone_number FROM users WHERE id = $1`,
    [userId],
  );

  const user = adminCheck.rows[0];
  if (!user) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const isSuper = isSuperAdmin(
    user.is_super_admin,
    userId,
    user.phone_number,
  );

  const isStaff = Boolean(user.is_staff);

  if (!isSuper && !isStaff) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  if (isStaff) {
    const clubCheck = await query("SELECT referred_by_id FROM clubs WHERE id = $1", [clubId]);
    if (clubCheck.rowCount === 0 || clubCheck.rows[0].referred_by_id !== userId) {
      return {
        ok: false as const,
        response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      };
    }
  }

  return { ok: true as const, userId, isSuper, isStaff };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const auth = await checkUserClubAccess(id);
    if (!auth.ok) return auth.response;

    // Fetch club, primary owner, and referrer
    const clubResult = await query(
      `
            SELECT
                c.*,
                u.full_name as owner_name,
                u.phone_number as owner_phone,
                ref.full_name as referrer_name
            FROM clubs c
            LEFT JOIN users u ON u.id = c.owner_id
            LEFT JOIN users ref ON ref.id = c.referred_by_id
            WHERE c.id = $1
        `,
      [id],
    );

    if (clubResult.rowCount === 0) {
      return NextResponse.json({ error: "Club not found" }, { status: 404 });
    }

    // Fetch all owners (primary + secondary)
    const ownersResult = await query(
      `
            SELECT
                u.id,
                u.full_name,
                u.phone_number,
                CASE WHEN c.owner_id = u.id THEN TRUE ELSE FALSE END as is_primary
            FROM users u
            JOIN club_employees ce ON ce.user_id = u.id
            JOIN clubs c ON c.id = ce.club_id
            WHERE ce.club_id = $1 AND ce.role = 'Владелец'
            UNION
            SELECT
                u.id,
                u.full_name,
                u.phone_number,
                TRUE as is_primary
            FROM users u
            JOIN clubs c ON c.id = $1 AND c.owner_id = u.id
            ORDER BY is_primary DESC, full_name ASC
        `,
      [id],
    );

    // Fetch regular employees
    const employeesResult = await query(
      `
            SELECT
                u.id, u.full_name, u.phone_number, ce.role, ce.hired_at
            FROM users u
            JOIN club_employees ce ON ce.user_id = u.id
            WHERE ce.club_id = $1 AND ce.role <> 'Владелец' AND ce.is_active = TRUE AND ce.dismissed_at IS NULL
            ORDER BY ce.hired_at DESC
        `,
      [id],
    );

    // Fetch all available users for adding to team
    const allUsersResult = await query(`
            SELECT id, full_name, phone_number
            FROM users
            ORDER BY full_name ASC
        `);

    return NextResponse.json({
      club: clubResult.rows[0],
      owners: ownersResult.rows,
      employees: employeesResult.rows,
      availableUsers: allUsersResult.rows,
    });
  } catch (error) {
    console.error("Get Club X Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const auth = await checkUserClubAccess(id);
    if (!auth.ok) return auth.response;

    if (!auth.isSuper) {
      return NextResponse.json({ error: "Forbidden: Super Admin only" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get("userId");
    const mode = searchParams.get("mode");

    if (mode === "remove-member") {
      if (!targetUserId)
        return NextResponse.json(
          { error: "User ID required" },
          { status: 400 },
        );

      // Check if it's the primary owner
      const club = await query("SELECT owner_id FROM clubs WHERE id = $1", [
        id,
      ]);
      if (club.rows[0]?.owner_id === targetUserId) {
        return NextResponse.json(
          { error: "Cannot remove primary owner" },
          { status: 400 },
        );
      }

      await query(
        "DELETE FROM club_employees WHERE club_id = $1 AND user_id = $2",
        [id, targetUserId],
      );
      return NextResponse.json({ success: true });
    }

    if (mode === "archive-club") {
      await query("UPDATE clubs SET is_active = FALSE WHERE id = $1", [id]);
      return NextResponse.json({ success: true });
    }

    if (mode === "restore-club") {
      await query("UPDATE clubs SET is_active = TRUE WHERE id = $1", [id]);
      return NextResponse.json({ success: true });
    }

    if (mode === "destroy-club") {
      // High danger action - Hard Delete
      await query("DELETE FROM clubs WHERE id = $1", [id]);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unsupported mode" }, { status: 400 });
  } catch (error) {
    console.error("Delete Club X Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const auth = await checkUserClubAccess(id);
    if (!auth.ok) return auth.response;

    if (!auth.isSuper) {
      return NextResponse.json({ error: "Forbidden: Super Admin only" }, { status: 403 });
    }

    const { userId, phoneNumber, fullName, role } = await request.json();

    let targetUserId = userId;

    // If no userId, try to find by phone (invitation/linking logic)
    if (!targetUserId && phoneNumber) {
      const existingUser = await query(
        "SELECT id FROM users WHERE phone_number = $1",
        [phoneNumber],
      );
      if ((existingUser.rowCount ?? 0) > 0) {
        targetUserId = existingUser.rows[0].id;
      } else if (fullName) {
        // Create new user if totally new to system
        const newUser = await query(
          "INSERT INTO users (full_name, phone_number, role_id) VALUES ($1, $2, (SELECT id FROM roles WHERE name = 'Сотрудник' LIMIT 1)) RETURNING id",
          [fullName, phoneNumber],
        );
        targetUserId = newUser.rows[0].id;
      }
    }

    if (!targetUserId || !role)
      return NextResponse.json(
        { error: "User identification and role required" },
        { status: 400 },
      );

    await query(
      `
            INSERT INTO club_employees (club_id, user_id, role, is_active, hired_at)
            VALUES ($1, $2, $3, TRUE, NOW())
            ON CONFLICT (club_id, user_id) DO UPDATE SET role = EXCLUDED.role, is_active = TRUE, dismissed_at = NULL
        `,
      [id, targetUserId, role],
    );

    return NextResponse.json({ success: true, userId: targetUserId });
  } catch (error) {
    console.error("Post Club X Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const auth = await checkUserClubAccess(id);
    if (!auth.ok) return auth.response;

    const body = await request.json();

    const {
      name,
      address,
      owner_id,
      timezone,
      day_start_hour,
      night_start_hour,
      inventory_required,
      is_active,
      referred_by_id,
      referral_reward_type,
      referral_reward_value,
    } = body;

    // Security check: staff members CANNOT change referral commission settings or assigned managers!
    if (!auth.isSuper) {
      if (referred_by_id !== undefined || referral_reward_type !== undefined || referral_reward_value !== undefined) {
        return NextResponse.json({ error: "Forbidden: Only Super Admin can change commission settings" }, { status: 403 });
      }
    }

    // Special logic for primary owner change
    if (owner_id) {
      const currentClub = await query(
        "SELECT owner_id FROM clubs WHERE id = $1",
        [id],
      );
      const oldOwnerId = currentClub.rows[0]?.owner_id;

      if (oldOwnerId && oldOwnerId !== owner_id) {
        // Move old owner to employees list as 'Владелец' so they don't lose access
        await query(
          `INSERT INTO club_employees (club_id, user_id, role, is_active, hired_at)
                 VALUES ($1, $2, 'Владелец', TRUE, NOW())
                 ON CONFLICT (club_id, user_id) DO UPDATE SET role = 'Владелец', is_active = TRUE`,
          [id, oldOwnerId],
        );
      }
    }

    await query(
      `
            UPDATE clubs
            SET
                name = COALESCE($1, name),
                address = COALESCE($2, address),
                owner_id = COALESCE($3, owner_id),
                timezone = COALESCE($4, timezone),
                day_start_hour = COALESCE($5, day_start_hour),
                night_start_hour = COALESCE($6, night_start_hour),
                inventory_required = COALESCE($7, inventory_required),
                is_active = COALESCE($8, is_active),
                referred_by_id = CASE WHEN $9 = 'undefined' THEN referred_by_id WHEN $9 = 'null' THEN NULL ELSE $9::uuid END,
                referral_reward_type = COALESCE($10, referral_reward_type),
                referral_reward_value = COALESCE($11, referral_reward_value)
            WHERE id = $12
        `,
      [
        name !== undefined ? name : null,
        address !== undefined ? address : null,
        owner_id !== undefined ? owner_id : null,
        timezone !== undefined ? timezone : null,
        day_start_hour !== undefined ? day_start_hour : null,
        night_start_hour !== undefined ? night_start_hour : null,
        inventory_required !== undefined ? inventory_required : null,
        is_active !== undefined ? is_active : null,
        referred_by_id === undefined ? 'undefined' : (referred_by_id === null ? 'null' : referred_by_id),
        referral_reward_type !== undefined ? referral_reward_type : null,
        referral_reward_value !== undefined ? referral_reward_value : null,
        id,
      ],
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update Club X Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
