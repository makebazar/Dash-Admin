import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';
import bcrypt from 'bcrypt';

export async function POST(request: Request) {
    try {
        const { email, code, newPassword } = await request.json();

        if (!email || !code || !newPassword) {
            return NextResponse.json({ error: 'Заполните все поля' }, { status: 400 });
        }

        if (String(newPassword).trim().length < 4) {
            return NextResponse.json({ error: 'Пароль должен быть не менее 4 символов' }, { status: 400 });
        }

        if (/[а-яА-ЯёЁ]/.test(newPassword)) {
            return NextResponse.json({ error: 'Пароль не должен содержать русские буквы (кириллицу). Используйте только латинские символы.' }, { status: 400 });
        }

        const normalizedEmail = String(email).trim().toLowerCase();

        // 1. Check code in DB
        const codeResult = await query(
            `SELECT * FROM verification_codes
             WHERE LOWER(email) = $1 AND code = $2 AND expires_at > NOW()
             ORDER BY created_at DESC LIMIT 1`,
            [normalizedEmail, code]
        );

        if (codeResult.rowCount === 0) {
            return NextResponse.json({ error: 'Неверный или истекший код сброса' }, { status: 400 });
        }

        // 2. Find user
        const userResult = await query(
            `SELECT id FROM users WHERE LOWER(email) = $1`,
            [normalizedEmail]
        );

        if ((userResult.rowCount ?? 0) === 0) {
            return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 });
        }

        const userId = userResult.rows[0].id;
        const passwordHash = await bcrypt.hash(String(newPassword).trim(), 10);

        // 3. Update user password
        await query(
            `UPDATE users SET password_hash = $1, email_verified = TRUE WHERE id = $2`,
            [passwordHash, userId]
        );

        // 4. Delete used code
        await query(
            `DELETE FROM verification_codes WHERE LOWER(email) = $1 AND code = $2`,
            [normalizedEmail, code]
        );

        // 5. Set Session Cookie
        const cookieStore = await cookies();
        cookieStore.set('session_user_id', userId, {
            httpOnly: true,
            secure: false,
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 30
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Reset Password Error:', error);
        return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 });
    }
}
