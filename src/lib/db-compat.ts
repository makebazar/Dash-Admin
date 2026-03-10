import { query } from '@/db'

const columnCache = new Map<string, boolean>()

export const hasColumn = async (tableName: string, columnName: string) => {
    const key = `${tableName}.${columnName}`
    if (columnCache.has(key)) {
        return columnCache.get(key) as boolean
    }

    const result = await query(
        `SELECT 1
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = $1
           AND column_name = $2
         LIMIT 1`,
        [tableName, columnName]
    )

    const exists = (result.rowCount || 0) > 0
    columnCache.set(key, exists)
    return exists
}
