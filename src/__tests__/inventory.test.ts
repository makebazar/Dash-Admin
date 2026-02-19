import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createCategory, createWarehouse } from '@/app/clubs/[clubId]/inventory/actions'
import { query } from '@/db'

// Mock database query
vi.mock('@/db', () => ({
  query: vi.fn(),
}))

// Mock revalidatePath
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

// Mock logger
vi.mock('@/lib/logger', () => ({
  logOperation: vi.fn(),
}))

describe('Warehouse System Logic', () => {
  const clubId = '1'
  const userId = 'user-123'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Category Creation', () => {
    it('should create a category successfully', async () => {
      // Mock existing check (0 rows)
      vi.mocked(query).mockResolvedValueOnce({ rowCount: 0, rows: [] } as any)
      // Mock insert (return id)
      vi.mocked(query).mockResolvedValueOnce({ rows: [{ id: 101 }] } as any)

      await createCategory(clubId, userId, { name: 'New Category', description: 'Desc' })

      expect(query).toHaveBeenCalledTimes(2)
      // Check insert query
      expect(query).toHaveBeenLastCalledWith(
        expect.stringContaining('INSERT INTO warehouse_categories'),
        [clubId, 'New Category', 'Desc', undefined]
      )
    })

    it('should throw error if category name exists', async () => {
      // Mock existing check (1 row)
      vi.mocked(query).mockResolvedValueOnce({ rowCount: 1, rows: [{}] } as any)

      await expect(createCategory(clubId, userId, { name: 'Existing Cat' }))
        .rejects
        .toThrow("Категория с таким названием уже существует")
    })
  })

  describe('Warehouse Creation', () => {
    it('should create a warehouse successfully', async () => {
      // Mock insert
      vi.mocked(query).mockResolvedValueOnce({ rows: [{ id: 202 }] } as any)

      const warehouseData = {
        name: 'Main Warehouse',
        type: 'GENERAL',
        address: '123 Street'
      }

      await createWarehouse(clubId, userId, warehouseData)

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO warehouses'),
        [clubId, 'Main Warehouse', '123 Street', 'GENERAL', undefined, undefined, {}]
      )
    })
  })
})
