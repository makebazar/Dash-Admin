import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';
import bcrypt from 'bcrypt';
import { normalizePhone } from '@/lib/phone-utils';
import { verifySessionValue } from '@/lib/session';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { email, phoneNumber, code, password, inviteToken, fullName, bindToCurrentSession } = body;

        let userId: string | null = null;
        let isNewUser = false;

        // 1. BIND EMAIL TO CURRENT LOGGED-IN SESSION (For existing accounts binding a new email)
        if (email && code && bindToCurrentSession) {
            const cookieStore = await cookies();
            const signedCookie = cookieStore.get('session_user_id')?.value;
            const currentUserId = signedCookie ? verifySessionValue(signedCookie) : null;

            if (!currentUserId) {
                return NextResponse.json({ error: 'Необходима авторизация' }, { status: 401 });
            }

            const normalizedEmail = String(email).trim().toLowerCase();

            // Verify Code in DB
            const codeResult = await query(
                `SELECT * FROM verification_codes
                 WHERE LOWER(email) = $1 AND code = $2 AND expires_at > NOW()
                 ORDER BY created_at DESC LIMIT 1`,
                [normalizedEmail, code]
            );

            if (codeResult.rowCount === 0) {
                return NextResponse.json({ error: 'Неверный или истекший код подтверждения' }, { status: 400 });
            }

            // Check if email already used by someone else
            const existing = await query(`SELECT id FROM users WHERE LOWER(email) = $1 AND id != $2`, [normalizedEmail, currentUserId]);
            if ((existing.rowCount ?? 0) > 0) {
                return NextResponse.json({ error: 'Этот Email уже привязан к другому аккаунту' }, { status: 400 });
            }

            // Bind email to existing user
            await query(`UPDATE users SET email = $1, email_verified = TRUE WHERE id = $2`, [normalizedEmail, currentUserId]);

            // Delete code
            await query(`DELETE FROM verification_codes WHERE LOWER(email) = $1 AND code = $2`, [normalizedEmail, code]);

            return NextResponse.json({ success: true });
        }

        // 2. EMAIL + PASSWORD LOGIN (Direct password auth via email)
        if (email && password && !code) {
            const normalizedEmail = String(email).trim().toLowerCase();
            const userResult = await query(
                `SELECT id, password_hash FROM users WHERE LOWER(email) = $1`,
                [normalizedEmail]
            );

            if (userResult.rowCount === 0) {
                return NextResponse.json({ error: 'Пользователь с таким Email не найден' }, { status: 404 });
            }

            const user = userResult.rows[0];
            if (!user.password_hash) {
                return NextResponse.json({ error: 'Пароль не задан. Запросите код для входа.' }, { status: 400 });
            }

            const isValid = await bcrypt.compare(password, user.password_hash);
            if (!isValid) {
                return NextResponse.json({ error: 'Неверный пароль' }, { status: 401 });
            }

            userId = user.id;
        }

        // 3. REGULAR EMAIL OTP VERIFICATION FLOW
        else if (email && code) {
            const normalizedEmail = String(email).trim().toLowerCase();

            // Verify Code in DB
            const codeResult = await query(
                `SELECT * FROM verification_codes
                 WHERE LOWER(email) = $1 AND code = $2 AND expires_at > NOW()
                 ORDER BY created_at DESC LIMIT 1`,
                [normalizedEmail, code]
            );

            if (codeResult.rowCount === 0) {
                return NextResponse.json({ error: 'Неверный или истекший код подтверждения' }, { status: 400 });
            }

            // Check if user already exists
            const userResult = await query(
                `SELECT id, full_name, email FROM users WHERE LOWER(email) = $1`,
                [normalizedEmail]
            );

            if ((userResult.rowCount ?? 0) > 0) {
                userId = userResult.rows[0].id;
                await query(`UPDATE users SET email_verified = TRUE WHERE id = $1`, [userId]);
            } else {
                // User doesn't exist -> Register via invite
                let validInvite: any = null;
                if (inviteToken) {
                    const inviteQuery = await query(
                        `SELECT id, club_id, role, role_id, invitation_type, max_uses, uses_count, expires_at 
                         FROM club_invitations WHERE token = $1`,
                        [inviteToken]
                    );
                    if ((inviteQuery.rowCount ?? 0) > 0) {
                        const inv = inviteQuery.rows[0];
                        const isExpired = inv.expires_at && new Date(inv.expires_at) < new Date();
                        const isExhausted = inv.max_uses !== null && inv.uses_count >= inv.max_uses;
                        if (!isExpired && !isExhausted) {
                            validInvite = inv;
                        }
                    }
                }

                if (!validInvite) {
                    return NextResponse.json({
                        error: 'Регистрация закрыта. Аккаунт не найден и ссылка-приглашение недействительна.'
                    }, { status: 403 });
                }

                const userName = fullName || 'Новый сотрудник';
                const normalizedPhone = phoneNumber ? normalizePhone(phoneNumber) : null;
                let passwordHash: string | null = null;
                if (password && String(password).trim().length >= 4) {
                    passwordHash = await bcrypt.hash(String(password).trim(), 10);
                }

                const newUserResult = await query(
                    `INSERT INTO users (full_name, email, email_verified, role_id, phone_number, password_hash)
                     VALUES ($1, $2, TRUE, $3, $4, $5) RETURNING id`,
                    [userName, normalizedEmail, validInvite.role_id || null, normalizedPhone, passwordHash]
                );

                userId = newUserResult.rows[0].id;
                isNewUser = true;
            }

            // Delete verification code
            await query(
                `DELETE FROM verification_codes WHERE LOWER(email) = $1 AND code = $2`,
                [normalizedEmail, code]
            );
        }

        // 4. PHONE VERIFICATION & PASSWORD LOGIN FLOW
        else if (phoneNumber) {
            const normalizedPhone = normalizePhone(phoneNumber);

            if (password) {
                const userResult = await query(
                    `SELECT id, password_hash FROM users WHERE phone_number = $1`,
                    [normalizedPhone]
                );

                if (userResult.rowCount === 0) {
                    return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 });
                }

                const user = userResult.rows[0];

                if (!user.password_hash) {
                    return NextResponse.json({ error: 'Пароль не задан. Используйте вход по коду из Email.' }, { status: 400 });
                }

                const isValid = await bcrypt.compare(password, user.password_hash);
                if (!isValid) {
                    return NextResponse.json({ error: 'Неверный пароль' }, { status: 401 });
                }

                userId = user.id;
            } else if (code) {
                const result = await query(
                    `SELECT * FROM verification_codes
                     WHERE phone_number = $1 AND code = $2 AND expires_at > NOW()
                     ORDER BY created_at DESC LIMIT 1`,
                    [normalizedPhone, code]
                );

                if (result.rowCount === 0) {
                    return NextResponse.json({ error: 'Неверный или истекший код' }, { status: 400 });
                }

                const userResult = await query(
                    `SELECT id, password_hash FROM users WHERE phone_number = $1`,
                    [normalizedPhone]
                );

                if (userResult.rowCount === 0) {
                    return NextResponse.json({ error: 'Регистрация закрыта. Пользователь с этим телефоном не найден.' }, { status: 403 });
                } else {
                    userId = userResult.rows[0].id;
                }

                await query(
                    `DELETE FROM verification_codes WHERE phone_number = $1 AND code = $2`,
                    [normalizedPhone, code]
                );
            }
        } else {
            return NextResponse.json({ error: 'Передайте Email или номер телефона' }, { status: 400 });
        }

        if (!userId) {
            return NextResponse.json({ error: 'Ошибка проверки авторизации' }, { status: 400 });
        }

        // Handle inviteToken binding for ANY login method
        if (inviteToken) {
            const inviteQuery = await query(
                `SELECT id, club_id, role, role_id, invitation_type, max_uses, uses_count, expires_at 
                 FROM club_invitations WHERE token = $1`,
                [inviteToken]
            );

            if ((inviteQuery.rowCount ?? 0) > 0) {
                const inv = inviteQuery.rows[0];
                const isExpired = inv.expires_at && new Date(inv.expires_at) < new Date();
                const isExhausted = inv.max_uses !== null && inv.uses_count >= inv.max_uses;

                if (!isExpired && !isExhausted) {
                    await query(
                        `INSERT INTO club_employees (club_id, user_id, role, is_active)
                         VALUES ($1, $2, $3, TRUE)
                         ON CONFLICT (club_id, user_id) DO UPDATE SET role = EXCLUDED.role, is_active = TRUE`,
                        [inv.club_id, userId, inv.role]
                    );

                    await query(
                        `UPDATE club_invitations SET uses_count = uses_count + 1 WHERE id = $1`,
                        [inv.id]
                    );
                }
            }
        }

        // Set Session Cookie
        const cookieStore = await cookies();
        cookieStore.set('session_user_id', userId, {
            httpOnly: true,
            secure: false,
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 30
        });

        return NextResponse.json({ success: true, isNewUser });

    } catch (error) {
        console.error('Verify Error:', error);
        return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 });
    }
}
