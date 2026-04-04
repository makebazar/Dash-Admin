import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { query } from '@/db';
import { hasColumn } from '@/lib/db-compat';
import { ensureOwnerSubscriptionActive } from '@/lib/club-subscription-guard';

export const dynamic = 'force-dynamic';

const normalizeNameToCode = (value: string) =>
    value
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .replace(/_+/g, '_')
        .toUpperCase();

const buildBaseCode = (clubId: string, name: string) => {
    const normalized = normalizeNameToCode(name) || 'CUSTOM_TYPE';
    return `CLUB_${clubId}_${normalized}`;
};

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

async function checkReadAccess(clubId: string, userId: string) {
    return query(
        `SELECT 1 FROM clubs WHERE id = $1 AND owner_id = $2
         UNION
         SELECT 1 FROM club_employees WHERE club_id = $1 AND user_id = $2`,
        [clubId, userId]
    );
}

async function checkWriteAccess(clubId: string, userId: string) {
    return query(
        `SELECT role FROM club_employees WHERE club_id = $1 AND user_id = $2
         UNION
         SELECT 'OWNER' as role FROM clubs WHERE id = $1 AND owner_id = $2`,
        [clubId, userId]
    );
}

async function generateUniqueCode(clubId: string, name: string) {
    const baseCode = buildBaseCode(clubId, name);
    const existing = await query(
        `SELECT code FROM equipment_types WHERE code = $1 OR code LIKE $2`,
        [baseCode, `${baseCode}_%`]
    );

    const usedCodes = new Set(existing.rows.map((row: { code: string }) => row.code));
    if (!usedCodes.has(baseCode)) return baseCode;

    let suffix = 2;
    while (usedCodes.has(`${baseCode}_${suffix}`)) {
        suffix += 1;
    }
    return `${baseCode}_${suffix}`;
}

// GET /api/clubs/[clubId]/equipment-types
export async function GET(
    _request: Request,
    { params }: { params: Promise<{ clubId: string }> }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        const { clubId } = await params;

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const migrationResponse = await ensureClubTypesSupport();
        if (migrationResponse) return migrationResponse;

        const accessCheck = await checkReadAccess(clubId, userId);
        if ((accessCheck.rowCount || 0) === 0) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const result = await query(
            `SELECT code, name, name_ru, default_cleaning_interval, icon, sort_order, club_id, is_system, is_active, created_by, base_type_code
             FROM equipment_types
             WHERE club_id IS NULL OR club_id = $1
             ORDER BY
                CASE WHEN club_id = $1 THEN 0 ELSE 1 END,
                is_active DESC,
                sort_order,
                name_ru`,
            [clubId]
        );

        return NextResponse.json(result.rows);
    } catch (error) {
        console.error('Get Club Equipment Types Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// POST /api/clubs/[clubId]/equipment-types
export async function POST(
    request: Request,
    { params }: { params: Promise<{ clubId: string }> }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        const { clubId } = await params;

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

        const body = await request.json();
        const nameRu = String(body.name_ru || '').trim();
        const icon = String(body.icon || 'wrench').trim() || 'wrench';
        const name = String(body.name || nameRu).trim() || nameRu;
        const defaultCleaningInterval = Number.parseInt(String(body.default_cleaning_interval || 30), 10) || 30;
        const baseTypeCode = body.base_type_code ? String(body.base_type_code) : null;

        if (!nameRu) {
            return NextResponse.json({ error: 'Название типа обязательно' }, { status: 400 });
        }

        const generatedCode = await generateUniqueCode(clubId, nameRu);

        const sortOrderResult = await query(
            `SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_sort_order
             FROM equipment_types
             WHERE club_id = $1`,
            [clubId]
        );

        const result = await query(
            `INSERT INTO equipment_types (
                code, name, name_ru, default_cleaning_interval, icon, sort_order,
                club_id, is_system, is_active, created_by, base_type_code
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE, TRUE, $8, $9)
             RETURNING code, name, name_ru, default_cleaning_interval, icon, sort_order, club_id, is_system, is_active, created_by, base_type_code`,
            [
                generatedCode,
                name,
                nameRu,
                defaultCleaningInterval,
                icon,
                sortOrderResult.rows[0]?.next_sort_order || 100,
                clubId,
                userId,
                baseTypeCode,
            ]
        );

        return NextResponse.json(result.rows[0], { status: 201 });
    } catch (error) {
        console.error('Create Club Equipment Type Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
