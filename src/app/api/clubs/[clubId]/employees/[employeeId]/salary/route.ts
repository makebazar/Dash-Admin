import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';
import { ensureOwnerSubscriptionActive } from '@/lib/club-subscription-guard';
import { requireClubFullAccess } from '@/lib/club-api-access';

// GET: Get employee's salary assignment
export async function GET(
    request: Request,
    { params }: { params: Promise<{ clubId: string; employeeId: string }> }
) {
    try {
        const { clubId, employeeId } = await params;
        await requireClubFullAccess(clubId)

        // Get assignment with scheme details
        const result = await query(
            `SELECT 
                a.id,
                a.scheme_id,
                a.assigned_at,
                s.name as scheme_name,
                v.formula,
                v.version
             FROM employee_salary_assignments a
             LEFT JOIN salary_schemes s ON a.scheme_id = s.id
             LEFT JOIN LATERAL (
                 SELECT * FROM salary_scheme_versions 
                 WHERE scheme_id = s.id 
                 ORDER BY version DESC 
                 LIMIT 1
             ) v ON true
             WHERE a.club_id = $1 AND a.user_id = $2`,
            [clubId, employeeId]
        );

        return NextResponse.json({
            assignment: result.rows[0] || null
        });

    } catch (error: any) {
        const status = error?.status
        if (status) {
            return NextResponse.json({ error: status === 401 ? 'Unauthorized' : 'Forbidden' }, { status })
        }
        console.error('Get Employee Salary Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST: Assign salary scheme to employee
export async function POST(
    request: Request,
    { params }: { params: Promise<{ clubId: string; employeeId: string }> }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        const { clubId, employeeId } = await params;
        const body = await request.json();

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const guard = await ensureOwnerSubscriptionActive(clubId, userId)
        if (!guard.ok) return guard.response

        const { scheme_id } = body;

        if (scheme_id === null || scheme_id === undefined) {
            // Remove assignment
            await query(
                `DELETE FROM employee_salary_assignments WHERE club_id = $1 AND user_id = $2`,
                [clubId, employeeId]
            );
            return NextResponse.json({ success: true, removed: true });
        }

        // Verify scheme belongs to club
        const schemeCheck = await query(
            `SELECT 1 FROM salary_schemes WHERE id = $1 AND club_id = $2`,
            [scheme_id, clubId]
        );

        if ((schemeCheck.rowCount || 0) === 0) {
            return NextResponse.json({ error: 'Scheme not found' }, { status: 404 });
        }

        // Upsert assignment
        await query(
            `INSERT INTO employee_salary_assignments (club_id, user_id, scheme_id)
             VALUES ($1, $2, $3)
             ON CONFLICT (club_id, user_id) 
             DO UPDATE SET scheme_id = $3, assigned_at = NOW()`,
            [clubId, employeeId, scheme_id]
        );

        return NextResponse.json({ success: true });

    } catch (error: any) {
        const status = error?.status
        if (status) {
            return NextResponse.json({ error: status === 401 ? 'Unauthorized' : 'Forbidden' }, { status })
        }
        console.error('Assign Salary Scheme Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
