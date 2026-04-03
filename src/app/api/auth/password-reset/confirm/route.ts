import { NextResponse } from 'next/server';
import { query } from '@/db';
import bcrypt from 'bcrypt';
import { normalizePhone } from '@/lib/phone-utils';

const SALT_ROUNDS = 10;

export async function POST(request: Request) {
    try {
        const { phoneNumber, code, password, confirm_password } = await request.json();

        if (!phoneNumber || !code || !password || !confirm_password) {
            return NextResponse.json({ error: 'Phone, code and passwords are required' }, { status: 400 });
        }

        if (password !== confirm_password) {
            return NextResponse.json({ error: 'Пароли не совпадают' }, { status: 400 });
        }

        if (password.length < 6) {
            return NextResponse.json({ error: 'Пароль должен быть не менее 6 символов' }, { status: 400 });
        }

        const normalizedPhone = normalizePhone(phoneNumber);

        const verificationResult = await query(
            `SELECT 1
             FROM verification_codes
             WHERE phone_number = $1
               AND code = $2
               AND expires_at > NOW()
             ORDER BY created_at DESC
             LIMIT 1`,
            [normalizedPhone, code]
        );

        if ((verificationResult.rowCount ?? 0) === 0) {
            return NextResponse.json({ error: 'Неверный или просроченный код' }, { status: 400 });
        }

        const userResult = await query(
            `SELECT id FROM users WHERE phone_number = $1`,
            [normalizedPhone]
        );

        if ((userResult.rowCount ?? 0) === 0) {
            return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 });
        }

        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

        await query(
            `UPDATE users
             SET password_hash = $1, password_set_at = NOW()
             WHERE phone_number = $2`,
            [passwordHash, normalizedPhone]
        );

        await query(
            `DELETE FROM verification_codes
             WHERE phone_number = $1`,
            [normalizedPhone]
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Password Reset Confirm Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
