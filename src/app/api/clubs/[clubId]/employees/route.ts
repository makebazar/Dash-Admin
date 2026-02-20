import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';
import { normalizePhone } from '@/lib/phone-utils';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ clubId: string }> }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        const { clubId } = await params;

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Verify ownership
        const ownerCheck = await query(
            `SELECT id FROM clubs WHERE id = $1 AND owner_id = $2`,
            [clubId, userId]
        );

        if ((ownerCheck.rowCount ?? 0) === 0) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Get employees with salary scheme assignments
        const result = await query(
            `SELECT 
        u.id,
        u.full_name,
        u.phone_number,
        r.name as role_name,
        r.id as role_id,
        ce.hired_at,
        u.is_active,
        esa.scheme_id as salary_scheme_id,
        ss.name as salary_scheme_name
       FROM club_employees ce
       JOIN users u ON ce.user_id = u.id
       LEFT JOIN roles r ON u.role_id = r.id
       LEFT JOIN employee_salary_assignments esa ON esa.user_id = u.id AND esa.club_id = $1
       LEFT JOIN salary_schemes ss ON ss.id = esa.scheme_id
       WHERE ce.club_id = $1
       ORDER BY ce.hired_at DESC`,
            [clubId]
        );

        const employees = (result.rows || []).map(row => ({
            id: row.id,
            full_name: row.full_name,
            phone_number: row.phone_number,
            role: row.role_name || 'Сотрудник',
            role_id: row.role_id,
            hired_at: row.hired_at,
            is_active: row.is_active,
            salary_scheme_id: row.salary_scheme_id,
            salary_scheme_name: row.salary_scheme_name
        }));

        return NextResponse.json({ employees });

    } catch (error) {
        console.error('Get Employees Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ clubId: string }> }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        const { clubId } = await params;

        console.log('[API] Adding employee to club:', clubId, 'by user:', userId);

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Verify ownership
        const ownerCheck = await query(
            `SELECT id FROM clubs WHERE id = $1 AND owner_id = $2`,
            [clubId, userId]
        );

        if (ownerCheck.rowCount === 0) {
            console.log('[API] Permission denied for user:', userId, 'to add employee to club:', clubId);
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { phone_number, full_name, role_id } = await request.json();
        console.log('[API] Employee data:', { phone_number, full_name, role_id });

        if (!phone_number || !full_name) {
            return NextResponse.json({ error: 'Phone and name are required' }, { status: 400 });
        }

        const normalizedPhone = normalizePhone(phone_number);
        console.log('[API] Normalized phone:', normalizedPhone);

        // Check if user exists
        let employeeId;
        const userCheck = await query(
            `SELECT id FROM users WHERE phone_number = $1`,
            [normalizedPhone]
        );

        if ((userCheck.rowCount ?? 0) > 0) {
            // User exists
            employeeId = userCheck.rows[0].id;
            console.log('[API] User exists, ID:', employeeId);

            // Update role if provided
            if (role_id) {
                console.log('[API] Updating role to:', role_id);
                await query(
                    `UPDATE users SET role_id = $1 WHERE id = $2`,
                    [role_id, employeeId]
                );
            }
        } else {
            // Create new user
            console.log('[API] Creating new user');
            const newUser = await query(
                `INSERT INTO users (full_name, phone_number, role_id, is_active)
         VALUES ($1, $2, $3, TRUE)
         RETURNING id`,
                [full_name, normalizedPhone, role_id]
            );
            employeeId = newUser.rows[0].id;
            console.log('[API] New user created, ID:', employeeId);
        }

        // Get role name for club_employees table
        let roleName = 'Сотрудник';
        if (role_id) {
            const roleRes = await query('SELECT name FROM roles WHERE id = $1', [role_id]);
            if (roleRes.rows.length > 0) {
                roleName = roleRes.rows[0].name;
            }
        }

        // Add to club_employees with role
        console.log('[API] Adding to club_employees. Club:', clubId, 'User:', employeeId, 'Role:', roleName);
        const linkResult = await query(
            `INSERT INTO club_employees (club_id, user_id, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (club_id, user_id) DO UPDATE SET role = EXCLUDED.role
       RETURNING id`,
            [clubId, employeeId, roleName]
        );
        
        if (linkResult.rowCount === 0) {
            console.log('[API] User was already linked to this club (updated role)');
        } else {
            console.log('[API] Link created successfully');
        }

        return NextResponse.json({ success: true, employeeId });

    } catch (error) {
        console.error('Add Employee Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ clubId: string }> }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        const { clubId } = await params;
        const { searchParams } = new URL(request.url);
        const employeeId = searchParams.get('employeeId');

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!employeeId) {
            return NextResponse.json({ error: 'Employee ID is required' }, { status: 400 });
        }

        // Verify ownership
        const ownerCheck = await query(
            `SELECT id FROM clubs WHERE id = $1 AND owner_id = $2`,
            [clubId, userId]
        );

        if (ownerCheck.rowCount === 0) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Remove from club_employees
        await query(
            `DELETE FROM club_employees WHERE club_id = $1 AND user_id = $2`,
            [clubId, employeeId]
        );

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Delete Employee Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
