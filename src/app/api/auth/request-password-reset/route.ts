import { NextResponse } from 'next/server';
import { query } from '@/db';
import { normalizePhone } from '@/lib/phone-utils';
import { sendOtpEmail } from '@/lib/email';

function maskEmail(email: string): string {
    const [name, domain] = email.split('@');
    if (!name || !domain) return email;
    if (name.length <= 2) {
        return `${name[0]}***@${domain}`;
    }
    return `${name[0]}***${name[name.length - 1]}@${domain}`;
}

export async function POST(request: Request) {
    try {
        const { phoneNumber } = await request.json();

        if (!phoneNumber) {
            return NextResponse.json({ error: 'Введите номер телефона' }, { status: 400 });
        }

        const normalizedPhone = normalizePhone(phoneNumber);

        // 1. Find user by phone number
        const userResult = await query(
            `SELECT id, email FROM users WHERE phone_number = $1`,
            [normalizedPhone]
        );

        if ((userResult.rowCount ?? 0) === 0) {
            return NextResponse.json({ error: 'Пользователь с таким номером телефона не найден' }, { status: 404 });
        }

        const user = userResult.rows[0];

        if (!user.email) {
            return NextResponse.json({
                error: 'К вашему аккаунту еще не привязан Email. Обратитесь к управляющему для сброса пароля.'
            }, { status: 400 });
        }

        const userEmail = String(user.email).trim().toLowerCase();
        const maskedEmail = maskEmail(userEmail);

        // 2. Generate 6-digit OTP code
        const code = Math.floor(100000 + Math.random() * 900000).toString();

        // 3. Save code to verification_codes
        await query(
            `INSERT INTO verification_codes (email, code) VALUES ($1, $2)`,
            [userEmail, code]
        );

        // 4. Send email in background
        sendOtpEmail(userEmail, code).catch((err) => {
            console.error('[RESET EMAIL ERROR]', err);
        });

        return NextResponse.json({
            success: true,
            email: userEmail,
            maskedEmail,
            debugCode: process.env.NODE_ENV === 'development' ? code : undefined
        });
    } catch (error) {
        console.error('Request Reset Error:', error);
        return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 });
    }
}
