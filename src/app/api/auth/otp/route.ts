import { NextResponse } from 'next/server';
import { query } from '@/db';
import { normalizePhone } from '@/lib/phone-utils';
import { sendOtpEmail } from '@/lib/email';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { email, phoneNumber, inviteToken, bindOnly } = body;

        // EMAIL OTP FLOW
        if (email) {
            const normalizedEmail = String(email).trim().toLowerCase();

            if (!normalizedEmail || !normalizedEmail.includes('@')) {
                return NextResponse.json({ error: 'Введите корректный Email' }, { status: 400 });
            }

            // 1. Check if user exists
            const userResult = await query(
                `SELECT id, password_hash, email_verified FROM users WHERE LOWER(email) = $1`,
                [normalizedEmail]
            );

            const userExists = (userResult.rowCount ?? 0) > 0;

            // 2. Check if valid invite token was provided
            let isValidInvite = false;
            if (inviteToken) {
                const inviteResult = await query(
                    `SELECT id, max_uses, uses_count, expires_at FROM club_invitations WHERE token = $1`,
                    [inviteToken]
                );
                if ((inviteResult.rowCount ?? 0) > 0) {
                    const inv = inviteResult.rows[0];
                    const isExpired = inv.expires_at && new Date(inv.expires_at) < new Date();
                    const isExhausted = inv.max_uses !== null && inv.uses_count >= inv.max_uses;
                    if (!isExpired && !isExhausted) {
                        isValidInvite = true;
                    }
                }
            }

            // 3. If user does NOT exist, no valid invite token, and NOT binding to existing session -> block registration
            if (!userExists && !isValidInvite && !bindOnly) {
                return NextResponse.json({
                    success: false,
                    registrationClosed: true,
                    error: 'Пользователь с таким Email не найден. Публичная регистрация закрыта.'
                });
            }

            // 4. Generate 6-digit OTP code
            const code = Math.floor(100000 + Math.random() * 900000).toString();

            // Check if user exists when resetOnly is requested
            if (body.resetOnly) {
                const existing = await query(`SELECT id FROM users WHERE LOWER(email) = $1`, [normalizedEmail]);
                if ((existing.rowCount ?? 0) === 0) {
                    return NextResponse.json({ error: 'Пользователь с таким Email не найден' }, { status: 404 });
                }
            }

            // 5. Save code to DB
            await query(
                `INSERT INTO verification_codes (email, code) VALUES ($1, $2)`,
                [normalizedEmail, code]
            );

            // 6. Send OTP Email asynchronously in background so response returns instantly
            sendOtpEmail(normalizedEmail, code).catch(err => {
                console.error('[BACKGROUND EMAIL ERROR]', err);
            });

            return NextResponse.json({
                success: true,
                debugCode: process.env.NODE_ENV === 'development' ? code : undefined,
                userExists,
                isValidInvite
            });
        }

        // PHONE OTP FLOW (legacy fallback)
        if (phoneNumber) {
            const normalizedPhone = normalizePhone(phoneNumber);

            const userResult = await query(
                `SELECT id, password_hash FROM users WHERE phone_number = $1`,
                [normalizedPhone]
            );

            const userExists = (userResult.rowCount ?? 0) > 0;
            const passwordSet = userExists && !!userResult.rows[0].password_hash;

            const code = Math.floor(1000 + Math.random() * 9000).toString();

            await query(
                `INSERT INTO verification_codes (phone_number, code) VALUES ($1, $2)`,
                [normalizedPhone, code]
            );

            console.log(`[DEV] OTP for ${normalizedPhone}: ${code}`);

            return NextResponse.json({
                success: true,
                debugCode: code,
                userExists,
                requiresPassword: userExists && !passwordSet
            });
        }

        return NextResponse.json({ error: 'Укажите Email или номер телефона' }, { status: 400 });

    } catch (error) {
        console.error('OTP Error:', error);
        return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 });
    }
}
