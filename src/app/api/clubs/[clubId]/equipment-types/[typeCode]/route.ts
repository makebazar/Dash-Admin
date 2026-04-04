import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { query } from '@/db';
import { hasColumn } from '@/lib/db-compat';
import { ensureOwnerSubscriptionActive } from '@/lib/club-subscription-guard';

export const dynamic = 'force-dynamic';

async function ensureClubTypesSupport() {
    const supports = await hasColumn('equipment_types', 'club_id');
    if (!supports) {
        return NextResponse.json(
            { error: 'Сначала примените миграцию add_club_custom_equipment_types.sql' },
            { status: 409 }
        );
    }
    return null;
}

async function checkWriteAccess(clubId: string, userId: string) {
    return query(
        `SELECT role FROM club_employees WHERE club_id = $1 AND user_id = $2
         UNION
         SELECT 'OWNER' as role FROM clubs WHERE id = $1 AND owner_id = $2`,
        [clubId, userId]
    );
}

async function ensureEditableType(clubId: string, typeCode: string) {
    const typeResult = await query(
        `SELECT code, club_id, is_system, is_active
         FROM equipment_types
         WHERE code = $1
         LIMIT 1`,
        [typeCode]
    );

    const typeRow = typeResult.rows[0];
    if (!typeRow) {
        return { error: NextResponse.json({ error: 'Тип оборудования не найден' }, { status: 404 }) };
    }

    if (String(typeRow.club_id || '') !== String(clubId) || typeRow.is_system) {
        return { error: NextResponse.json({ error: 'Можно изменять только типы текущего клуба' }, { status: 403 }) };
    }

    return { typeRow };
}

// PATCH /api/clubs/[clubId]/equipment-types/[typeCode]
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ clubId: string; typeCode: string }> }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        const { clubId, typeCode } = await params;

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const migrationResponse = await ensureClubTypesSupport();
        if (migrationResponse) return migrationResponse;

        const guard = await ensureOwnerSubscriptionActive(clubId, userId);
        if (!guard.ok) return guard.response;

        const accessCheck = await checkWriteAccess(clubId, userId);
        const role = accessCheck.rows[0]?.role;
        if (!role || !['OWNER', 'ADMIN'].includes(role)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const editable = await ensureEditableType(clubId, typeCode);
        if (editable.error) return editable.error;

        const body = await request.json();
        const fields: string[] = [];
        const values: any[] = [];
        let index = 1;

        if (body.name_ru !== undefined) {
            const nameRu = String(body.name_ru).trim();
            if (!nameRu) {
                return NextResponse.json({ error: 'Название типа обязательно' }, { status: 400 });
            }
            fields.push(`name_ru = $${index++}`);
            values.push(nameRu);
        }

        if (body.name !== undefined) {
            fields.push(`name = $${index++}`);
            values.push(String(body.name).trim() || String(body.name_ru || '').trim());
        }

        if (body.icon !== undefined) {
            fields.push(`icon = $${index++}`);
            values.push(String(body.icon).trim() || 'wrench');
        }

        if (body.default_cleaning_interval !== undefined) {
            const interval = Number.parseInt(String(body.default_cleaning_interval), 10);
            if (!Number.isFinite(interval) || interval < 1 || interval > 365) {
                return NextResponse.json({ error: 'Интервал должен быть от 1 до 365 дней' }, { status: 400 });
            }
            fields.push(`default_cleaning_interval = $${index++}`);
            values.push(interval);
        }

        if (body.base_type_code !== undefined) {
            fields.push(`base_type_code = $${index++}`);
            values.push(body.base_type_code ? String(body.base_type_code) : null);
        }

        if (body.is_active !== undefined) {
            fields.push(`is_active = $${index++}`);
            values.push(Boolean(body.is_active));
        }

        if (fields.length === 0) {
            return NextResponse.json({ error: 'Нет полей для обновления' }, { status: 400 });
        }

        values.push(typeCode);
        values.push(clubId);

        const result = await query(
            `UPDATE equipment_types
             SET ${fields.join(', ')}
             WHERE code = $${index++} AND club_id = $${index}
             RETURNING code, name, name_ru, default_cleaning_interval, icon, sort_order, club_id, is_system, is_active, created_by, base_type_code`,
            values
        );

        return NextResponse.json(result.rows[0]);
    } catch (error) {
        console.error('Update Club Equipment Type Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// DELETE /api/clubs/[clubId]/equipment-types/[typeCode]
export async function DELETE(
    _request: Request,
    { params }: { params: Promise<{ clubId: string; typeCode: string }> }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        const { clubId, typeCode } = await params;

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const migrationResponse = await ensureClubTypesSupport();
        if (migrationResponse) return migrationResponse;

        const guard = await ensureOwnerSubscriptionActive(clubId, userId);
        if (!guard.ok) return guard.response;

        const accessCheck = await checkWriteAccess(clubId, userId);
        const role = accessCheck.rows[0]?.role;
        if (!role || !['OWNER', 'ADMIN'].includes(role)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const editable = await ensureEditableType(clubId, typeCode);
        if (editable.error) return editable.error;

        const [usageResult, instructionsResult] = await Promise.all([
            query(`SELECT COUNT(*)::int AS count FROM equipment WHERE club_id = $1 AND type = $2`, [clubId, typeCode]),
            query(`SELECT COUNT(*)::int AS count FROM club_equipment_instructions WHERE club_id = $1 AND equipment_type_code = $2`, [clubId, typeCode]),
        ]);

        const equipmentCount = usageResult.rows[0]?.count || 0;
        const instructionsCount = instructionsResult.rows[0]?.count || 0;
        if (equipmentCount > 0 || instructionsCount > 0) {
            return NextResponse.json(
                { error: 'Тип уже используется. Сначала архивируйте его, а не удаляйте.' },
                { status: 409 }
            );
        }

        await query(
            `DELETE FROM equipment_types WHERE code = $1 AND club_id = $2`,
            [typeCode, clubId]
        );

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('Delete Club Equipment Type Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
