import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

async function ensureSchema() {
    await query(`INSERT INTO roles (name, default_kpi_settings) VALUES ('Владелец', '{}'::jsonb) ON CONFLICT (name) DO NOTHING`);
    await query(`
        CREATE TABLE IF NOT EXISTS club_employee_roles (
            club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
            priority INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW(),
            UNIQUE(club_id, user_id, role_id)
        );
        CREATE INDEX IF NOT EXISTS idx_club_employee_roles_club_user ON club_employee_roles(club_id, user_id);
    `);

    await query(`
        CREATE TABLE IF NOT EXISTS club_employee_role_preferences (
            club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            active_role_id INTEGER NULL REFERENCES roles(id) ON DELETE SET NULL,
            updated_at TIMESTAMP DEFAULT NOW(),
            UNIQUE(club_id, user_id)
        );
        CREATE INDEX IF NOT EXISTS idx_club_employee_role_preferences_club_user ON club_employee_role_preferences(club_id, user_id);
    `);
}

async function requireEmployeeAccess(clubId: string, userId: string) {
    const accessCheck = await query(
        `
        SELECT 1
        FROM clubs c
        LEFT JOIN club_employees ce
          ON ce.club_id = c.id
         AND ce.user_id = $2
         AND ce.is_active = TRUE
         AND ce.dismissed_at IS NULL
        WHERE c.id = $1
          AND (c.owner_id = $2 OR ce.user_id IS NOT NULL)
        LIMIT 1
        `,
        [clubId, userId]
    );
    return (accessCheck.rowCount || 0) > 0;
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ clubId: string }> }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        const { clubId } = await params;

        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!(await requireEmployeeAccess(clubId, userId))) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        await ensureSchema();

        const assignedRes = await query(
            `
            SELECT cer.role_id, r.name as role_name, cer.priority
            FROM club_employee_roles cer
            JOIN roles r ON r.id = cer.role_id
            WHERE cer.club_id = $1 AND cer.user_id = $2
            ORDER BY cer.priority ASC, r.name ASC
            `,
            [clubId, userId]
        );

        let roles = assignedRes.rows.map(r => ({
            id: Number(r.role_id),
            name: String(r.role_name),
            priority: Number(r.priority)
        }));

        const ownerRoleRes = await query(`SELECT id FROM roles WHERE name = 'Владелец' LIMIT 1`)
        const ownerRoleId = ownerRoleRes.rows[0]?.id ? Number(ownerRoleRes.rows[0].id) : null
        const isOwnerRes = await query(`SELECT 1 FROM clubs WHERE id = $1 AND owner_id = $2 LIMIT 1`, [clubId, userId])
        const isOwner = (isOwnerRes.rowCount || 0) > 0

        if (roles.length === 0) {
            if (isOwner && ownerRoleId) {
                roles = [{ id: ownerRoleId, name: 'Владелец', priority: 0 }]
            } else {
                const fallbackRes = await query(
                    `
                    SELECT r.id, r.name
                    FROM users u
                    LEFT JOIN roles r ON r.id = u.role_id
                    WHERE u.id = $1
                    LIMIT 1
                    `,
                    [userId]
                );
                const rid = fallbackRes.rows[0]?.id;
                const rname = fallbackRes.rows[0]?.name;
                if (rid) {
                    roles = [{ id: Number(rid), name: String(rname || 'Сотрудник'), priority: 0 }];
                }
            }
        }

        if (isOwner && ownerRoleId && !roles.some(r => r.id === ownerRoleId)) {
            roles = [{ id: ownerRoleId, name: 'Владелец', priority: -1 }, ...roles]
        }

        const prefRes = await query(
            `SELECT active_role_id FROM club_employee_role_preferences WHERE club_id = $1 AND user_id = $2 LIMIT 1`,
            [clubId, userId]
        );
        const activeRoleId = prefRes.rows[0]?.active_role_id ? Number(prefRes.rows[0].active_role_id) : null;
        const defaultRoleId = roles[0]?.id ?? null;

        return NextResponse.json({
            roles,
            active_role_id: activeRoleId,
            default_role_id: defaultRoleId
        });
    } catch (error: any) {
        console.error('Get Club Roles For Employee Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ clubId: string }> }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        const { clubId } = await params;

        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!(await requireEmployeeAccess(clubId, userId))) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        await ensureSchema();

        const body = await request.json();
        const activeRoleId = body?.active_role_id === null || body?.active_role_id === undefined
            ? null
            : Number(body.active_role_id);

        if (activeRoleId !== null && !Number.isFinite(activeRoleId)) {
            return NextResponse.json({ error: 'Invalid active_role_id' }, { status: 400 });
        }

        const assignedRes = await query(
            `SELECT role_id FROM club_employee_roles WHERE club_id = $1 AND user_id = $2`,
            [clubId, userId]
        );
        const allowed = new Set<number>(assignedRes.rows.map(r => Number(r.role_id)));

        if (allowed.size === 0 && activeRoleId !== null) {
            const fallbackRes = await query(`SELECT role_id FROM users WHERE id = $1`, [userId]);
            const fallbackRoleId = fallbackRes.rows[0]?.role_id ? Number(fallbackRes.rows[0].role_id) : null;
            if (fallbackRoleId !== null && fallbackRoleId !== activeRoleId) {
                return NextResponse.json({ error: 'Role not allowed' }, { status: 403 });
            }
        } else if (activeRoleId !== null && !allowed.has(activeRoleId)) {
            return NextResponse.json({ error: 'Role not allowed' }, { status: 403 });
        }

        await query(
            `
            INSERT INTO club_employee_role_preferences (club_id, user_id, active_role_id, updated_at)
            VALUES ($1, $2, $3, NOW())
            ON CONFLICT (club_id, user_id)
            DO UPDATE SET active_role_id = EXCLUDED.active_role_id, updated_at = NOW()
            `,
            [clubId, userId, activeRoleId]
        );

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Update Employee Active Role Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
