import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { query, getClient } from '@/db'
import { isSuperAdmin } from '@/lib/super-admin'
import { hasColumn } from '@/lib/db-compat'

async function ensureSuperAdmin() {
  const userId = (await cookies()).get('session_user_id')?.value
  if (!userId) return { ok: false as const, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  const adminCheck = await query(
    `SELECT is_super_admin, phone_number FROM users WHERE id = $1`,
    [userId]
  )

  const canAccess = isSuperAdmin(adminCheck.rows[0]?.is_super_admin, userId, adminCheck.rows[0]?.phone_number)
  if (!canAccess) return { ok: false as const, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

  return { ok: true as const }
}

export async function GET() {
  try {
    const auth = await ensureSuperAdmin()
    if (!auth.ok) return auth.response

    const hasEmployeeAccessSettings = await hasColumn('roles', 'employee_access_settings')

    const result = await query(
      `SELECT 
          r.id,
          r.name,
          ${hasEmployeeAccessSettings ? "COALESCE(r.employee_access_settings, '{}'::jsonb) as employee_access_settings," : "'{}'::jsonb as employee_access_settings,"}
          COALESCE(u_cnt.users_count, 0) as users_count,
          COALESCE(ce_cnt.club_employees_count, 0) as club_employees_count
       FROM roles r
       LEFT JOIN (
          SELECT role_id, COUNT(*)::int as users_count
          FROM users
          WHERE role_id IS NOT NULL
          GROUP BY role_id
       ) u_cnt ON u_cnt.role_id = r.id
       LEFT JOIN (
          SELECT role, COUNT(*)::int as club_employees_count
          FROM club_employees
          GROUP BY role
       ) ce_cnt ON ce_cnt.role = r.name
       ORDER BY r.id ASC`
    )

    const roles = result.rows.map(r => ({
      id: Number(r.id),
      name: r.name as string,
      employee_access_settings: r.employee_access_settings || {},
      users_count: Number(r.users_count || 0),
      club_employees_count: Number(r.club_employees_count || 0),
    }))

    return NextResponse.json({ roles })
  } catch (error) {
    console.error('Get Super Admin Roles Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const auth = await ensureSuperAdmin()
    if (!auth.ok) return auth.response

    const body = await request.json()
    const name = String(body?.name || '').trim()

    if (!name) return NextResponse.json({ error: 'Название роли обязательно' }, { status: 400 })
    if (name.length > 50) return NextResponse.json({ error: 'Название роли слишком длинное (макс 50)' }, { status: 400 })

    try {
      const insert = await query(
        `INSERT INTO roles (name)
         VALUES ($1)
         RETURNING id, name`,
        [name]
      )
      return NextResponse.json({ role: insert.rows[0] }, { status: 201 })
    } catch (e: any) {
      if (String(e?.code) === '23505') {
        return NextResponse.json({ error: 'Такая роль уже существует' }, { status: 409 })
      }
      throw e
    }
  } catch (error) {
    console.error('Create Super Admin Role Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await ensureSuperAdmin()
    if (!auth.ok) return auth.response

    const hasEmployeeAccessSettings = await hasColumn('roles', 'employee_access_settings')
    if (!hasEmployeeAccessSettings) {
      return NextResponse.json({ error: 'Колонка employee_access_settings отсутствует. Примените миграции.' }, { status: 400 })
    }

    const body = await request.json().catch(() => ({}))
    const roleIdNum = Number(body?.roleId)
    const employeeAccessSettings = body?.employee_access_settings

    if (!Number.isFinite(roleIdNum)) return NextResponse.json({ error: 'roleId обязателен' }, { status: 400 })
    if (employeeAccessSettings === null || employeeAccessSettings === undefined || typeof employeeAccessSettings !== 'object') {
      return NextResponse.json({ error: 'employee_access_settings должен быть объектом' }, { status: 400 })
    }

    const update = await query(
      `UPDATE roles
       SET employee_access_settings = $1::jsonb
       WHERE id = $2
       RETURNING id, name, employee_access_settings`,
      [JSON.stringify(employeeAccessSettings), roleIdNum]
    )

    if ((update.rowCount || 0) === 0) return NextResponse.json({ error: 'Роль не найдена' }, { status: 404 })

    return NextResponse.json({
      role: {
        id: Number(update.rows[0].id),
        name: update.rows[0].name as string,
        employee_access_settings: update.rows[0].employee_access_settings || {},
      }
    })
  } catch (error) {
    console.error('Update Super Admin Role Settings Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const client = await getClient()
  try {
    const auth = await ensureSuperAdmin()
    if (!auth.ok) return auth.response

    const { roleId, reassignRoleId } = await request.json()
    const roleIdNum = Number(roleId)
    const reassignRoleIdNum = reassignRoleId === undefined || reassignRoleId === null || reassignRoleId === ''
      ? null
      : Number(reassignRoleId)

    if (!Number.isFinite(roleIdNum)) return NextResponse.json({ error: 'roleId обязателен' }, { status: 400 })
    if (reassignRoleIdNum !== null && !Number.isFinite(reassignRoleIdNum)) {
      return NextResponse.json({ error: 'reassignRoleId должен быть числом' }, { status: 400 })
    }

    const roleRes = await client.query(`SELECT id, name FROM roles WHERE id = $1`, [roleIdNum])
    if ((roleRes.rowCount || 0) === 0) return NextResponse.json({ error: 'Роль не найдена' }, { status: 404 })
    const roleName = roleRes.rows[0].name as string

    if (roleName === 'Админ' || roleName === 'Управляющий') {
      return NextResponse.json({ error: 'Эту роль нельзя удалить' }, { status: 400 })
    }

    let reassignRoleName: string | null = null
    if (reassignRoleIdNum !== null) {
      if (reassignRoleIdNum === roleIdNum) {
        return NextResponse.json({ error: 'Нельзя переназначить на ту же роль' }, { status: 400 })
      }
      const toRes = await client.query(`SELECT id, name FROM roles WHERE id = $1`, [reassignRoleIdNum])
      if ((toRes.rowCount || 0) === 0) return NextResponse.json({ error: 'Роль для переназначения не найдена' }, { status: 400 })
      reassignRoleName = toRes.rows[0].name as string
    }

    const hasClubEmployeesRole = await hasColumn('club_employees', 'role')

    await client.query('BEGIN')

    const usersUpdate = await client.query(
      `UPDATE users
       SET role_id = $1
       WHERE role_id = $2`,
      [reassignRoleIdNum, roleIdNum]
    )

    let clubEmployeesUpdateCount = 0
    if (hasClubEmployeesRole) {
      const ceUpdate = await client.query(
        `UPDATE club_employees
         SET role = $1
         WHERE role = $2`,
        [reassignRoleName ?? 'Сотрудник', roleName]
      )
      clubEmployeesUpdateCount = ceUpdate.rowCount || 0
    }

    await client.query(`DELETE FROM roles WHERE id = $1`, [roleIdNum])

    await client.query('COMMIT')

    return NextResponse.json({
      success: true,
      updated_users: usersUpdate.rowCount || 0,
      updated_club_employees: clubEmployeesUpdateCount,
      deleted_role: { id: roleIdNum, name: roleName },
    })
  } catch (error) {
    try {
      await client.query('ROLLBACK')
    } catch { }
    console.error('Delete Super Admin Role Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  } finally {
    client.release()
  }
}
