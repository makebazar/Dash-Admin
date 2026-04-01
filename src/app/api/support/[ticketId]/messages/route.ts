import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { query } from "@/db"
import { isSuperAdmin } from "@/lib/super-admin"
import { ensureSupportTables, SUPPORT_STATUSES, type SupportStatus } from "@/lib/support"

export const dynamic = "force-dynamic"

async function getViewer() {
  const userId = (await cookies()).get("session_user_id")?.value
  if (!userId) return null

  const result = await query(
    `SELECT id, full_name, phone_number, is_super_admin
     FROM users
     WHERE id = $1
     LIMIT 1`,
    [userId]
  )

  if ((result.rowCount || 0) === 0) {
    return null
  }

  const user = result.rows[0]

  return {
    id: user.id as string,
    can_manage_all: isSuperAdmin(user.is_super_admin, user.id, user.phone_number),
  }
}

async function getTicket(ticketId: number) {
  const result = await query(
    `
    SELECT id, user_id, guest_name, guest_email, guest_phone, status
    FROM support_tickets
    WHERE id = $1
    LIMIT 1
    `,
    [ticketId]
  )

  return result.rows[0] || null
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  try {
    await ensureSupportTables()
    const viewer = await getViewer()

    if (!viewer) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { ticketId } = await params
    const ticketIdNumber = Number(ticketId)

    if (!Number.isInteger(ticketIdNumber) || ticketIdNumber <= 0) {
      return NextResponse.json({ error: "Некорректный тикет" }, { status: 400 })
    }

    const ticket = await getTicket(ticketIdNumber)
    if (!ticket) {
      return NextResponse.json({ error: "Тикет не найден" }, { status: 404 })
    }

    if (!viewer.can_manage_all && ticket.user_id !== viewer.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const messagesResult = await query(
      `
      SELECT
        m.id,
        m.ticket_id,
        m.sender_id,
        m.message,
        m.is_staff,
        m.created_at,
        COALESCE(u.full_name, m.sender_name, 'Гость') AS sender_name
      FROM support_messages m
      LEFT JOIN users u ON u.id = m.sender_id
      WHERE m.ticket_id = $1
      ORDER BY m.created_at ASC, m.id ASC
      `,
      [ticketIdNumber]
    )

    return NextResponse.json({ messages: messagesResult.rows, ticket })
  } catch (error) {
    console.error("Get Support Messages Error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  try {
    await ensureSupportTables()
    const viewer = await getViewer()

    if (!viewer) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { ticketId } = await params
    const ticketIdNumber = Number(ticketId)

    if (!Number.isInteger(ticketIdNumber) || ticketIdNumber <= 0) {
      return NextResponse.json({ error: "Некорректный тикет" }, { status: 400 })
    }

    const ticket = await getTicket(ticketIdNumber)
    if (!ticket) {
      return NextResponse.json({ error: "Тикет не найден" }, { status: 404 })
    }

    if (!viewer.can_manage_all && ticket.user_id !== viewer.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const message = String(body?.message || "").trim()
    const nextStatusRaw = String(body?.status || "").trim().toUpperCase()
    const nextStatus = nextStatusRaw ? (nextStatusRaw as SupportStatus) : null

    if (!message || message.length < 2) {
      return NextResponse.json({ error: "Сообщение слишком короткое" }, { status: 400 })
    }

    if (nextStatus && !SUPPORT_STATUSES.includes(nextStatus)) {
      return NextResponse.json({ error: "Некорректный статус" }, { status: 400 })
    }

    await query(
      `
      INSERT INTO support_messages (ticket_id, sender_id, sender_name, sender_email, sender_phone, message, is_staff)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      [
        ticketIdNumber,
        viewer.id,
        viewer.can_manage_all ? "Поддержка DashAdmin" : null,
        null,
        null,
        message,
        viewer.can_manage_all,
      ]
    )

    const statusToSave = viewer.can_manage_all
      ? nextStatus || (ticket.status === "CLOSED" ? "CLOSED" : "ANSWERED")
      : "OPEN"

    await query(
      `
      UPDATE support_tickets
      SET
        status = $1::varchar,
        assigned_to = CASE WHEN $2 THEN $3 ELSE assigned_to END,
        closed_at = CASE WHEN $1::varchar = 'CLOSED' THEN NOW() ELSE NULL END,
        last_message_at = NOW(),
        updated_at = NOW()
      WHERE id = $4
      `,
      [statusToSave, viewer.can_manage_all, viewer.id, ticketIdNumber]
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Create Support Message Error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
