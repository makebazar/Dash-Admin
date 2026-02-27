import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';

// GET - Get KPI config for club
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

        // Verify access
        const accessCheck = await query(
            `SELECT 1 FROM clubs WHERE id = $1 AND owner_id = $2
             UNION
             SELECT 1 FROM club_employees WHERE club_id = $1 AND user_id = $2`,
            [clubId, userId]
        );

        if ((accessCheck.rowCount || 0) === 0) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const result = await query(
            `SELECT * FROM maintenance_kpi_config WHERE club_id = $1`,
            [clubId]
        );

        if (result.rowCount === 0) {
            // Return default config if none exists
            return NextResponse.json({
                enabled: false,
                assignment_mode: 'BOTH',
                points_per_cleaning: 1,
                points_per_issue_resolved: 3,
                bonus_per_point: 50,
                on_time_multiplier: 1.0,
                late_penalty_multiplier: 0.5,
                include_in_salary: true,
                calculation_mode: 'PER_TASK',
                monthly_tiers: []
            });
        }

        return NextResponse.json(result.rows[0]);
    } catch (error) {
        console.error('Get KPI Config Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// PUT - Create or update KPI config
export async function PUT(
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

        // Verify ownership
        const ownerCheck = await query(
            `SELECT 1 FROM clubs WHERE id = $1 AND owner_id = $2`,
            [clubId, userId]
        );

        if ((ownerCheck.rowCount || 0) === 0) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const {
            enabled,
            assignment_mode,
            points_per_cleaning,
            points_per_issue_resolved,
            bonus_per_point,
            on_time_multiplier,
            late_penalty_multiplier,
            include_in_salary,
            calculation_mode,
            monthly_tiers
        } = body;

        const result = await query(
            `INSERT INTO maintenance_kpi_config (
                club_id, enabled, assignment_mode, points_per_cleaning, points_per_issue_resolved,
                bonus_per_point, on_time_multiplier, late_penalty_multiplier, include_in_salary,
                calculation_mode, monthly_tiers
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            ON CONFLICT (club_id) DO UPDATE SET
                enabled = EXCLUDED.enabled,
                assignment_mode = EXCLUDED.assignment_mode,
                points_per_cleaning = EXCLUDED.points_per_cleaning,
                points_per_issue_resolved = EXCLUDED.points_per_issue_resolved,
                bonus_per_point = EXCLUDED.bonus_per_point,
                on_time_multiplier = EXCLUDED.on_time_multiplier,
                late_penalty_multiplier = EXCLUDED.late_penalty_multiplier,
                include_in_salary = EXCLUDED.include_in_salary,
                calculation_mode = EXCLUDED.calculation_mode,
                monthly_tiers = EXCLUDED.monthly_tiers,
                updated_at = CURRENT_TIMESTAMP
            RETURNING *`,
            [
                clubId,
                enabled ?? false,
                assignment_mode ?? 'BOTH',
                points_per_cleaning ?? 1,
                points_per_issue_resolved ?? 3,
                bonus_per_point ?? 50,
                on_time_multiplier ?? 1.0,
                late_penalty_multiplier ?? 0.5,
                include_in_salary ?? true,
                calculation_mode ?? 'PER_TASK',
                monthly_tiers || []
            ]
        );

        return NextResponse.json(result.rows[0]);
    } catch (error) {
        console.error('Update KPI Config Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
