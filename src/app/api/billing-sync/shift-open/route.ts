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
            cash_start
        } = body;

        const targetClubId = xClubId ? parseInt(xClubId) : club_id;

        if (!targetClubId) {
            return NextResponse.json({ error: 'club_id is required' }, { status: 400 });
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

        // Verify API key
        if (clubApiKey && apiKey !== clubApiKey && apiKey !== process.env.DASHADMIN_SYNC_KEY) {
            return NextResponse.json({ error: 'Forbidden: invalid API key' }, { status: 403 });
        }

        // Lookup employee by phone number
        let adminId = club.owner_id;
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

        // Auto-detect shift type (DAY/NIGHT)
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

        // 1. Force close any existing open shifts in DashAdmin for this club
        await query(
            `UPDATE shifts 
             SET status = 'CLOSED', check_out = NOW() 
             WHERE club_id = $1 AND status = 'ACTIVE'`,
            [targetClubId]
        );

        // 2. Insert new OPEN shift in DashAdmin
        const newShiftRes = await query(
            `INSERT INTO shifts (
                user_id,
                club_id,
                check_in,
                status,
                cash_income,
                card_income,
                expenses,
                report_data,
                shift_type
             ) VALUES ($1, $2, $3, 'ACTIVE', 0, 0, 0, $4, $5)
             RETURNING id`,
            [
                adminId,
                targetClubId,
                opened_at ? new Date(opened_at) : new Date(),
                JSON.stringify({ cash_start: cash_start || 0 }),
                shiftType
            ]
        );

        return NextResponse.json({
            success: true,
            shift_id: newShiftRes.rows[0].id,
            message: 'Shift opened and synchronized successfully'
        });

    } catch (error) {
        console.error('Billing Sync Shift Open Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
