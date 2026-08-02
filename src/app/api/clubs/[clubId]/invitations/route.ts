import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';
import { verifySessionValue } from '@/lib/session';
import crypto from 'crypto';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ clubId: string }> }
) {
    try {
        const { clubId } = await params;
        const signedCookie = (await cookies()).get('session_user_id')?.value;
        const userId = signedCookie ? verifySessionValue(signedCookie) : null;

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const result = await query(
            `SELECT id, role, role_id, token, invitation_type, max_uses, uses_count, email, expires_at, created_at
             FROM club_invitations
             WHERE club_id = $1
             ORDER BY created_at DESC`,
            [clubId]
        );

        return NextResponse.json({ invitations: result.rows });
    } catch (error) {
        console.error('Get invitations error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ clubId: string }> }
) {
    try {
        const { clubId } = await params;
        const signedCookie = (await cookies()).get('session_user_id')?.value;
        const userId = signedCookie ? verifySessionValue(signedCookie) : null;

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { role, role_id, invitation_type, max_uses, email, days_valid } = body;

        let roleName = role;
        let roleId = role_id ? parseInt(role_id, 10) : null;

        if (roleId && !roleName) {
            const roleRes = await query(`SELECT name FROM roles WHERE id = $1`, [roleId]);
            if (roleRes.rowCount && roleRes.rowCount > 0) {
                roleName = roleRes.rows[0].name;
            }
        }

        if (!roleName) {
            return NextResponse.json({ error: 'Укажите роль для приглашения' }, { status: 400 });
        }

        const token = 'inv_' + crypto.randomBytes(16).toString('hex');
        const type = invitation_type === 'single' ? 'single' : 'multi';
        const limitUses = type === 'single' ? 1 : (max_uses ? parseInt(max_uses, 10) : 100);

        let expiresAt = null;
        if (days_valid && parseInt(days_valid, 10) > 0) {
            const date = new Date();
            date.setDate(date.getDate() + parseInt(days_valid, 10));
            expiresAt = date.toISOString();
        }

        const result = await query(
            `INSERT INTO club_invitations 
             (club_id, role, role_id, token, invitation_type, max_uses, email, expires_at, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING id, token, role, role_id, invitation_type, max_uses, uses_count, expires_at, created_at`,
            [clubId, roleName, roleId, token, type, limitUses, email || null, expiresAt, userId]
        );

        return NextResponse.json({
            success: true,
            invitation: result.rows[0]
        });
    } catch (error) {
        console.error('Create invitation error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ clubId: string }> }
) {
    try {
        const { clubId } = await params;
        const signedCookie = (await cookies()).get('session_user_id')?.value;
        const userId = signedCookie ? verifySessionValue(signedCookie) : null;

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const invitationId = searchParams.get('id');

        if (!invitationId) {
            return NextResponse.json({ error: 'Укажите ID приглашения' }, { status: 400 });
        }

        await query(
            `DELETE FROM club_invitations WHERE id = $1 AND club_id = $2`,
            [invitationId, clubId]
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Delete invitation error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
