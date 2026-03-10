"use server"

import { query } from "@/db"
import { revalidatePath } from "next/cache"

export type EmployeeRequest = {
    id: number
    club_id: number
    user_id: string
    category: 'TECHNICAL' | 'HOUSEHOLD' | 'HR' | 'FINANCIAL' | 'OTHER'
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
    title: string
    description: string
    status: 'PENDING' | 'IN_PROGRESS' | 'RESOLVED' | 'REJECTED'
    admin_notes?: string
    workstation_id?: number
    is_read_by_employee: boolean
    photo_urls: string[]
    is_archived: boolean
    created_at: string
    updated_at: string
}

export type RequestMessage = {
    id: number
    request_id: number
    sender_id: string
    message: string
    photo_urls: string[]
    created_at: string
}

const notifyRequestUpdates = async (clubId: string) => {
    await query(`SELECT pg_notify('employee_requests_updates', $1)`, [clubId])
}

export async function createEmployeeRequest(clubId: string, userId: string, data: {
    category: string
    priority?: string
    title: string
    description: string
    workstation_id?: number
    photo_urls?: string[]
}) {
    try {
        const res = await query(`
            INSERT INTO employee_requests (club_id, user_id, category, priority, title, description, workstation_id, is_read_by_employee, photo_urls)
            VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, $8)
            RETURNING id
        `, [
            parseInt(clubId), 
            userId, 
            data.category, 
            data.priority || 'MEDIUM', 
            data.title, 
            data.description, 
            data.workstation_id || null,
            JSON.stringify(data.photo_urls || [])
        ])

        const requestId = res.rows[0].id

        await query(`
            INSERT INTO employee_request_messages (request_id, sender_id, message, photo_urls)
            VALUES ($1, $2, $3, $4)
        `, [requestId, userId, data.description, JSON.stringify(data.photo_urls || [])])

        revalidatePath(`/employee/clubs/${clubId}`)
        await notifyRequestUpdates(clubId)
        return { success: true, id: requestId }
    } catch (e) {
        console.error('Error creating employee request:', e)
        throw e
    }
}

export async function addMessageToRequest(clubId: string, requestId: number, userId: string, data: {
    message: string
    photo_urls?: string[]
}) {
    try {
        await query(`
            INSERT INTO employee_request_messages (request_id, sender_id, message, photo_urls)
            VALUES ($1, $2, $3, $4)
        `, [requestId, userId, data.message, JSON.stringify(data.photo_urls || [])])

        await query(`UPDATE employee_requests SET updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [requestId])

        revalidatePath(`/employee/clubs/${clubId}`)
        await notifyRequestUpdates(clubId)
        return { success: true }
    } catch (e) {
        console.error('Error adding message:', e)
        throw e
    }
}

export async function getRequestMessages(requestId: number) {
    try {
        const res = await query(`
            SELECT m.*, u.full_name as sender_name
            FROM employee_request_messages m
            JOIN users u ON m.sender_id = u.id
            WHERE m.request_id = $1
            ORDER BY m.created_at ASC
        `, [requestId])
        return res.rows
    } catch (e) {
        console.error('Error getting messages:', e)
        return []
    }
}

export async function archiveRequest(clubId: string, requestId: number) {
    try {
        await query(`
            UPDATE employee_requests 
            SET is_archived = TRUE, status = 'RESOLVED'
            WHERE id = $1 AND club_id = $2
        `, [requestId, parseInt(clubId)])
        revalidatePath(`/employee/clubs/${clubId}`)
        await notifyRequestUpdates(clubId)
        return { success: true }
    } catch (e) {
        console.error('Error archiving request:', e)
        return { success: false }
    }
}

export async function markRequestAsRead(clubId: string, requestId: number) {
    try {
        await query(`
            UPDATE employee_requests 
            SET is_read_by_employee = TRUE 
            WHERE id = $1 AND club_id = $2
        `, [requestId, parseInt(clubId)])
        revalidatePath(`/employee/clubs/${clubId}`)
        await notifyRequestUpdates(clubId)
        return { success: true }
    } catch (e) {
        console.error('Error marking request as read:', e)
        return { success: false }
    }
}

export async function getEmployeeRequests(clubId: string, _userId: string) {
    try {
        const res = await query(`
            SELECT r.*, NULL::text as workstation_name
            FROM employee_requests r
            WHERE r.club_id = $1
            ORDER BY r.updated_at DESC, r.created_at DESC
        `, [parseInt(clubId)])

        return res.rows.map(row => ({
            ...row,
            is_archived: row.is_archived || false,
            photo_urls: Array.isArray(row.photo_urls) ? row.photo_urls : []
        }))
    } catch (e) {
        console.error('Error getting employee requests:', e)
        return []
    }
}
