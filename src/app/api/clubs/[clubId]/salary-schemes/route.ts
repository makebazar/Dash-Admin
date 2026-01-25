import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';

// GET: Get all salary schemes for a club
export async function GET(
    request: Request,
    { params }: { params: Promise<{ clubId: string }> }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        const { clubId } = await params;

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Check ownership
        const ownerCheck = await query(
            `SELECT 1 FROM clubs WHERE id = $1 AND owner_id = $2`,
            [clubId, userId]
        );

        if ((ownerCheck.rowCount || 0) === 0) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Get schemes with latest version formula and employee count
        const result = await query(
            `SELECT 
                s.id,
                s.name,
                s.description,
                s.period_bonuses,
                s.standard_monthly_shifts,
                s.is_active,
                s.created_at,
                v.version,
                v.formula,
                v.id as version_id,
                (SELECT COUNT(*) FROM employee_salary_assignments WHERE scheme_id = s.id) as employee_count
             FROM salary_schemes s
             LEFT JOIN LATERAL (
                 SELECT * FROM salary_scheme_versions 
                 WHERE scheme_id = s.id 
                 ORDER BY version DESC 
                 LIMIT 1
             ) v ON true
             WHERE s.club_id = $1
             ORDER BY s.created_at DESC`,
            [clubId]
        );

        return NextResponse.json({ schemes: result.rows });

    } catch (error: any) {
        console.error('Get Salary Schemes Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST: Create a new salary scheme
export async function POST(
    request: Request,
    { params }: { params: Promise<{ clubId: string }> }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        const { clubId } = await params;
        const body = await request.json();

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Check ownership
        const ownerCheck = await query(
            `SELECT 1 FROM clubs WHERE id = $1 AND owner_id = $2`,
            [clubId, userId]
        );

        if ((ownerCheck.rowCount || 0) === 0) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { name, description, formula, period_bonuses, standard_monthly_shifts } = body;

        if (!name || !formula) {
            return NextResponse.json({ error: 'Name and formula are required' }, { status: 400 });
        }

        // Create scheme
        const schemeResult = await query(
            `INSERT INTO salary_schemes (club_id, name, description, period_bonuses, standard_monthly_shifts)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id`,
            [clubId, name, description || '', JSON.stringify(period_bonuses || []), standard_monthly_shifts || 15]
        );

        const schemeId = schemeResult.rows[0].id;

        // Create first version
        const versionResult = await query(
            `INSERT INTO salary_scheme_versions (scheme_id, version, formula)
             VALUES ($1, 1, $2)
             RETURNING id, version`,
            [schemeId, JSON.stringify(formula)]
        );

        return NextResponse.json({
            success: true,
            scheme_id: schemeId,
            version_id: versionResult.rows[0].id,
            version: 1
        });

    } catch (error: any) {
        console.error('Create Salary Scheme Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
