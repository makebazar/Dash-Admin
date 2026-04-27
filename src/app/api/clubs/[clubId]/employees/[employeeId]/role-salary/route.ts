import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';
import { ensureOwnerSubscriptionActive } from '@/lib/club-subscription-guard';

export const dynamic = 'force-dynamic';

async function ensureSchema() {
    await query(`
        CREATE TABLE IF NOT EXISTS employee_role_salary_assignments (
            club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
            scheme_id INTEGER NULL REFERENCES salary_schemes(id) ON DELETE SET NULL,
            assigned_at TIMESTAMP DEFAULT NOW(),
            UNIQUE(club_id, user_id, role_id)
        );
        CREATE INDEX IF NOT EXISTS idx_employee_role_salary_assignments_club_user ON employee_role_salary_assignments(club_id, user_id);
    `);
}

export async function POST(
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
        const roleId = Number(body?.role_id);
        const schemeIdRaw = body?.scheme_id;
        const schemeId = schemeIdRaw === null || schemeIdRaw === undefined ? null : Number(schemeIdRaw);

        if (!Number.isFinite(roleId)) return NextResponse.json({ error: 'Invalid role_id' }, { status: 400 });
        if (schemeId !== null && !Number.isFinite(schemeId)) return NextResponse.json({ error: 'Invalid scheme_id' }, { status: 400 });

        const roleCheck = await query(`SELECT 1 FROM roles WHERE id = $1`, [roleId]);
        if ((roleCheck.rowCount || 0) === 0) return NextResponse.json({ error: 'Role not found' }, { status: 404 });

        if (schemeId !== null) {
            const schemeCheck = await query(
                `SELECT 1 FROM salary_schemes WHERE id = $1 AND club_id = $2`,
                [schemeId, clubId]
            );
            if ((schemeCheck.rowCount || 0) === 0) return NextResponse.json({ error: 'Scheme not found' }, { status: 404 });
        }

        await query(
            `
            INSERT INTO employee_role_salary_assignments (club_id, user_id, role_id, scheme_id, assigned_at)
            VALUES ($1, $2, $3, $4, NOW())
            ON CONFLICT (club_id, user_id, role_id)
            DO UPDATE SET scheme_id = EXCLUDED.scheme_id, assigned_at = NOW()
            `,
            [clubId, employeeId, roleId, schemeId]
        );

        return NextResponse.json({ success: true });
    } catch (error: any) {
        const status = error?.status;
        if (status) {
            return NextResponse.json({ error: status === 401 ? 'Unauthorized' : 'Forbidden' }, { status });
        }
        console.error('Upsert Employee Role Salary Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(
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

        const { searchParams } = new URL(request.url);
        const roleId = Number(searchParams.get('role_id'));
        if (!Number.isFinite(roleId)) return NextResponse.json({ error: 'Invalid role_id' }, { status: 400 });

        await query(
            `DELETE FROM employee_role_salary_assignments WHERE club_id = $1 AND user_id = $2 AND role_id = $3`,
            [clubId, employeeId, roleId]
        );

        return NextResponse.json({ success: true, removed: true });
    } catch (error: any) {
        const status = error?.status;
        if (status) {
            return NextResponse.json({ error: status === 401 ? 'Unauthorized' : 'Forbidden' }, { status });
        }
        console.error('Delete Employee Role Salary Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

