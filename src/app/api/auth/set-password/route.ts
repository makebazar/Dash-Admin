import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

export async function POST(request: Request) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { password, confirm_password } = await request.json();

        // Validation
        if (!password || !confirm_password) {
            return NextResponse.json({ error: 'Password and confirmation required' }, { status: 400 });
        }

        if (password !== confirm_password) {
            return NextResponse.json({ error: 'Passwords do not match' }, { status: 400 });
        }

        if (password.length < 6) {
            return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
        }

        // Hash password
        const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

        // Update user
        await query(
            `UPDATE users 
       SET password_hash = $1, password_set_at = NOW() 
       WHERE id = $2`,
            [password_hash, userId]
        );

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Set Password Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
