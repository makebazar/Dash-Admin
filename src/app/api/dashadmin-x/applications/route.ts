import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';
import { verifySessionValue } from '@/lib/session';

export async function GET() {
    try {
        const signedCookie = (await cookies()).get('session_user_id')?.value;
        const userId = signedCookie ? verifySessionValue(signedCookie) : null;

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Check if super admin
        const userRes = await query(`SELECT is_super_admin FROM users WHERE id = $1`, [userId]);
        if (!userRes.rows[0]?.is_super_admin) {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        const result = await query(
            `SELECT id, full_name, phone_number, email, club_name, city, comment, status, reviewed_at, created_at
             FROM registration_applications
             ORDER BY created_at DESC`
        );

        return NextResponse.json({ applications: result.rows });
    } catch (error) {
        console.error('Get applications error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    try {
        const signedCookie = (await cookies()).get('session_user_id')?.value;
        const userId = signedCookie ? verifySessionValue(signedCookie) : null;

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userRes = await query(`SELECT is_super_admin FROM users WHERE id = $1`, [userId]);
        if (!userRes.rows[0]?.is_super_admin) {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        const { id, status } = await request.json();
        if (!id || !['approved', 'rejected', 'pending'].includes(status)) {
            return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
        }

        await query(
            `UPDATE registration_applications 
             SET status = $1, reviewed_at = NOW() 
             WHERE id = $2`,
            [status, id]
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Update application error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
