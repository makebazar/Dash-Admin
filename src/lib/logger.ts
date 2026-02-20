import { query } from "@/db"

export type LogAction = 
    | 'CREATE_CATEGORY' 
    | 'UPDATE_CATEGORY'
    | 'DELETE_CATEGORY'
    | 'CREATE_WAREHOUSE'
    | 'UPDATE_WAREHOUSE'
    | 'DELETE_WAREHOUSE'
    | 'CREATE_PRODUCT'
    | 'UPDATE_PRODUCT'
    | 'UPDATE_STOCK'
    | 'CREATE_SUPPLY'
    | 'CREATE_INVENTORY'
    | 'DELETE_INVENTORY'

export type LogEntityType = 'CATEGORY' | 'WAREHOUSE' | 'PRODUCT' | 'SUPPLY' | 'INVENTORY'

export async function logOperation(
    clubId: string | number,
    userId: string,
    action: string, // Changed from LogAction to string to allow flexibility
    entityType: string, // Changed from LogEntityType to string
    entityId: string | number,
    details?: any
) {
    try {
        await query(
            `INSERT INTO operation_logs (club_id, user_id, action, entity_type, entity_id, details)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [clubId, userId, action, entityType, entityId.toString(), JSON.stringify(details || {})]
        )
    } catch (error) {
        console.error("Failed to log operation:", error)
        // Non-blocking error
    }
}
