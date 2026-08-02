import { NextResponse } from 'next/server';
import { query } from '@/db';
import { normalizePhone } from '@/lib/phone-utils';

function maskEmail(email: string): string {
    const [name, domain] = email.split('@');
    if (!name || !domain) return email;
    if (name.length <= 2) return `${name[0]}***@${domain}`;
    return `${name[0]}***${name[name.length - 1]}@${domain}`;
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ token: string }> }
) {
    try {
        const { phoneNumber } = await request.json();
        if (!phoneNumber) {
            return NextResponse.json({ error: 'Введите номер телефона' }, { status: 400 });
        }

        const normalizedPhone = normalizePhone(phoneNumber);

        const userRes = await query(
            `SELECT id, full_name, email, phone_number FROM users WHERE phone_number = $1`,
            [normalizedPhone]
        );

        if ((userRes.rowCount ?? 0) > 0) {
            const user = userRes.rows[0];
            const userEmail = user.email ? String(user.email).trim().toLowerCase() : null;
            return NextResponse.json({
                userExists: true,
                fullName: user.full_name,
                email: userEmail,
                maskedEmail: userEmail ? maskEmail(userEmail) : null
            });
        }

        return NextResponse.json({ userExists: false });
    } catch (error) {
        console.error('Check Phone Error:', error);
        return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 });
    }
}
