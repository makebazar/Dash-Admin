import { NextResponse } from 'next/server';
import { query } from '@/db';
import { normalizePhone } from '@/lib/phone-utils';

export async function POST(request: Request) {
    try {
        const { phoneNumber } = await request.json();

        if (!phoneNumber) {
            return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
        }

        const normalizedPhone = normalizePhone(phoneNumber);

        const userResult = await query(
            `SELECT id FROM users WHERE phone_number = $1`,
            [normalizedPhone]
        );

        if ((userResult.rowCount ?? 0) === 0) {
            return NextResponse.json({ error: 'Пользователь с таким номером не найден' }, { status: 404 });
        }

        const code = Math.floor(1000 + Math.random() * 9000).toString();

        await query(
            `INSERT INTO verification_codes (phone_number, code) VALUES ($1, $2)`,
            [normalizedPhone, code]
        );

        console.log(`[DEV] Password reset OTP for ${normalizedPhone}: ${code}`);

        return NextResponse.json({
            success: true,
            debugCode: code,
        });
    } catch (error) {
        console.error('Password Reset Request Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
