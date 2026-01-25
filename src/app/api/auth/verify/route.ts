import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';
import bcrypt from 'bcrypt';
import { normalizePhone } from '@/lib/phone-utils';

export async function POST(request: Request) {
    try {
        const { phoneNumber, code, password } = await request.json();

        if (!phoneNumber) {
            return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
        }

        const normalizedPhone = normalizePhone(phoneNumber);

        let userId;
        let isNewUser = false;

        // Password login flow
        if (password) {
            const userResult = await query(
                `SELECT id, password_hash FROM users WHERE phone_number = $1`,
                [normalizedPhone]
            );

            if (userResult.rowCount === 0) {
                return NextResponse.json({ error: 'User not found' }, { status: 404 });
            }

            const user = userResult.rows[0];

            if (!user.password_hash) {
                return NextResponse.json({ error: 'Password not set. Please use OTP login.' }, { status: 400 });
            }

            const isValid = await bcrypt.compare(password, user.password_hash);

            if (!isValid) {
                return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
            }

            userId = user.id;
        }
        // OTP login flow
        else if (code) {
            // 1. Verify Code
            const result = await query(
                `SELECT * FROM verification_codes 
         WHERE phone_number = $1 AND code = $2 AND expires_at > NOW() 
         ORDER BY created_at DESC LIMIT 1`,
                [normalizedPhone, code]
            );

            if (result.rowCount === 0) {
                return NextResponse.json({ error: 'Invalid or expired code' }, { status: 400 });
            }

            // 2. Check/Create User
            let userResult = await query(
                `SELECT * FROM users WHERE phone_number = $1`,
                [normalizedPhone]
            );

            if (userResult.rowCount === 0) {
                // Create new user
                const newUser = await query(
                    `INSERT INTO users (full_name, phone_number) 
           VALUES ($1, $2) RETURNING id`,
                    ['New User', normalizedPhone]
                );

                userId = newUser.rows[0].id;
                isNewUser = true;
            } else {
                userId = userResult.rows[0].id;
            }

            // Delete used code
            await query(
                `DELETE FROM verification_codes WHERE phone_number = $1 AND code = $2`,
                [normalizedPhone, code]
            );
        } else {
            return NextResponse.json({ error: 'Either code or password is required' }, { status: 400 });
        }

        // 3. Set Session Cookie
        const cookieStore = await cookies();
        cookieStore.set('session_user_id', userId, {
            httpOnly: true,
            // TODO: Enable secure when HTTPS is configured
            secure: false,  // Was: process.env.NODE_ENV === 'production'
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 30 // 30 days
        });

        return NextResponse.json({ success: true, isNewUser });

    } catch (error) {
        console.error('Verify Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
