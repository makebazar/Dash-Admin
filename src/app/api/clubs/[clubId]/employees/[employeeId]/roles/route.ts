import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';
import { ensureOwnerSubscriptionActive } from '@/lib/club-subscription-guard';
import { requireClubFullAccess } from '@/lib/club-api-access';

export const dynamic = 'force-dynamic';

async function ensureSchema() {
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
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ clubId: string; employeeId: string }> }
) {
    try {
        const { clubId, employeeId } = await params;
        await requireClubFullAccess(clubId);
        await ensureSchema();

        const res = await query(
            `
            SELECT cer.role_id, r.name as role_name, cer.priority
            FROM club_employee_roles cer
            JOIN roles r ON r.id = cer.role_id
            WHERE cer.club_id = $1 AND cer.user_id = $2
            ORDER BY cer.priority ASC, r.name ASC
            `,
            [clubId, employeeId]
        );

        return NextResponse.json({
            roles: res.rows.map(r => ({
                role_id: r.role_id,
                role_name: r.role_name,
                priority: r.priority
            }))
        });
    } catch (error: any) {
        const status = error?.status;
        if (status) {
            return NextResponse.json({ error: status === 401 ? 'Unauthorized' : 'Forbidden' }, { status });
        }
        console.error('Get Employee Roles Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ clubId: string; employeeId: string }> }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        const { clubId, employeeId } = await params;
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const guard = await ensureOwnerSubscriptionActive(clubId, userId);
        if (!guard.ok) return guard.response;

        await ensureSchema();

        const body = await request.json();
        const roleIdsRaw = Array.isArray(body?.role_ids) ? body.role_ids : [];
        const roleIds = roleIdsRaw
            .map((v: any) => Number(v))
            .filter((v: any) => Number.isFinite(v));

        const uniqueRoleIds: number[] = [];
        for (const rid of roleIds) {
            if (!uniqueRoleIds.includes(rid)) uniqueRoleIds.push(rid);
        }

        if (uniqueRoleIds.length === 0) {
            await query(`DELETE FROM club_employee_roles WHERE club_id = $1 AND user_id = $2`, [clubId, employeeId]);
            return NextResponse.json({ success: true });
        }

        const rolesCheck = await query(
            `SELECT id FROM roles WHERE id = ANY($1::int[])`,
            [uniqueRoleIds]
        );
        const existing = new Set<number>(rolesCheck.rows.map(r => Number(r.id)));
        const missing = uniqueRoleIds.filter(id => !existing.has(id));
        if (missing.length > 0) {
            return NextResponse.json({ error: 'Role not found', missing }, { status: 400 });
        }

        const client = await (await import('@/db')).queryClient();
        try {
            await client.query('BEGIN');
            await client.query(
                `DELETE FROM club_employee_roles WHERE club_id = $1 AND user_id = $2`,
                [clubId, employeeId]
            );
            for (let i = 0; i < uniqueRoleIds.length; i++) {
                const roleId = uniqueRoleIds[i];
                await client.query(
                    `
                    INSERT INTO club_employee_roles (club_id, user_id, role_id, priority)
                    VALUES ($1, $2, $3, $4)
                    ON CONFLICT (club_id, user_id, role_id)
                    DO UPDATE SET priority = EXCLUDED.priority, updated_at = NOW()
                    `,
                    [clubId, employeeId, roleId, i]
                );
            }
            await client.query('COMMIT');
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        const status = error?.status;
        if (status) {
            return NextResponse.json({ error: status === 401 ? 'Unauthorized' : 'Forbidden' }, { status });
        }
        console.error('Update Employee Roles Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

