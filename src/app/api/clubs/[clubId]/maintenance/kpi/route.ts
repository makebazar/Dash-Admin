import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';

// GET - Retrieve KPI settings
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

        // Check access
        const accessCheck = await query(
            `SELECT 1 FROM clubs WHERE id = $1 AND owner_id = $2`,
            [clubId, userId]
        );

        if ((accessCheck.rowCount || 0) === 0) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Get config
        const result = await query(
            `SELECT * FROM maintenance_kpi_config WHERE club_id = $1`,
            [clubId]
        );

        if (result.rowCount === 0) {
            // Return default config if not set
            return NextResponse.json({
                enabled: false,
                points_per_cleaning: 1,
                points_per_issue_resolved: 3,
                bonus_per_point: 50.00,
                overdue_tolerance_days: 3,
                min_efficiency_percent: 50,
                target_efficiency_percent: 90
            });
        }

        return NextResponse.json(result.rows[0]);

    } catch (error) {
        console.error('Get KPI Config Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// POST - Update KPI settings
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
        const accessCheck = await query(
            `SELECT 1 FROM clubs WHERE id = $1 AND owner_id = $2`,
            [clubId, userId]
        );

        if ((accessCheck.rowCount || 0) === 0) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const {
            enabled,
            points_per_cleaning,
            points_per_issue_resolved,
            bonus_per_point,
            overdue_tolerance_days,
            min_efficiency_percent,
            target_efficiency_percent
        } = body;

        // Upsert config
        const result = await query(
            `INSERT INTO maintenance_kpi_config (
                club_id, enabled, points_per_cleaning, points_per_issue_resolved, 
                bonus_per_point, overdue_tolerance_days, min_efficiency_percent, target_efficiency_percent
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (club_id) DO UPDATE SET
                enabled = EXCLUDED.enabled,
                points_per_cleaning = EXCLUDED.points_per_cleaning,
                points_per_issue_resolved = EXCLUDED.points_per_issue_resolved,
                bonus_per_point = EXCLUDED.bonus_per_point,
                overdue_tolerance_days = EXCLUDED.overdue_tolerance_days,
                min_efficiency_percent = EXCLUDED.min_efficiency_percent,
                target_efficiency_percent = EXCLUDED.target_efficiency_percent,
                updated_at = CURRENT_TIMESTAMP
            RETURNING *`,
            [
                clubId,
                enabled ?? false,
                points_per_cleaning ?? 1,
                points_per_issue_resolved ?? 3,
                bonus_per_point ?? 50,
                overdue_tolerance_days ?? 3,
                min_efficiency_percent ?? 50,
                target_efficiency_percent ?? 90
            ]
        );

        return NextResponse.json(result.rows[0]);

    } catch (error) {
        console.error('Update KPI Config Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}