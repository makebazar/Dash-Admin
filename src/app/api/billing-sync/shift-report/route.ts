import { NextResponse } from 'next/server';
import { query } from '@/db';

export async function POST(request: Request) {
    try {
        const authHeader = request.headers.get('Authorization');
        const xClubId = request.headers.get('X-Club-Id');

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized: missing or invalid Authorization header' }, { status: 401 });
        }

        const apiKey = authHeader.substring(7);
        const body = await request.json();
        const {
            club_id,
            staff_name,
            opened_at,
            closed_at,
            revenue_cash,
            revenue_card,
            total_revenue,
            total_expenses,
            expected_cash,
            actual_cash,
            cash_diff,
            notes
        } = body;

        const targetClubId = xClubId ? parseInt(xClubId) : club_id;

        if (!targetClubId) {
            return NextResponse.json({ error: 'club_id is required in body or X-Club-Id header' }, { status: 400 });
        }

        // Fetch club details to verify API Key
        const clubRes = await query(
            `SELECT owner_id, inventory_settings FROM clubs WHERE id = $1`,
            [targetClubId]
        );

        if (!clubRes.rows || clubRes.rows.length === 0) {
            return NextResponse.json({ error: 'Club not found' }, { status: 404 });
        }

        const club = clubRes.rows[0];
        const clubApiKey = club.inventory_settings?.api_key || process.env.DASHADMIN_SYNC_KEY;

        // Verify API key (allow fallback to internal environment sync key for ease of configuration)
        if (clubApiKey && apiKey !== clubApiKey && apiKey !== process.env.DASHADMIN_SYNC_KEY) {
            return NextResponse.json({ error: 'Forbidden: invalid API key' }, { status: 403 });
        }

        // opened_by_admin_id is a required field. We use the club owner_id as fallback
        const adminId = club.owner_id;

        // Insert shift report into database
        const reportRes = await query(
            `INSERT INTO shift_reports (
                club_id,
                opened_by_admin_id,
                closed_by_admin_id,
                opened_at,
                closed_at,
                revenue_cash,
                revenue_card,
                total_revenue,
                total_expenses,
                expected_balance,
                actual_balance,
                diff_balance,
                admin_comment,
                status
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'CLOSED')
             RETURNING id`,
            [
                targetClubId,
                adminId,
                adminId,
                opened_at ? new Date(opened_at) : new Date(),
                closed_at ? new Date(closed_at) : new Date(),
                revenue_cash || 0,
                revenue_card || 0,
                total_revenue || 0,
                total_expenses || 0,
                expected_cash || 0,
                actual_cash || 0,
                cash_diff || 0,
                notes || `Смена закрыта локальным сотрудником: ${staff_name || 'Не указан'}`
            ]
        );

        return NextResponse.json({
            success: true,
            shift_report_id: reportRes.rows[0].id,
            message: 'Shift report synchronized successfully'
        });

    } catch (error) {
        console.error('Billing Sync Shift Report Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
