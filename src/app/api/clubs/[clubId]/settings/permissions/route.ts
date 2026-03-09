import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

const AVAILABLE_PERMISSIONS = [
    { key: 'view_dashboard', label: 'Дашборд', category: 'Меню' },
    { key: 'view_shifts', label: 'Смены', category: 'Меню' },
    { key: 'view_schedule', label: 'График работы', category: 'Меню' },
    { key: 'manage_employees', label: 'Сотрудники', category: 'Меню' },
    { key: 'view_salaries', label: 'Зарплаты', category: 'Меню' },
    { key: 'view_finance', label: 'Финансы', category: 'Меню' },
    { key: 'manage_inventory', label: 'Склад', category: 'Меню' },
    { key: 'manage_equipment', label: 'Оборудование', category: 'Меню' },
    { key: 'view_reviews', label: 'Центр проверок', category: 'Меню' },
    
    { key: 'manage_club_settings', label: 'Общие', category: 'Настройки' },
    { key: 'edit_salaries_settings', label: 'Зарплаты (настройки)', category: 'Настройки' },
    { key: 'manage_report_template', label: 'Отчеты', category: 'Настройки' },
    { key: 'manage_checklists', label: 'Чеклисты', category: 'Настройки' }
];

export async function GET(
    request: Request,
    { params }: { params: Promise<{ clubId: string }> }
) {
    try {
        const { clubId } = await params;
        const userId = (await cookies()).get('session_user_id')?.value;

        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        // Get all roles
        const rolesRes = await query(`SELECT id, name FROM roles ORDER BY id ASC`);
        
        // Get existing permissions
        const permissionsRes = await query(
            `SELECT role_id, permission_key, is_allowed FROM role_permissions WHERE club_id = $1`,
            [clubId]
        );

        const rolePermissions: Record<number, Record<string, boolean>> = {};
        permissionsRes.rows.forEach(row => {
            if (!rolePermissions[row.role_id]) rolePermissions[row.role_id] = {};
            rolePermissions[row.role_id][row.permission_key] = row.is_allowed;
        });

        return NextResponse.json({
            roles: rolesRes.rows,
            availablePermissions: AVAILABLE_PERMISSIONS,
            rolePermissions
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ clubId: string }> }
) {
    try {
        const { clubId } = await params;
        const userId = (await cookies()).get('session_user_id')?.value;
        const { roleId, permissionKey, isAllowed } = await request.json();

        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        // Upsert permission
        await query(
            `INSERT INTO role_permissions (role_id, club_id, permission_key, is_allowed)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (role_id, club_id, permission_key)
             DO UPDATE SET is_allowed = EXCLUDED.is_allowed`,
            [roleId, clubId, permissionKey, isAllowed]
        );

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
