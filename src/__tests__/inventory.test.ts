import { describe, it, expect, vi, beforeEach } from "vitest"
import {
    createCategory,
    createWarehouse,
    transferStock,
    createSupply,
    deleteSupply,
    adjustWarehouseStock,
    createInventory,
    addProductToInventory,
    updateInventoryItem,
    cancelInventory,
    closeInventory,
    createShiftReceipt,
    getWarehouses,
    generateProcurementList,
    getAbcAnalysisData,
    getProductByBarcode,
    getShiftZoneDiscrepancyReport,
} from "@/app/clubs/[clubId]/inventory/actions"
import { query, getClient } from "@/db"

vi.mock("@/db", () => ({
    query: vi.fn(),
    getClient: vi.fn(),
    queryClient: vi.fn(),
}))

vi.mock("next/headers", () => ({
    cookies: vi.fn(async () => ({
        get: (name: string) => (name === "session_user_id" ? { value: "user-123" } : undefined),
    })),
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
        query: vi.fn(async (sql: string, params?: any[]) => {
            if (sql.includes("SELECT owner_id, inventory_settings")) {
                return { rowCount: 1, rows: [{ owner_id: "user-123", inventory_settings: {} }] }
            }
            if (sql.includes("SELECT ce.role as club_role")) {
                return { rowCount: 1, rows: [{ club_role: "Админ", role_id: null, role_name: "Админ" }] }
            }
            return handler(sql, params)
        }),
        release: vi.fn(),
    }
}

describe("Warehouse System Logic", () => {
    const clubId = "1"
    const userId = "user-123"

    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(query).mockImplementation(async (sql: any) => {
            if (typeof sql === "string" && sql.includes("FROM clubs c") && sql.includes("club_employees")) {
                return { rowCount: 1, rows: [{ ok: 1 }] } as any
            }
            return { rowCount: 0, rows: [] } as any
        })
    })

    it("creates category successfully", async () => {
        vi.mocked(query).mockImplementation(async (sql: any) => {
            if (typeof sql === "string" && sql.includes("FROM clubs c") && sql.includes("club_employees")) {
                return { rowCount: 1, rows: [{ ok: 1 }] } as any
            }
            if (typeof sql === "string" && sql.includes("FROM warehouse_categories") && sql.includes("WHERE club_id")) {
                return { rowCount: 0, rows: [] } as any
            }
            if (typeof sql === "string" && sql.includes("INSERT INTO warehouse_categories")) {
                return { rows: [{ id: 101 }] } as any
            }
            return { rows: [], rowCount: 0 } as any
        })

        await createCategory(clubId, userId, { name: "New Category", description: "Desc" })

        expect(query).toHaveBeenCalledWith(
            expect.stringContaining("INSERT INTO warehouse_categories"),
            [clubId, "New Category", "Desc", undefined]
        )
    })

    it("throws when category exists", async () => {
        vi.mocked(query).mockImplementation(async (sql: any) => {
            if (typeof sql === "string" && sql.includes("FROM clubs c") && sql.includes("club_employees")) {
                return { rowCount: 1, rows: [{ ok: 1 }] } as any
            }
            if (typeof sql === "string" && sql.includes("FROM warehouse_categories") && sql.includes("WHERE club_id")) {
                return { rowCount: 1, rows: [{}] } as any
            }
            return { rowCount: 0, rows: [] } as any
        })
        await expect(createCategory(clubId, userId, { name: "Existing Cat" })).rejects.toThrow("Категория с таким названием уже существует")
    })

    it("creates warehouse successfully", async () => {
        vi.mocked(query).mockImplementation(async (sql: any) => {
            if (typeof sql === "string" && sql.includes("FROM clubs c") && sql.includes("club_employees")) {
                return { rowCount: 1, rows: [{ ok: 1 }] } as any
            }
            if (typeof sql === "string" && sql.includes("INSERT INTO warehouses")) {
                return { rows: [{ id: 202 }] } as any
            }
            return { rowCount: 0, rows: [] } as any
        })
        await createWarehouse(clubId, userId, { name: "Main Warehouse", type: "GENERAL", address: "123 Street" })
        expect(query).toHaveBeenCalledWith(
            expect.stringContaining("INSERT INTO warehouses"),
            [clubId, "Main Warehouse", "123 Street", "GENERAL", null, false, undefined, {}]
        )
    })

    it("transfers stock with lock and commit", async () => {
        const client = createMockClient((sql, params) => {
            if (sql.includes("FOR UPDATE")) return { rows: [{ quantity: 10 }] }
            if (sql.includes("INSERT INTO warehouse_stock") && sql.includes("RETURNING quantity")) {
                // Best-effort: return a plausible new quantity so the action can compute prev/new stocks.
                const delta = Number(params?.[2] ?? 0)
                return { rows: [{ quantity: 10 + delta }], rowCount: 1 }
            }
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

        // Delta-based stock updates: source -4, target +4
        expect(client.query).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO warehouse_stock"), [1, 55, -4])
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

    it("does not treat in-shift transfers as handover discrepancy", async () => {
        const client = createMockClient((sql) => {
            if (sql.includes("FROM shifts s")) {
                return {
                    rowCount: 1,
                    rows: [{
                        id: "shift-1",
                        user_id: userId,
                        club_id: Number(clubId),
                        check_in: "2026-04-10T10:00:00.000Z",
                        check_out: "2026-04-10T18:00:00.000Z",
                        status: "CLOSED",
                    }]
                }
            }

            if (sql.includes("FROM warehouses w") && sql.includes("shift_accountability_enabled = true")) {
                return {
                    rowCount: 2,
                    rows: [
                        { id: 1, name: "Бар", shift_zone_key: "BAR", shift_accountability_enabled: true, is_active: true },
                        { id: 2, name: "Холодильник", shift_zone_key: "FRIDGE", shift_accountability_enabled: true, is_active: true },
                    ]
                }
            }

            if (sql.includes("FROM shift_zone_snapshots ss") && sql.includes("JOIN shift_zone_snapshot_items sii")) {
                return {
                    rowCount: 4,
                    rows: [
                        { warehouse_id: 1, snapshot_type: "OPEN", snapshot_created_at: "2026-04-10T10:01:00.000Z", product_id: 101, counted_quantity: 10, system_quantity: 10, product_name: "Кола", selling_price: 100 },
                        { warehouse_id: 1, snapshot_type: "CLOSE", snapshot_created_at: "2026-04-10T17:59:00.000Z", product_id: 101, counted_quantity: 6, system_quantity: 6, product_name: "Кола", selling_price: 100 },
                        { warehouse_id: 2, snapshot_type: "OPEN", snapshot_created_at: "2026-04-10T10:01:00.000Z", product_id: 101, counted_quantity: 0, system_quantity: 0, product_name: "Кола", selling_price: 100 },
                        { warehouse_id: 2, snapshot_type: "CLOSE", snapshot_created_at: "2026-04-10T17:59:00.000Z", product_id: 101, counted_quantity: 4, system_quantity: 4, product_name: "Кола", selling_price: 100 },
                    ]
                }
            }

            if (sql.includes("FROM warehouse_stock_movements") && sql.includes("created_at >= $3")) {
                return {
                    rowCount: 2,
                    rows: [
                        { warehouse_id: 1, product_id: 101, change_amount: -4, type: "TRANSFER", reason: "Перемещение", created_at: "2026-04-10T12:00:00.000Z", user_id: userId, shift_id: "shift-1", related_entity_type: "TRANSFER", related_entity_id: "t-1" },
                        { warehouse_id: 2, product_id: 101, change_amount: 4, type: "TRANSFER", reason: "Перемещение", created_at: "2026-04-10T12:00:00.000Z", user_id: userId, shift_id: "shift-1", related_entity_type: "TRANSFER", related_entity_id: "t-1" },
                    ]
                }
            }

            return { rows: [], rowCount: 0 }
        })
        vi.mocked(getClient).mockResolvedValue(client as any)

        const result = await getShiftZoneDiscrepancyReport(clubId, "shift-1")

        expect(result).toEqual([])
    })

    it("does not double count transfers that happened before open snapshot", async () => {
        const client = createMockClient((sql) => {
            if (sql.includes("FROM shifts s")) {
                return {
                    rowCount: 1,
                    rows: [{
                        id: "shift-2",
                        user_id: userId,
                        club_id: Number(clubId),
                        check_in: "2026-04-10T10:00:00.000Z",
                        check_out: "2026-04-10T18:00:00.000Z",
                        status: "CLOSED",
                    }]
                }
            }

            if (sql.includes("FROM warehouses w") && sql.includes("shift_accountability_enabled = true")) {
                return {
                    rowCount: 1,
                    rows: [
                        { id: 3, name: "Холодильник", shift_zone_key: "FRIDGE", shift_accountability_enabled: true, is_active: true },
                    ]
                }
            }

            if (sql.includes("FROM shift_zone_snapshots ss") && sql.includes("JOIN shift_zone_snapshot_items sii")) {
                return {
                    rowCount: 2,
                    rows: [
                        { warehouse_id: 3, snapshot_type: "OPEN", snapshot_created_at: "2026-04-10T10:20:00.000Z", product_id: 101, counted_quantity: 8, system_quantity: 8, product_name: "Кола", selling_price: 100 },
                        { warehouse_id: 3, snapshot_type: "CLOSE", snapshot_created_at: "2026-04-10T18:00:00.000Z", product_id: 101, counted_quantity: 7, system_quantity: 7, product_name: "Кола", selling_price: 100 },
                    ]
                }
            }

            if (sql.includes("FROM warehouse_stock_movements") && sql.includes("created_at >= $3")) {
                return {
                    rowCount: 2,
                    rows: [
                        { warehouse_id: 3, product_id: 101, change_amount: 8, type: "TRANSFER", reason: "Перемещение со склада #1", created_at: "2026-04-10T10:15:00.000Z", user_id: userId, shift_id: "shift-2", related_entity_type: "TRANSFER", related_entity_id: "t-2" },
                        { warehouse_id: 3, product_id: 101, change_amount: -1, type: "SALE", reason: "POS чек #1", created_at: "2026-04-10T11:00:00.000Z", user_id: userId, shift_id: "shift-2", related_entity_type: "SHIFT_RECEIPT", related_entity_id: "r-1" },
                    ]
                }
            }

            return { rows: [], rowCount: 0 }
        })
        vi.mocked(getClient).mockResolvedValue(client as any)

        const result = await getShiftZoneDiscrepancyReport(clubId, "shift-2")

        expect(result).toEqual([])
    })

    it("creates completed supply and updates stock", async () => {
        const client = createMockClient((sql, params) => {
            if (sql.includes("SELECT COUNT(*)::int as cnt FROM warehouse_products")) {
                const ids = (params?.[1] || []) as any[]
                return { rows: [{ cnt: ids.length }], rowCount: 1 }
            }
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
        expect(client.query).toHaveBeenCalledWith(expect.stringContaining("UPDATE warehouse_products"), [10, 50, clubId])
        expect(client.query).toHaveBeenCalledWith("COMMIT")
    })

    it("filters warehouses for restricted employee access", async () => {
        const client = {
            query: vi.fn(async (sql: string) => {
            if (sql.includes("SELECT owner_id, inventory_settings")) {
                return { rowCount: 1, rows: [{ owner_id: "owner-1", inventory_settings: { employee_allowed_warehouse_ids: [2] } }] }
            }
            if (sql.includes("SELECT ce.role as club_role")) {
                return { rowCount: 1, rows: [{ club_role: "Сотрудник", role_id: null, role_name: null }] }
            }
            if (sql.includes("FROM warehouses w")) {
                return { rowCount: 1, rows: [{ id: 2, name: "Front", responsible_name: null }] }
            }
            return { rows: [], rowCount: 0 }
            }),
            release: vi.fn(),
        }
        vi.mocked(getClient).mockResolvedValue(client as any)

        const warehouses = await getWarehouses(clubId)

        expect(warehouses).toEqual([{ id: 2, name: "Front", responsible_name: null }])
        expect(client.query).toHaveBeenCalledWith(expect.stringContaining("w.id = ANY($2)"), [clubId, [2]])
    })

    it("creates draft supply without stock updates", async () => {
        const client = createMockClient((sql, params) => {
            if (sql.includes("SELECT COUNT(*)::int as cnt FROM warehouse_products")) {
                const ids = (params?.[1] || []) as any[]
                return { rows: [{ cnt: ids.length }], rowCount: 1 }
            }
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

    it("creates completed supply as purchase journal when stock tracking is disabled", async () => {
        const client = createMockClient((sql, params) => {
            if (sql.startsWith("SELECT inventory_settings FROM clubs")) {
                return { rowCount: 1, rows: [{ inventory_settings: { supplies_enabled: true, stock_enabled: false } }] }
            }
            if (sql.includes("SELECT COUNT(*)::int as cnt FROM warehouse_products")) {
                const ids = (params?.[1] || []) as any[]
                return { rows: [{ cnt: ids.length }], rowCount: 1 }
            }
            if (sql.startsWith("SELECT id FROM warehouse_suppliers")) return { rowCount: 1, rows: [{ id: 90 }] }
            if (sql.includes("INSERT INTO warehouse_supplies")) return { rows: [{ id: 125 }] }
            return { rows: [], rowCount: 1 }
        })
        vi.mocked(getClient).mockResolvedValue(client as any)

        await createSupply(clubId, userId, {
            supplier_name: "Supplier B",
            notes: "journal only",
            status: "COMPLETED",
            items: [{ product_id: 12, quantity: 4, cost_price: 70 }],
        })

        const stockUpserts = vi.mocked(client.query).mock.calls.filter(([sql]) => typeof sql === "string" && sql.includes("INSERT INTO warehouse_stock"))
        const movementInserts = vi.mocked(client.query).mock.calls.filter(([sql]) => typeof sql === "string" && sql.includes("INSERT INTO warehouse_stock_movements"))
        expect(stockUpserts.length).toBe(0)
        expect(movementInserts.length).toBe(0)
        expect(client.query).toHaveBeenCalledWith(expect.stringContaining("UPDATE warehouse_products"), [12, 70, clubId])
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

        // Delta-based stock update: old=5, new=8, delta=+3
        expect(client.query).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO warehouse_stock"), [3, 9, 3])
        expect(client.query).toHaveBeenCalledWith(expect.stringContaining("UPDATE warehouse_products p"), [9, clubId])
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
            if (sql.includes("WHERE club_id = $1 AND status = 'OPEN'")) return { rowCount: 0, rows: [] }
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

    it("creates inventory with zero-stock products for new clubs", async () => {
        const client = createMockClient((sql) => {
            if (sql.includes("WHERE club_id = $1 AND status = 'OPEN'")) return { rowCount: 0, rows: [] }
            if (sql.includes("INSERT INTO warehouse_inventories")) return { rows: [{ id: 45 }] }
            if (sql.includes("FROM warehouse_products p")) {
                return {
                    rows: [
                        { id: 1, current_stock: 0, cost_price: 50, selling_price: 100 },
                        { id: 2, current_stock: 3, cost_price: 30, selling_price: 70 },
                    ],
                }
            }
            return { rows: [], rowCount: 1 }
        })
        vi.mocked(getClient).mockResolvedValue(client as any)

        const invId = await createInventory(clubId, userId, null, null, 2, null)

        expect(invId).toBe(45)
        expect(client.query).toHaveBeenCalledWith(
            expect.stringContaining("INSERT INTO warehouse_inventory_items"),
            [45, 1, 0, 50, 100]
        )
        expect(client.query).toHaveBeenCalledWith(
            expect.stringContaining("INSERT INTO warehouse_inventory_items"),
            [45, 2, 3, 30, 70]
        )
        expect(client.query).toHaveBeenCalledWith("COMMIT")
    })

    it("adds inventory item as uncounted instead of auto-zero", async () => {
        const client = createMockClient((sql) => {
            if (sql.includes("SELECT warehouse_id, club_id, status FROM warehouse_inventories")) {
                return { rowCount: 1, rows: [{ warehouse_id: 2, club_id: clubId, status: "OPEN" }] }
            }
            if (sql.includes("SELECT 1 FROM warehouse_inventory_items")) return { rowCount: 0, rows: [] }
            if (sql.includes("FROM warehouse_products p")) {
                return { rowCount: 1, rows: [{ cost_price: 50, selling_price: 100, current_stock: 7 }] }
            }
            return { rows: [], rowCount: 1 }
        })
        vi.mocked(getClient).mockResolvedValue(client as any)

        await addProductToInventory(55, 10)

        expect(client.query).toHaveBeenCalledWith(
            expect.stringContaining("INSERT INTO warehouse_inventory_items"),
            [55, 10, 7, 50, 100]
        )
        const insertCall = vi.mocked(client.query).mock.calls.find(([sql]) =>
            typeof sql === "string" && sql.includes("INSERT INTO warehouse_inventory_items")
        )
        expect(String(insertCall?.[0])).toContain("added_manually")
        expect(String(insertCall?.[0])).toContain("VALUES ($1, $2, $3, NULL, $4, $5, TRUE)")
    })

    it("blocks creating a second open revision inventory", async () => {
        const client = createMockClient((sql) => {
            if (sql.includes("WHERE club_id = $1 AND status = 'OPEN'")) {
                return { rowCount: 1, rows: [{ id: 45, warehouse_id: 2 }] }
            }
            return { rows: [], rowCount: 0 }
        })
        vi.mocked(getClient).mockResolvedValue(client as any)

        await expect(createInventory(clubId, userId, null, null, 3, null)).rejects.toThrow("В клубе уже есть открытая инвентаризация")
        expect(client.query).toHaveBeenCalledWith("ROLLBACK")
    })

    it("blocks canceling closed inventory history", async () => {
        const client = createMockClient((sql) => {
            if (sql.includes("FROM warehouse_inventories") && sql.includes("FOR UPDATE")) {
                return { rowCount: 1, rows: [{ id: 91, status: "CLOSED", warehouse_id: 2, created_by: userId }] }
            }
            return { rows: [], rowCount: 1 }
        })
        vi.mocked(getClient).mockResolvedValue(client as any)

        await expect(cancelInventory(91, clubId, userId)).rejects.toThrow("Отменять можно только открытую инвентаризацию")
        expect(client.query).toHaveBeenCalledWith("ROLLBACK")
    })

    it("cancels open inventory into history instead of deleting", async () => {
        const client = createMockClient((sql) => {
            if (sql.includes("FROM warehouse_inventories") && sql.includes("FOR UPDATE")) {
                return { rowCount: 1, rows: [{ id: 92, status: "OPEN", warehouse_id: 2, created_by: userId }] }
            }
            return { rows: [], rowCount: 1 }
        })
        vi.mocked(getClient).mockResolvedValue(client as any)

        await cancelInventory(92, clubId, userId)

        expect(client.query).toHaveBeenCalledWith(
            expect.stringContaining("SET status = 'CANCELED'"),
            [92, clubId, userId]
        )
        expect(client.query).toHaveBeenCalledWith("COMMIT")
    })

    it("blocks updating items in closed inventory", async () => {
        const client = createMockClient((sql) => {
            if (sql.includes("FROM warehouse_inventory_items ii") && sql.includes("JOIN warehouse_inventories i")) {
                return { rowCount: 1, rows: [{ status: "CLOSED", warehouse_id: 2 }] }
            }
            return { rows: [], rowCount: 1 }
        })
        vi.mocked(getClient).mockResolvedValue(client as any)

        await expect(updateInventoryItem(501, 3, clubId)).rejects.toThrow("Редактировать можно только открытую инвентаризацию")
    })

    it("ignores legacy inventory sales mode and still allows POS receipts", async () => {
        const client = createMockClient((sql, params) => {
            if (sql.startsWith("SELECT inventory_settings FROM clubs")) {
                return { rowCount: 1, rows: [{ inventory_settings: { sales_capture_mode: "INVENTORY", stock_enabled: true, cashbox_enabled: true, cashbox_warehouse_id: 1 } }] }
            }
            if (sql.includes("FROM shifts WHERE id = $1")) {
                return { rowCount: 1, rows: [{ ok: 1 }] }
            }
            if (sql.includes("FROM warehouses") && sql.includes("is_active = true")) {
                return {
                    rowCount: 1,
                    rows: [{ id: 1, name: "Бар", is_default: true }],
                }
            }
            if (sql.includes("FROM warehouse_stock") && sql.includes("warehouse_id = ANY($1)")) {
                return {
                    rowCount: 1,
                    rows: [{ warehouse_id: 1, product_id: 10, quantity: 5 }],
                }
            }
            if (sql.includes("FROM warehouse_products") && sql.includes("id = ANY($2)") && sql.includes("cost_price")) {
                return { rowCount: 1, rows: [{ id: 10, cost_price: 40, selling_price: 100 }] }
            }
            if (sql.includes("SELECT quantity FROM warehouse_stock WHERE warehouse_id = $1 AND product_id = $2 FOR UPDATE")) {
                if (params?.[0] === 1 && params?.[1] === 10) return { rowCount: 1, rows: [{ quantity: 5 }] }
                return { rowCount: 1, rows: [{ quantity: 0 }] }
            }
            if (sql.includes("INSERT INTO shift_receipts")) return { rowCount: 1, rows: [{ id: 999 }] }
            if (sql.includes("INSERT INTO shift_receipt_items")) return { rowCount: 1, rows: [{ id: 501 }] }
            if (sql.includes("INSERT INTO warehouse_stock_movements")) return { rowCount: 1, rows: [{ id: 700 }] }
            if (sql.includes("INSERT INTO warehouse_stock")) return { rowCount: 1, rows: [] }
            if (sql === "COMMIT" || sql === "BEGIN") return { rowCount: 0, rows: [] }
            return { rows: [], rowCount: 1 }
        })
        vi.mocked(getClient).mockResolvedValue(client as any)

        await createShiftReceipt(clubId, userId, {
            shift_id: "shift-1",
            payment_type: "cash",
            items: [{ product_id: 10, quantity: 1 }],
        })

        expect(client.query).toHaveBeenCalledWith(
            expect.stringContaining("INSERT INTO shift_receipts"),
            expect.arrayContaining([clubId, "shift-1", userId, 1])
        )
    })

    it("blocks cashbox receipts when cashbox mode is disabled", async () => {
        const client = createMockClient((sql) => {
            if (sql.startsWith("SELECT inventory_settings FROM clubs")) {
                return { rowCount: 1, rows: [{ inventory_settings: { stock_enabled: true, cashbox_enabled: false } }] }
            }
            return { rows: [], rowCount: 0 }
        })
        vi.mocked(getClient).mockResolvedValue(client as any)

        await expect(
            createShiftReceipt(clubId, userId, {
                shift_id: "shift-1",
                payment_type: "cash",
                items: [{ product_id: 10, quantity: 1 }],
            })
        ).rejects.toThrow("Касса DashAdmin отключена для этого клуба")

        expect(client.query).toHaveBeenCalledWith("ROLLBACK")
    })

    it("uses configured cashbox warehouse for receipts", async () => {
        const client = createMockClient((sql, params) => {
            if (sql.startsWith("SELECT inventory_settings FROM clubs")) {
                return { rowCount: 1, rows: [{ inventory_settings: { stock_enabled: true, cashbox_enabled: true, cashbox_warehouse_id: 2 } }] }
            }
            if (sql.includes("FROM shifts WHERE id = $1")) {
                return { rowCount: 1, rows: [{ ok: 1 }] }
            }
            if (sql.includes("FROM warehouses") && sql.includes("is_active = true")) {
                if (params?.[1] === 2 || params?.[2] === 2) {
                    return {
                        rowCount: 1,
                        rows: [{ id: 2, name: "Резерв", is_default: false }],
                    }
                }
                return {
                    rowCount: 2,
                    rows: [
                        { id: 1, name: "Бар", is_default: true },
                        { id: 2, name: "Резерв", is_default: false },
                    ],
                }
            }
            if (sql.includes("FROM warehouse_stock") && sql.includes("warehouse_id = ANY($1)")) {
                return {
                    rowCount: 2,
                    rows: [
                        { warehouse_id: 1, product_id: 10, quantity: 100 },
                        { warehouse_id: 2, product_id: 10, quantity: 5 },
                    ],
                }
            }
            if (sql.includes("FROM warehouse_products") && sql.includes("id = ANY($2)") && sql.includes("cost_price")) {
                return { rowCount: 1, rows: [{ id: 10, cost_price: 40, selling_price: 100 }] }
            }
            if (sql.includes("SELECT quantity FROM warehouse_stock WHERE warehouse_id = $1 AND product_id = $2 FOR UPDATE")) {
                if (params?.[0] === 2 && params?.[1] === 10) return { rowCount: 1, rows: [{ quantity: 5 }] }
                return { rowCount: 1, rows: [{ quantity: 100 }] }
            }
            if (sql.includes("INSERT INTO shift_receipts")) return { rowCount: 1, rows: [{ id: 999 }] }
            if (sql.includes("INSERT INTO shift_receipt_items")) return { rowCount: 1, rows: [{ id: 501 }] }
            if (sql.includes("INSERT INTO warehouse_stock_movements")) return { rowCount: 1, rows: [{ id: 700 }] }
            if (sql.includes("INSERT INTO warehouse_stock")) return { rowCount: 1, rows: [] }
            if (sql === "COMMIT" || sql === "BEGIN") return { rowCount: 0, rows: [] }
            return { rows: [], rowCount: 1 }
        })
        vi.mocked(getClient).mockResolvedValue(client as any)

        await createShiftReceipt(clubId, userId, {
            shift_id: "shift-1",
            payment_type: "cash",
            items: [{ product_id: 10, quantity: 1 }],
        })

        expect(client.query).toHaveBeenCalledWith(
            expect.stringContaining("INSERT INTO shift_receipts"),
            expect.arrayContaining([clubId, "shift-1", userId, 2])
        )
    })

    it("blocks cashbox receipts when cashbox warehouse is not configured", async () => {
        const client = createMockClient((sql) => {
            if (sql.startsWith("SELECT inventory_settings FROM clubs")) {
                return { rowCount: 1, rows: [{ inventory_settings: { stock_enabled: true, cashbox_enabled: true, cashbox_warehouse_id: null } }] }
            }
            return { rows: [], rowCount: 0 }
        })
        vi.mocked(getClient).mockResolvedValue(client as any)

        await expect(
            createShiftReceipt(clubId, userId, {
                shift_id: "shift-warehouse-missing",
                payment_type: "cash",
                items: [{ product_id: 10, quantity: 1 }],
            })
        ).rejects.toThrow("Для кассы не выбран склад продаж")

        expect(client.query).toHaveBeenCalledWith("ROLLBACK")
    })

    it("closes inventory with movement compensation without auto supply", async () => {
        const mainClient = createMockClient((sql, params) => {
            if (sql.startsWith("SELECT warehouse_id, shift_id, created_by, started_at, status FROM warehouse_inventories")) {
                return { rows: [{ warehouse_id: 1, shift_id: "shift-9", created_by: userId, started_at: "2026-01-01T10:00:00Z", status: "OPEN" }] }
            }
            if (sql.startsWith("SELECT inventory_settings FROM clubs")) {
                return { rows: [{ inventory_settings: { sales_capture_mode: "INVENTORY" } }] }
            }
            if (sql.includes("SELECT COUNT(*)::int as cnt FROM warehouse_products")) {
                const ids = (params?.[1] || []) as any[]
                return { rows: [{ cnt: ids.length }], rowCount: 1 }
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
            if (sql.includes("SELECT quantity") && sql.includes("FROM warehouse_stock")) {
                if (params?.[1] === 55) return { rowCount: 1, rows: [{ quantity: 11 }] }
                if (params?.[1] === 99) return { rowCount: 1, rows: [{ quantity: 5 }] }
            }
            if (sql.includes("INSERT INTO warehouse_stock") && sql.includes("RETURNING quantity")) {
                const delta = Number(params?.[2] ?? 0)
                const baseline = params?.[1] === 55 ? 11 : 5
                return { rowCount: 1, rows: [{ quantity: baseline + delta }] }
            }
            return { rows: [], rowCount: 1 }
        })
        const replenishmentClient = createMockClient((sql) => {
            if (sql.includes("FROM warehouse_replenishment_rules")) return { rows: [] }
            return { rows: [], rowCount: 1 }
        })
        vi.mocked(getClient).mockResolvedValueOnce(mainClient as any).mockResolvedValueOnce(replenishmentClient as any)

        await closeInventory(77, clubId, 1000, [{ product_id: 99, quantity: 2, selling_price: 120, cost_price: 60 }])

        expect(mainClient.query).toHaveBeenCalledWith(
            expect.stringContaining("UPDATE warehouse_inventories"),
            [77, 1000, 0, 1000, userId, "SHIFT"]
        )
        expect(mainClient.query).toHaveBeenCalledWith(
            expect.stringContaining("INSERT INTO warehouse_stock_movements"),
            expect.arrayContaining([clubId, 55, userId, -3, 11, 8, "INVENTORY_LOSS"])
        )
        const supplyCalls = vi.mocked(mainClient.query).mock.calls.filter(([sql]) => typeof sql === "string" && sql.includes("INSERT INTO warehouse_supplies"))
        expect(supplyCalls.length).toBe(0)
        expect(mainClient.query).toHaveBeenCalledWith("COMMIT")
        expect(mainClient.release).toHaveBeenCalled()
    })

    it("defaults to POS revenue reconciliation on shift inventory close", async () => {
        const mainClient = createMockClient((sql) => {
            if (sql.startsWith("SELECT warehouse_id, shift_id, created_by, started_at, status FROM warehouse_inventories")) {
                return { rows: [{ warehouse_id: 1, shift_id: "shift-9", created_by: userId, started_at: "2026-01-01T10:00:00Z", status: "OPEN" }] }
            }
            if (sql.startsWith("SELECT inventory_settings FROM clubs")) {
                return { rows: [{ inventory_settings: { sales_capture_mode: "SHIFT" } }] }
            }
            if (sql.includes("FROM warehouse_stock_movements sm") && sql.includes("sm.type IN ('SALE', 'RETURN')")) {
                return { rows: [{ revenue: 500 }] }
            }
            if (sql.includes("FROM warehouse_inventory_items ii")) {
                return {
                    rows: [
                        {
                            id: 101,
                            product_id: 55,
                            expected_stock: 10,
                            actual_stock: 8,
                            movements_during_inventory: 0,
                            selling_price_snapshot: 100,
                            cost_price_snapshot: 60,
                        },
                    ],
                }
            }
            return { rows: [], rowCount: 1 }
        })
        const replenishmentClient = createMockClient((sql) => {
            if (sql.includes("FROM warehouse_replenishment_rules")) return { rows: [] }
            return { rows: [], rowCount: 1 }
        })
        vi.mocked(getClient).mockResolvedValueOnce(mainClient as any).mockResolvedValueOnce(replenishmentClient as any)

        await closeInventory(77, clubId, 1000, [])

        // In SHIFT mode, closeInventory should not recognize inventory deficits as sales by default.
        expect(mainClient.query).toHaveBeenCalledWith(
            expect.stringContaining("UPDATE warehouse_inventories"),
            [77, 1000, 500, 500, userId, "SHIFT"]
        )
        expect(mainClient.query).toHaveBeenCalledWith(
            expect.stringContaining("sm.type IN ('SALE', 'RETURN')"),
            [clubId, "shift-9"]
        )
    })

    it("aggregates duplicate unaccounted sales on close", async () => {
        const mainClient = createMockClient((sql, params) => {
            if (sql.startsWith("SELECT warehouse_id, shift_id, created_by, started_at, status FROM warehouse_inventories")) {
                return { rows: [{ warehouse_id: 1, shift_id: "shift-9", created_by: userId, started_at: "2026-01-01T10:00:00Z", status: "OPEN" }] }
            }
            if (sql.startsWith("SELECT inventory_settings FROM clubs")) {
                return { rows: [{ inventory_settings: { sales_capture_mode: "INVENTORY" } }] }
            }
            if (sql.includes("SELECT COUNT(*)::int as cnt FROM warehouse_products")) {
                return { rows: [{ cnt: 1 }], rowCount: 1 }
            }
            if (sql.includes("FROM warehouse_inventory_items ii")) {
                return {
                    rows: [
                        {
                            id: 101,
                            product_id: 55,
                            expected_stock: 10,
                            actual_stock: 10,
                            movements_during_inventory: 0,
                            selling_price_snapshot: 100,
                            cost_price_snapshot: 60,
                        },
                    ],
                }
            }
            if (sql.includes("SELECT quantity") && sql.includes("FROM warehouse_stock")) {
                if (params?.[1] === 55) return { rowCount: 1, rows: [{ quantity: 10 }] }
                if (params?.[1] === 99) return { rowCount: 1, rows: [{ quantity: 4 }] }
            }
            if (sql.includes("INSERT INTO warehouse_stock") && sql.includes("RETURNING quantity")) {
                const delta = Number(params?.[2] ?? 0)
                const baseline = params?.[1] === 55 ? 10 : 4
                return { rowCount: 1, rows: [{ quantity: baseline + delta }] }
            }
            return { rows: [], rowCount: 1 }
        })
        const replenishmentClient = createMockClient((sql) => {
            if (sql.includes("FROM warehouse_replenishment_rules")) return { rows: [] }
            return { rows: [], rowCount: 1 }
        })
        vi.mocked(getClient).mockResolvedValueOnce(mainClient as any).mockResolvedValueOnce(replenishmentClient as any)

        await closeInventory(88, clubId, 400, [
            { product_id: 99, quantity: 1, selling_price: 100, cost_price: 50 },
            { product_id: 99, quantity: 2, selling_price: 100, cost_price: 50 },
        ])

        expect(mainClient.query).toHaveBeenCalledWith(
            expect.stringContaining("UPDATE warehouse_inventories"),
            [88, 400, 0, 400, userId, "SHIFT"]
        )
        const supplyItemCalls = vi.mocked(mainClient.query).mock.calls.filter(([sql]) => typeof sql === "string" && sql.includes("INSERT INTO warehouse_supply_items"))
        expect(supplyItemCalls.length).toBe(0)
    })

    it("includes zero-stock items in procurement and rounds suggested quantity up to box size", async () => {
        const analyticsClient = createMockClient((sql) => {
            if (sql.includes("WITH ProductRevenue AS")) return { rows: [] }
            return { rows: [], rowCount: 1 }
        })
        const mainClient = createMockClient((sql) => {
            if (sql.includes("warehouse_procurement_lists") && sql.includes("RETURNING id")) return { rows: [{ id: 901 }], rowCount: 1 }
            if (sql.includes("SELECT") && sql.includes("FROM warehouse_products") && sql.includes("ideal_stock_days")) {
                return {
                    rows: [
                        {
                            id: 77,
                            name: "Tonic",
                            current_stock: 0,
                            min_stock_level: 5,
                            sales_velocity: 1,
                            ideal_stock_days: 14,
                            abc_category: "A",
                            units_per_box: 12,
                            days_left: 0,
                        },
                    ],
                }
            }
            return { rows: [], rowCount: 1 }
        })
        vi.mocked(getClient).mockResolvedValueOnce(mainClient as any).mockResolvedValueOnce(analyticsClient as any)

        await generateProcurementList(clubId, userId)

        expect(mainClient.query).toHaveBeenCalledWith(
            expect.stringContaining("INSERT INTO warehouse_procurement_items"),
            [901, 77, 0, 12, 12, 12]
        )
    })

    it("does not auto-include non-critical category C products in procurement", async () => {
        const analyticsClient = createMockClient((sql) => {
            if (sql.includes("WITH ProductRevenue AS")) return { rows: [] }
            return { rows: [], rowCount: 1 }
        })
        const mainClient = createMockClient((sql) => {
            if (sql.includes("warehouse_procurement_lists") && sql.includes("RETURNING id")) return { rows: [{ id: 902 }], rowCount: 1 }
            if (sql.includes("SELECT") && sql.includes("FROM warehouse_products") && sql.includes("ideal_stock_days")) {
                return {
                    rows: [
                        {
                            id: 81,
                            name: "Rare syrup",
                            current_stock: 2,
                            min_stock_level: 5,
                            sales_velocity: 1,
                            ideal_stock_days: 14,
                            abc_category: "C",
                            units_per_box: 6,
                        },
                    ],
                }
            }
            return { rows: [], rowCount: 1 }
        })
        vi.mocked(getClient).mockResolvedValueOnce(mainClient as any).mockResolvedValueOnce(analyticsClient as any)

        await generateProcurementList(clubId, userId)

        expect(mainClient.query).not.toHaveBeenCalledWith(
            expect.stringContaining("INSERT INTO warehouse_procurement_items"),
            expect.arrayContaining([902, 81])
        )
    })

    it("never auto-includes category C products in optimized mode even with zero stock", async () => {
        const analyticsClient = createMockClient((sql) => {
            if (sql.includes("WITH ProductRevenue AS")) return { rows: [] }
            return { rows: [], rowCount: 1 }
        })
        const mainClient = createMockClient((sql) => {
            if (sql.includes("warehouse_procurement_lists") && sql.includes("RETURNING id")) return { rows: [{ id: 904 }], rowCount: 1 }
            if (sql.includes("SELECT") && sql.includes("FROM warehouse_products") && sql.includes("ideal_stock_days")) {
                return {
                    rows: [
                        {
                            id: 83,
                            name: "Low runner",
                            current_stock: 0,
                            min_stock_level: 3,
                            sales_velocity: 2,
                            ideal_stock_days: 14,
                            abc_category: "C",
                            units_per_box: 6,
                        },
                    ],
                }
            }
            return { rows: [], rowCount: 1 }
        })
        vi.mocked(getClient).mockResolvedValueOnce(mainClient as any).mockResolvedValueOnce(analyticsClient as any)

        await generateProcurementList(clubId, userId, "optimized")

        expect(mainClient.query).not.toHaveBeenCalledWith(
            expect.stringContaining("INSERT INTO warehouse_procurement_items"),
            expect.arrayContaining([904, 83])
        )
    })

    it("includes category C products in full procurement mode", async () => {
        const analyticsClient = createMockClient((sql) => {
            if (sql.includes("WITH ProductRevenue AS")) return { rows: [] }
            return { rows: [], rowCount: 1 }
        })
        const mainClient = createMockClient((sql, params) => {
            if (sql.includes("warehouse_procurement_lists") && sql.includes("RETURNING id")) {
                expect(params).toEqual([clubId, userId, "full"])
                return { rows: [{ id: 903 }], rowCount: 1 }
            }
            if (sql.includes("SELECT") && sql.includes("FROM warehouse_products") && sql.includes("ideal_stock_days")) {
                return {
                    rows: [
                        {
                            id: 82,
                            name: "Seasonal syrup",
                            current_stock: 2,
                            min_stock_level: 5,
                            sales_velocity: 1,
                            ideal_stock_days: 14,
                            abc_category: "C",
                            units_per_box: 6,
                        },
                    ],
                }
            }
            return { rows: [], rowCount: 1 }
        })
        vi.mocked(getClient).mockResolvedValueOnce(mainClient as any).mockResolvedValueOnce(analyticsClient as any)

        await generateProcurementList(clubId, userId, "full")

        expect(mainClient.query).toHaveBeenCalledWith(
            expect.stringContaining("INSERT INTO warehouse_procurement_items"),
            [903, 82, 2, 6, 6, 6]
        )
    })

    it("returns barcode product with aggregated stock for POS checks", async () => {
        const client = createMockClient((sql) => {
            if (sql.includes("WHERE ws.product_id = p.id")) {
                return {
                    rows: [
                        {
                            id: 500,
                            name: "Cola",
                            barcode: "12345678",
                            total_stock: "7",
                            stocks: [{ warehouse_id: 1, warehouse_name: "Бар", quantity: 7, is_default: true }],
                        },
                    ],
                    rowCount: 1,
                }
            }
            return { rows: [], rowCount: 0 }
        })
        vi.mocked(getClient).mockResolvedValue(client as any)

        const product = await getProductByBarcode(clubId, "12345678")

        expect(product?.current_stock).toBe(7)
        expect(product?.stocks).toEqual([{ warehouse_id: 1, warehouse_name: "Бар", quantity: 7, is_default: true }])
    })

    it("uses net sales and historical receipt cost signals in abc analytics", async () => {
        const client = createMockClient((sql) => {
            if (sql.includes("WITH ReceiptCosts AS")) {
                return { rows: [] }
            }
            return { rows: [], rowCount: 1 }
        })
        vi.mocked(getClient).mockResolvedValue(client as any)

        await getAbcAnalysisData(clubId)

        expect(client.query).toHaveBeenCalledWith(
            expect.stringContaining("m.type IN ('SALE', 'RETURN')"),
            [clubId]
        )
        expect(client.query).toHaveBeenCalledWith(
            expect.stringContaining("COALESCE(rc.cost_price_snapshot, p.cost_price)"),
            [clubId]
        )
        expect(client.query).toHaveBeenCalledWith(
            expect.stringContaining("COALESCE(m.related_entity_type, '') = 'SHIFT_RECEIPT_VOID'"),
            [clubId]
        )
    })
})
