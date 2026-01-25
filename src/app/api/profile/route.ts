import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';

export async function GET() {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const result = await query(
            `SELECT id, full_name, phone_number, subscription_plan, subscription_started_at, subscription_ends_at, password_hash 
       FROM users WHERE id = $1`,
            [userId]
        );

        if (result.rowCount === 0) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const user = result.rows[0];

        return NextResponse.json({
            user: {
                id: user.id,
                full_name: user.full_name,
                phone_number: user.phone_number,
                subscription_plan: user.subscription_plan,
                subscription_started_at: user.subscription_started_at,
                subscription_ends_at: user.subscription_ends_at,
                hasPassword: !!user.password_hash
            }
        });
    } catch (error) {
        console.error('Get Profile Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { full_name } = await request.json();

        if (!full_name || full_name.trim().length === 0) {
            return NextResponse.json({ error: 'Name is required' }, { status: 400 });
        }

        await query(
            `UPDATE users SET full_name = $1 WHERE id = $2`,
            [full_name.trim(), userId]
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Update Profile Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
