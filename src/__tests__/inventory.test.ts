import { describe, it, expect, vi, beforeEach } from "vitest"
import {
    createCategory,
    createWarehouse,
    transferStock,
    createSupply,
    deleteSupply,
    adjustWarehouseStock,
    createInventory,
    closeInventory,
} from "@/app/clubs/[clubId]/inventory/actions"
import { query, getClient } from "@/db"

vi.mock("@/db", () => ({
    query: vi.fn(),
    getClient: vi.fn(),
    queryClient: vi.fn(),
}))

vi.mock("next/cache", () => ({
    revalidatePath: vi.fn(),
}))

vi.mock("@/lib/logger", () => ({
    logOperation: vi.fn(),
    LogAction: {},
}))

type MockResult = { rows?: any[]; rowCount?: number }

function createMockClient(handler: (sql: string, params?: any[]) => Promise<MockResult> | MockResult) {
    return {
        query: vi.fn(async (sql: string, params?: any[]) => handler(sql, params)),
        release: vi.fn(),
    }
}

describe("Warehouse System Logic", () => {
    const clubId = "1"
    const userId = "user-123"

    beforeEach(() => {
        vi.clearAllMocks()
    })

    it("creates category successfully", async () => {
        vi.mocked(query).mockResolvedValueOnce({ rowCount: 0, rows: [] } as any)
        vi.mocked(query).mockResolvedValueOnce({ rows: [{ id: 101 }] } as any)

        await createCategory(clubId, userId, { name: "New Category", description: "Desc" })

        expect(query).toHaveBeenCalledWith(
            expect.stringContaining("INSERT INTO warehouse_categories"),
            [clubId, "New Category", "Desc", undefined]
        )
    })

    it("throws when category exists", async () => {
        vi.mocked(query).mockResolvedValueOnce({ rowCount: 1, rows: [{}] } as any)
        await expect(createCategory(clubId, userId, { name: "Existing Cat" })).rejects.toThrow("Категория с таким названием уже существует")
    })

    it("creates warehouse successfully", async () => {
        vi.mocked(query).mockResolvedValueOnce({ rows: [{ id: 202 }] } as any)
        await createWarehouse(clubId, userId, { name: "Main Warehouse", type: "GENERAL", address: "123 Street" })
        expect(query).toHaveBeenCalledWith(
            expect.stringContaining("INSERT INTO warehouses"),
            [clubId, "Main Warehouse", "123 Street", "GENERAL", undefined, {}]
        )
    })

    it("transfers stock with lock and commit", async () => {
        const client = createMockClient((sql) => {
            if (sql.includes("FOR UPDATE")) return { rows: [{ quantity: 10 }] }
            if (sql.startsWith("SELECT quantity FROM warehouse_stock WHERE warehouse_id = $1 AND product_id = $2")) return { rows: [{ quantity: 3 }] }
            return { rows: [], rowCount: 1 }
        })
        vi.mocked(getClient).mockResolvedValue(client as any)

        await transferStock(clubId, userId, {
            source_warehouse_id: 1,
            target_warehouse_id: 2,
            product_id: 55,
            quantity: 4,
            notes: "test",
        })

        expect(client.query).toHaveBeenCalledWith(
            "UPDATE warehouse_stock SET quantity = $1 WHERE warehouse_id = $2 AND product_id = $3",
            [6, 1, 55]
        )
        expect(client.query).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO warehouse_stock"), [2, 55, 4])
        expect(client.query).toHaveBeenCalledWith("COMMIT")
        expect(client.release).toHaveBeenCalled()
    })

    it("rollbacks transfer when source stock is not enough", async () => {
        const client = createMockClient((sql) => {
            if (sql.includes("FOR UPDATE")) return { rows: [{ quantity: 1 }] }
            return { rows: [], rowCount: 1 }
        })
        vi.mocked(getClient).mockResolvedValue(client as any)

        await expect(
            transferStock(clubId, userId, {
                source_warehouse_id: 1,
                target_warehouse_id: 2,
                product_id: 55,
                quantity: 5,
            })
        ).rejects.toThrow("Недостаточно товара на складе отправления")

        expect(client.query).toHaveBeenCalledWith("ROLLBACK")
    })

    it("creates completed supply and updates stock", async () => {
        const client = createMockClient((sql) => {
            if (sql.startsWith("SELECT id FROM warehouse_suppliers")) return { rowCount: 0, rows: [] }
            if (sql.startsWith("INSERT INTO warehouse_suppliers")) return { rows: [{ id: 77 }] }
            if (sql.startsWith("SELECT id FROM warehouses WHERE club_id")) return { rows: [{ id: 5 }] }
            if (sql.includes("INSERT INTO warehouse_supplies")) return { rows: [{ id: 123 }] }
            return { rows: [], rowCount: 1 }
        })
        vi.mocked(getClient).mockResolvedValue(client as any)

        await createSupply(clubId, userId, {
            supplier_name: "Supplier A",
            notes: "note",
            status: "COMPLETED",
            items: [{ product_id: 10, quantity: 3, cost_price: 50 }],
        })

        expect(client.query).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO warehouse_stock"), [5, 10, 3])
        expect(client.query).toHaveBeenCalledWith(expect.stringContaining("UPDATE warehouse_products"), [10, 50])
        expect(client.query).toHaveBeenCalledWith("COMMIT")
    })

    it("creates draft supply without stock updates", async () => {
        const client = createMockClient((sql) => {
            if (sql.startsWith("SELECT id FROM warehouse_suppliers")) return { rowCount: 1, rows: [{ id: 88 }] }
            if (sql.includes("INSERT INTO warehouse_supplies")) return { rows: [{ id: 124 }] }
            return { rows: [], rowCount: 1 }
        })
        vi.mocked(getClient).mockResolvedValue(client as any)

        await createSupply(clubId, userId, {
            supplier_name: "Supplier A",
            notes: "draft",
            status: "DRAFT",
            warehouse_id: 5,
            items: [{ product_id: 11, quantity: 2, cost_price: 30 }],
        })

        const stockUpserts = vi.mocked(client.query).mock.calls.filter(([sql]) => typeof sql === "string" && sql.includes("INSERT INTO warehouse_stock"))
        expect(stockUpserts.length).toBe(0)
    })

    it("deletes completed supply and reverts stock if no later inventory", async () => {
        const client = createMockClient((sql) => {
            if (sql.startsWith("SELECT * FROM warehouse_supplies")) {
                return { rows: [{ id: 500, status: "COMPLETED", warehouse_id: 3, created_at: "2026-01-01T00:00:00Z" }] }
            }
            if (sql.startsWith("SELECT * FROM warehouse_supply_items")) return { rows: [{ product_id: 10, quantity: 2 }] }
            if (sql.includes("FROM warehouse_inventories")) return { rows: [] }
            return { rows: [], rowCount: 1 }
        })
        vi.mocked(getClient).mockResolvedValue(client as any)

        await deleteSupply(500, clubId, userId)

        expect(client.query).toHaveBeenCalledWith(expect.stringContaining("UPDATE warehouse_stock"), [2, 3, 10])
        expect(client.query).toHaveBeenCalledWith("COMMIT")
    })

    it("deletes completed supply without stock revert if later inventory exists", async () => {
        const client = createMockClient((sql) => {
            if (sql.startsWith("SELECT * FROM warehouse_supplies")) {
                return { rows: [{ id: 501, status: "COMPLETED", warehouse_id: 3, created_at: "2026-01-01T00:00:00Z" }] }
            }
            if (sql.startsWith("SELECT * FROM warehouse_supply_items")) return { rows: [{ product_id: 10, quantity: 2 }] }
            if (sql.includes("FROM warehouse_inventories")) return { rows: [{ id: 1 }] }
            return { rows: [], rowCount: 1 }
        })
        vi.mocked(getClient).mockResolvedValue(client as any)

        await deleteSupply(501, clubId, userId)

        const stockReverts = vi.mocked(client.query).mock.calls.filter(([sql]) => typeof sql === "string" && sql.includes("SET quantity = GREATEST(0, quantity - $1)"))
        expect(stockReverts.length).toBe(0)
    })

    it("rollbacks adjustWarehouseStock when quantity unchanged", async () => {
        const client = createMockClient((sql) => {
            if (sql.startsWith("SELECT quantity FROM warehouse_stock")) return { rows: [{ quantity: 10 }] }
            return { rows: [], rowCount: 1 }
        })
        vi.mocked(getClient).mockResolvedValue(client as any)

        await adjustWarehouseStock(clubId, userId, 9, 3, 10, "same")

        expect(client.query).toHaveBeenCalledWith("ROLLBACK")
        expect(client.query).not.toHaveBeenCalledWith("COMMIT")
    })

    it("adjusts warehouse stock and commits", async () => {
        const client = createMockClient((sql) => {
            if (sql.startsWith("SELECT quantity FROM warehouse_stock")) return { rows: [{ quantity: 5 }] }
            return { rows: [], rowCount: 1 }
        })
        vi.mocked(getClient).mockResolvedValue(client as any)

        await adjustWarehouseStock(clubId, userId, 9, 3, 8, "manual")

        expect(client.query).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO warehouse_stock"), [3, 9, 8])
        expect(client.query).toHaveBeenCalledWith(expect.stringContaining("UPDATE warehouse_products p"), [9])
        expect(client.query).toHaveBeenCalledWith("COMMIT")
    })

    it("returns existing open inventory for shift", async () => {
        const client = createMockClient((sql) => {
            if (sql.includes("WHERE club_id = $1 AND shift_id = $2 AND status = 'OPEN'")) {
                return { rowCount: 1, rows: [{ id: 999 }] }
            }
            return { rows: [], rowCount: 0 }
        })
        vi.mocked(getClient).mockResolvedValue(client as any)

        const id = await createInventory(clubId, userId, "revenue", null, 3, "shift-1")

        expect(id).toBe(999)
        expect(client.query).toHaveBeenCalledWith("ROLLBACK")
    })

    it("creates inventory and snapshots products", async () => {
        const client = createMockClient((sql) => {
            if (sql.includes("INSERT INTO warehouse_inventories")) return { rows: [{ id: 44 }] }
            if (sql.includes("FROM warehouse_products p")) {
                return {
                    rows: [
                        { id: 1, current_stock: 10, cost_price: 50, selling_price: 100 },
                        { id: 2, current_stock: 4, cost_price: 30, selling_price: 70 },
                    ],
                }
            }
            return { rows: [], rowCount: 1 }
        })
        vi.mocked(getClient).mockResolvedValue(client as any)

        const invId = await createInventory(clubId, userId, null, null, 2, null)

        expect(invId).toBe(44)
        const itemInserts = vi.mocked(client.query).mock.calls.filter(([sql]) => typeof sql === "string" && sql.includes("INSERT INTO warehouse_inventory_items"))
        expect(itemInserts.length).toBe(2)
        expect(client.query).toHaveBeenCalledWith("COMMIT")
    })

    it("closes inventory with movement compensation and auto supply", async () => {
        const mainClient = createMockClient((sql) => {
            if (sql.startsWith("SELECT warehouse_id, shift_id, created_by, started_at FROM warehouse_inventories")) {
                return { rows: [{ warehouse_id: 1, shift_id: "shift-9", created_by: userId, started_at: "2026-01-01T10:00:00Z" }] }
            }
            if (sql.includes("FROM warehouse_inventory_items ii")) {
                return {
                    rows: [
                        {
                            id: 101,
                            product_id: 55,
                            expected_stock: 10,
                            actual_stock: 8,
                            movements_during_inventory: 1,
                            selling_price_snapshot: 100,
                            cost_price_snapshot: 60,
                        },
                    ],
                }
            }
            if (sql.includes("INSERT INTO warehouse_supplies")) return { rows: [{ id: 707 }] }
            return { rows: [], rowCount: 1 }
        })
        const replenishmentClient = createMockClient((sql) => {
            if (sql.includes("FROM warehouse_replenishment_rules")) return { rows: [] }
            return { rows: [], rowCount: 1 }
        })
        vi.mocked(getClient).mockResolvedValueOnce(mainClient as any).mockResolvedValueOnce(replenishmentClient as any)

        await closeInventory(77, clubId, 1000, [{ product_id: 55, quantity: 2, selling_price: 120, cost_price: 60 }])

        expect(mainClient.query).toHaveBeenCalledWith(
            expect.stringContaining("UPDATE warehouse_inventories"),
            [77, 1000, 540, 460]
        )
        expect(mainClient.query).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO warehouse_supplies"), [
            clubId,
            expect.stringContaining("закрытии инвентаризации #77"),
            120,
            userId,
            1,
        ])
        expect(mainClient.query).toHaveBeenCalledWith("COMMIT")
        expect(mainClient.release).toHaveBeenCalled()
    })
})
