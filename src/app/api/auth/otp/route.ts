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

        // Check if user exists and if password is set
        const userResult = await query(
            `SELECT id, password_hash FROM users WHERE phone_number = $1`,
            [normalizedPhone]
        );

        const userExists = (userResult.rowCount ?? 0) > 0;
        const passwordSet = userExists && !!userResult.rows[0].password_hash;

        // Generate 4-digit code
        const code = Math.floor(1000 + Math.random() * 9000).toString();

        // Save to DB
        await query(
            `INSERT INTO verification_codes (phone_number, code) VALUES ($1, $2)`,
            [normalizedPhone, code]
        );

        // In production, send SMS here.
        // For dev, return the code.
        console.log(`[DEV] OTP for ${normalizedPhone}: ${code}`);

        return NextResponse.json({ 
            success: true, 
            debugCode: code,
            userExists,
            requiresPassword: userExists && !passwordSet
        });

    } catch (error) {
        console.error('OTP Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
