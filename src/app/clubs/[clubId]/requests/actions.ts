"use server"

import { query } from "@/db"
import { revalidatePath } from "next/cache"

const notifyRequestUpdates = async (clubId: string) => {
    await query(`SELECT pg_notify('employee_requests_updates', $1)`, [clubId])
}

export async function getAllClubRequests(clubId: string) {
    try {
        const res = await query(`
            SELECT r.*, u.full_name as user_name, NULL::text as workstation_name
            FROM employee_requests r
            JOIN users u ON r.user_id = u.id
            WHERE r.club_id = $1
            ORDER BY 
                CASE r.status 
                    WHEN 'PENDING' THEN 1 
                    WHEN 'IN_PROGRESS' THEN 2 
                    ELSE 3 
                END,
                r.created_at DESC
        `, [parseInt(clubId)])
        
        return res.rows
    } catch (e) {
        console.error('Error getting all club requests:', e)
        return []
    }
}

export async function updateRequestStatus(clubId: string, requestId: number, data: {
    status: 'PENDING' | 'IN_PROGRESS' | 'RESOLVED' | 'REJECTED'
    admin_notes?: string
}) {
    try {
        await query(`
            UPDATE employee_requests 
            SET status = $1, admin_notes = $2, is_read_by_employee = FALSE, updated_at = CURRENT_TIMESTAMP
            WHERE id = $3 AND club_id = $4
        `, [data.status, data.admin_notes || null, requestId, parseInt(clubId)])

        if (data.admin_notes) {
            const adminIdRes = await query(`SELECT owner_id FROM clubs WHERE id = $1`, [parseInt(clubId)])
            const adminId = adminIdRes.rows[0].owner_id
            
            await query(`
                INSERT INTO employee_request_messages (request_id, sender_id, message)
                VALUES ($1, $2, $3)
            `, [requestId, adminId, data.admin_notes])
        }

        revalidatePath(`/clubs/${clubId}/requests`)
        revalidatePath(`/employee/clubs/${clubId}`)
        await notifyRequestUpdates(clubId)
        return { success: true }
    } catch (e) {
        console.error('Error updating request status:', e)
        throw e
    }
}

export async function addAdminMessage(clubId: string, requestId: number, adminId: string, data: {
    message: string
    photo_urls?: string[]
}) {
    try {
        let senderId = adminId
        if (!senderId) {
            const ownerRes = await query(`SELECT owner_id FROM clubs WHERE id = $1`, [parseInt(clubId)])
            senderId = ownerRes.rows[0]?.owner_id
        }
        if (!senderId) {
            throw new Error('Admin sender id not found')
        }
        await query(`
            INSERT INTO employee_request_messages (request_id, sender_id, message, photo_urls)
            VALUES ($1, $2, $3, $4)
        `, [requestId, senderId, data.message, JSON.stringify(data.photo_urls || [])])

        await query(`
            UPDATE employee_requests 
            SET is_read_by_employee = FALSE, updated_at = CURRENT_TIMESTAMP 
            WHERE id = $1
        `, [requestId])

        revalidatePath(`/clubs/${clubId}/requests`)
        revalidatePath(`/employee/clubs/${clubId}`)
        await notifyRequestUpdates(clubId)
        return { success: true }
    } catch (e) {
        console.error('Error adding admin message:', e)
        throw e
    }
}
