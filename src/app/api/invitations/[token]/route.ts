import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';
import { verifySessionValue } from '@/lib/session';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ token: string }> }
) {
    try {
        const { token } = await params;

        const result = await query(
            `SELECT i.id, i.role, i.role_id, i.token, i.invitation_type, i.max_uses, i.uses_count, i.expires_at, i.email,
                    c.id as club_id, c.name as club_name, c.address as club_address
             FROM club_invitations i
             JOIN clubs c ON i.club_id = c.id
             WHERE i.token = $1`,
            [token]
        );

        if (result.rowCount === 0) {
            return NextResponse.json({ error: 'Приглашение не найдено' }, { status: 404 });
        }

        const inv = result.rows[0];

        const isExpired = inv.expires_at && new Date(inv.expires_at) < new Date();
        const isExhausted = inv.max_uses !== null && inv.uses_count >= inv.max_uses;

        if (isExpired) {
            return NextResponse.json({ error: 'Срок действия приглашения истёк' }, { status: 410 });
        }

        if (isExhausted) {
            return NextResponse.json({ error: 'Лимит регистраций по этой ссылке исчерпан' }, { status: 410 });
        }

        // Check if user is currently logged in
        const cookieStore = await cookies();
        const signedCookie = cookieStore.get('session_user_id')?.value;
        const currentUserId = signedCookie ? verifySessionValue(signedCookie) : null;

        let currentUser = null;
        if (currentUserId) {
            const userRes = await query(`SELECT id, full_name, email, phone_number FROM users WHERE id = $1`, [currentUserId]);
            if ((userRes.rowCount ?? 0) > 0) {
                currentUser = userRes.rows[0];
            }
        }

        return NextResponse.json({
            valid: true,
            role: inv.role,
            role_id: inv.role_id,
            club_id: inv.club_id,
            club_name: inv.club_name,
            club_address: inv.club_address,
            email: inv.email,
            currentUser
        });

    } catch (error) {
        console.error('Get invitation token error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// ACCEPT INVITATION FOR ALREADY LOGGED IN USER
export async function POST(
    request: Request,
    { params }: { params: Promise<{ token: string }> }
) {
    try {
        const { token } = await params;

        const cookieStore = await cookies();
        const signedCookie = cookieStore.get('session_user_id')?.value;
        const currentUserId = signedCookie ? verifySessionValue(signedCookie) : null;

        if (!currentUserId) {
            return NextResponse.json({ error: 'Необходима авторизация' }, { status: 401 });
        }

        const inviteQuery = await query(
            `SELECT id, club_id, role, role_id, invitation_type, max_uses, uses_count, expires_at 
             FROM club_invitations WHERE token = $1`,
            [token]
        );

        if (inviteQuery.rowCount === 0) {
            return NextResponse.json({ error: 'Приглашение не найдено' }, { status: 404 });
        }

        const inv = inviteQuery.rows[0];
        const isExpired = inv.expires_at && new Date(inv.expires_at) < new Date();
        const isExhausted = inv.max_uses !== null && inv.uses_count >= inv.max_uses;

        if (isExpired || isExhausted) {
            return NextResponse.json({ error: 'Ссылка недействительна или лимит исчерпан' }, { status: 410 });
        }

        // Add user as employee to target club
        await query(
            `INSERT INTO club_employees (club_id, user_id, role, is_active)
             VALUES ($1, $2, $3, TRUE)
             ON CONFLICT (club_id, user_id) DO UPDATE SET role = EXCLUDED.role, is_active = TRUE`,
            [inv.club_id, currentUserId, inv.role]
        );

        // Increment invitation usages count
        await query(
            `UPDATE club_invitations SET uses_count = uses_count + 1 WHERE id = $1`,
            [inv.id]
        );

        return NextResponse.json({ success: true, club_id: inv.club_id });
    } catch (error) {
        console.error('Accept invitation error:', error);
        return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 });
    }
}
