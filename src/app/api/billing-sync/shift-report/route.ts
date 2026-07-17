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
            staff_phone,
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
        let adminId = club.owner_id;

        // Try to look up user by phone number (robust matching on the last 10 digits)
        if (staff_phone) {
            const cleanPhone = staff_phone.trim().replace(/\D/g, '');
            if (cleanPhone.length >= 10) {
                const userRes = await query(
                    `SELECT u.id 
                     FROM users u
                     JOIN club_employees ce ON ce.user_id = u.id
                     WHERE ce.club_id = $1 AND RIGHT(u.phone_number, 10) = RIGHT($2, 10)
                     LIMIT 1`,
                    [targetClubId, cleanPhone]
                );
                if (userRes.rows && userRes.rows.length > 0) {
                    adminId = userRes.rows[0].id;
                }
            }
        }

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

        const reportId = reportRes.rows[0].id;

        // Auto-detect shift type based on opened_at hour in club timezone
        let shiftType = 'DAY';
        const clubSettingsRes = await query(
            `SELECT day_start_hour, night_start_hour, timezone FROM clubs WHERE id = $1`,
            [targetClubId]
        );
        if (clubSettingsRes.rows && clubSettingsRes.rows.length > 0) {
            const dayStartHour = clubSettingsRes.rows[0].day_start_hour ?? 8;
            const nightStartHour = clubSettingsRes.rows[0].night_start_hour ?? 20;
            const clubTimezone = clubSettingsRes.rows[0].timezone || 'Europe/Moscow';
            
            const checkInDate = opened_at ? new Date(opened_at) : new Date();
            const timeFormatter = new Intl.DateTimeFormat("en-US", {
                timeZone: clubTimezone,
                hour: "numeric",
                minute: "numeric",
                hourCycle: "h23",
            });
            try {
                const timeParts = timeFormatter.formatToParts(checkInDate);
                const hourStr = timeParts.find((p) => p.type === "hour")?.value || "0";
                const hour = parseInt(hourStr);
                if (dayStartHour < nightStartHour) {
                    if (hour >= dayStartHour && hour < nightStartHour) {
                        shiftType = 'DAY';
                    } else {
                        shiftType = 'NIGHT';
                    }
                } else {
                    if (hour >= dayStartHour || hour < nightStartHour) {
                        shiftType = 'DAY';
                    } else {
                        shiftType = 'NIGHT';
                    }
                }
            } catch (err) {
                console.error('Error determining shift type:', err);
            }
        }

        const incomingReportData = typeof body.report_data === 'string' 
            ? JSON.parse(body.report_data) 
            : (body.report_data || {});

        const reportData = {
            cash_income: revenue_cash || 0,
            card_income: revenue_card || 0,
            expenses: total_expenses || 0,
            total_revenue: total_revenue || 0,
            expected_cash: expected_cash || 0,
            actual_cash: actual_cash || 0,
            cash_diff: cash_diff || 0,
            ...incomingReportData
        };

        // Try to update an existing open shift for this club
        const openShiftRes = await query(
            `SELECT id FROM shifts WHERE club_id = $1 AND status = 'ACTIVE' ORDER BY check_in DESC LIMIT 1`,
            [targetClubId]
        );

        if (openShiftRes.rows && openShiftRes.rows.length > 0) {
            const openShiftId = openShiftRes.rows[0].id;
            await query(
                `UPDATE shifts 
                 SET check_out = $1,
                     status = 'CLOSED',
                     shift_report_id = $2,
                     cash_income = $3,
                     card_income = $4,
                     expenses = $5,
                     report_comment = $6,
                     report_data = $7,
                     user_id = $8
                 WHERE id = $9`,
                [
                    closed_at ? new Date(closed_at) : new Date(),
                    reportId,
                    revenue_cash || 0,
                    revenue_card || 0,
                    total_expenses || 0,
                    notes || `Смена закрыта локальным сотрудником: ${staff_name || 'Не указан'}`,
                    JSON.stringify(reportData),
                    adminId,
                    openShiftId
                ]
            );
        } else {
            // Fallback: Create shift record in DashAdmin if no open shift was found
            await query(
                `INSERT INTO shifts (
                    user_id,
                    club_id,
                    check_in,
                    check_out,
                    status,
                    shift_report_id,
                    cash_income,
                    card_income,
                    expenses,
                    report_comment,
                    report_data,
                    shift_type
                 ) VALUES ($1, $2, $3, $4, 'CLOSED', $5, $6, $7, $8, $9, $10, $11)`,
                [
                    adminId,
                    targetClubId,
                    opened_at ? new Date(opened_at) : new Date(),
                    closed_at ? new Date(closed_at) : new Date(),
                    reportId,
                    revenue_cash || 0,
                    revenue_card || 0,
                    total_expenses || 0,
                    notes || `Смена закрыта локальным сотрудником: ${staff_name || 'Не указан'}`,
                    JSON.stringify(reportData),
                    shiftType
                ]
            );
        }

        return NextResponse.json({
            success: true,
            shift_report_id: reportId,
            message: 'Shift report synchronized successfully'
        });

    } catch (error) {
        console.error('Billing Sync Shift Report Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
