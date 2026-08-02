import { NextResponse } from 'next/server';
import { query } from '@/db';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { full_name, phone_number, email, club_name, city, comment } = body;

        if (!full_name || !email) {
            return NextResponse.json({ error: 'Пожалуйста, укажите имя и Email' }, { status: 400 });
        }

        const normalizedEmail = String(email).trim().toLowerCase();

        const result = await query(
            `INSERT INTO registration_applications 
             (full_name, phone_number, email, club_name, city, comment, status)
             VALUES ($1, $2, $3, $4, $5, $6, 'pending')
             RETURNING id, created_at`,
            [full_name, phone_number || null, normalizedEmail, club_name || null, city || null, comment || null]
        );

        console.log(`[NEW REGISTRATION APPLICATION] ID: ${result.rows[0].id}, Email: ${normalizedEmail}`);

        return NextResponse.json({
            success: true,
            id: result.rows[0].id,
            message: 'Заявка успешно отправлена! Мы свяжемся с вами в ближайшее время.'
        });

    } catch (error) {
        console.error('Submit application error:', error);
        return NextResponse.json({ error: 'Не удалось отправить заявку' }, { status: 500 });
    }
}
