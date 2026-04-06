const fs = require("fs")
const path = require("path")
const dotenv = require("dotenv")
const { Pool } = require("pg")

const cwd = path.resolve(__dirname, "..")
for (const [index, fileName] of [".env", ".env.local"].entries()) {
    const filePath = path.join(cwd, fileName)
    if (fs.existsSync(filePath)) {
        dotenv.config({ path: filePath, override: index > 0, quiet: true })
    }
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

function sqlString(value) {
    return `'${String(value).replace(/'/g, "''")}'`
}

async function fetchJson(url, cookieUserId) {
    const response = await fetch(url, {
        headers: {
            cookie: `session_user_id=${cookieUserId}`,
        },
    })

    const text = await response.text()
    let data
    try {
        data = JSON.parse(text)
    } catch {
        data = text
    }

    return { status: response.status, data }
}

async function getTableColumns(client, tableName) {
    const result = await client.query(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_name = $1
         ORDER BY ordinal_position`,
        [tableName]
    )
    return new Set(result.rows.map((row) => String(row.column_name)))
}

function toSqlValue(value) {
    if (value === null || value === undefined) return "NULL"
    if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL"
    if (typeof value === "boolean") return value ? "true" : "false"
    return sqlString(value)
}

async function dynamicInsert(client, tableName, columnsSet, values) {
    const entries = Object.entries(values).filter(([key]) => columnsSet.has(key))
    const columns = entries.map(([key]) => key).join(", ")
    const sqlValues = entries.map(([, value]) => toSqlValue(value)).join(", ")
    const result = await client.query(
        `INSERT INTO ${tableName} (${columns}) VALUES (${sqlValues}) RETURNING id`
    )
    return result.rows[0]?.id
}

async function main() {
    const client = await pool.connect()
    try {
        const now = new Date()
        const month = now.getMonth() + 1
        const year = now.getFullYear()
        const stamp = Date.now()
        const clubName = `SMOKE API HANDOVER ${stamp}`
        const phone1 = `7999${String(stamp).slice(-7)}`
        const phone2 = `7888${String(stamp).slice(-7)}`

        const ownerRes = await client.query(
            "SELECT id, full_name FROM users WHERE phone_number = '79963058814' LIMIT 1"
        )
        if (!ownerRes.rows[0]) {
            throw new Error("Owner 79963058814 not found")
        }
        const ownerId = String(ownerRes.rows[0].id)
        const movementColumns = await getTableColumns(client, "warehouse_stock_movements")
        const receiptColumns = await getTableColumns(client, "shift_receipts")
        const snapshotColumns = await getTableColumns(client, "shift_zone_snapshots")

        await client.query("BEGIN")

        await client.query(
            `INSERT INTO users (full_name, phone_number, is_active)
             VALUES (${sqlString("Smoke Admin 1")}, ${sqlString(phone1)}, true)`
        )
        const admin1Id = String(
            (await client.query(
                `SELECT id FROM users WHERE phone_number = ${sqlString(phone1)}`
            )).rows[0].id
        )

        await client.query(
            `INSERT INTO users (full_name, phone_number, is_active)
             VALUES (${sqlString("Smoke Admin 2")}, ${sqlString(phone2)}, true)`
        )
        const admin2Id = String(
            (await client.query(
                `SELECT id FROM users WHERE phone_number = ${sqlString(phone2)}`
            )).rows[0].id
        )

        const clubId = Number(
            (await client.query(
                `INSERT INTO clubs (name, owner_id, inventory_settings)
                 VALUES (${sqlString(clubName)}, ${sqlString(ownerId)}, '{"sales_capture_mode":"SHIFT"}'::jsonb)
                 RETURNING id`
            )).rows[0].id
        )

        await client.query(
            `INSERT INTO club_employees (club_id, user_id, role, is_active)
             VALUES
             (${clubId}, ${sqlString(admin1Id)}, 'Админ', true),
             (${clubId}, ${sqlString(admin2Id)}, 'Админ', true)`
        )

        const barWarehouseId = Number(
            (await client.query(
                `INSERT INTO warehouses (club_id, name, type, shift_zone_key, shift_accountability_enabled, is_active, is_default)
                 VALUES (${clubId}, 'Бар', 'BAR', 'BAR', true, true, true)
                 RETURNING id`
            )).rows[0].id
        )

        const storageWarehouseId = Number(
            (await client.query(
                `INSERT INTO warehouses (club_id, name, type, shift_accountability_enabled, is_active, is_default)
                 VALUES (${clubId}, 'Склад', 'GENERAL', false, true, false)
                 RETURNING id`
            )).rows[0].id
        )

        const productIds = {}
        for (const [name, cost, sell] of [
            ["Smoke Beer", 50, 150],
            ["Smoke Snack", 40, 120],
            ["Smoke Transfer", 30, 90],
            ["Smoke Waste", 20, 60],
        ]) {
            const result = await client.query(
                `INSERT INTO warehouse_products (club_id, name, cost_price, selling_price, current_stock, is_active)
                 VALUES (${clubId}, ${sqlString(name)}, ${cost}, ${sell}, 0, true)
                 RETURNING id`
            )
            productIds[name] = Number(result.rows[0].id)
        }

        await client.query(
            `INSERT INTO warehouse_stock (warehouse_id, product_id, quantity)
             VALUES
             (${barWarehouseId}, ${productIds["Smoke Beer"]}, 4),
             (${barWarehouseId}, ${productIds["Smoke Snack"]}, 2),
             (${barWarehouseId}, ${productIds["Smoke Transfer"]}, 10),
             (${barWarehouseId}, ${productIds["Smoke Waste"]}, 5),
             (${storageWarehouseId}, ${productIds["Smoke Transfer"]}, 0)`
        )

        await client.query(
            `UPDATE warehouse_products
             SET current_stock = CASE id
               WHEN ${productIds["Smoke Beer"]} THEN 4
               WHEN ${productIds["Smoke Snack"]} THEN 2
               WHEN ${productIds["Smoke Transfer"]} THEN 10
               WHEN ${productIds["Smoke Waste"]} THEN 5
               ELSE current_stock END
             WHERE id IN (${productIds["Smoke Beer"]}, ${productIds["Smoke Snack"]}, ${productIds["Smoke Transfer"]}, ${productIds["Smoke Waste"]})`
        )

        const sourceShiftId = String(
            (await client.query(
                `INSERT INTO shifts (user_id, club_id, check_in, check_out, status, calculated_salary, bar_purchases, total_hours, cash_income, card_income)
                 VALUES (${sqlString(admin2Id)}, ${clubId}, NOW() - interval '3 day', NOW() - interval '3 day' + interval '8 hour', 'CLOSED', 5000, 0, 8, 0, 0)
                 RETURNING id`
            )).rows[0].id
        )

        const currentShiftId = String(
            (await client.query(
                `INSERT INTO shifts (user_id, club_id, check_in, status, calculated_salary, bar_purchases, total_hours, cash_income, card_income)
                 VALUES (${sqlString(admin1Id)}, ${clubId}, NOW() - interval '2 hour', 'ACTIVE', 0, 0, 0, 0, 0)
                 RETURNING id`
            )).rows[0].id
        )

        const openSnapshotId = Number(
            await dynamicInsert(client, "shift_zone_snapshots", snapshotColumns, {
                club_id: clubId,
                shift_id: currentShiftId,
                employee_id: admin1Id,
                warehouse_id: barWarehouseId,
                snapshot_type: "OPEN",
                accepted_from_shift_id: sourceShiftId,
                accepted_from_employee_id: admin2Id,
            })
        )

        await client.query(
            `INSERT INTO shift_zone_snapshot_items (snapshot_id, product_id, counted_quantity, system_quantity)
             VALUES
             (${openSnapshotId}, ${productIds["Smoke Beer"]}, 5, 4),
             (${openSnapshotId}, ${productIds["Smoke Snack"]}, 2, 2),
             (${openSnapshotId}, ${productIds["Smoke Transfer"]}, 10, 10),
             (${openSnapshotId}, ${productIds["Smoke Waste"]}, 5, 5)`
        )

        await client.query(
            `UPDATE warehouse_stock SET quantity = 5 WHERE warehouse_id = ${barWarehouseId} AND product_id = ${productIds["Smoke Beer"]}`
        )
        await client.query(
            `UPDATE warehouse_products SET current_stock = 5 WHERE id = ${productIds["Smoke Beer"]}`
        )
        await dynamicInsert(client, "warehouse_stock_movements", movementColumns, {
            club_id: clubId,
            product_id: productIds["Smoke Beer"],
            user_id: admin1Id,
            change_amount: 1,
            previous_stock: 4,
            new_stock: 5,
            type: "INVENTORY_GAIN",
            reason: `Приемка остатков #${openSnapshotId}: найден излишек`,
            related_entity_type: "SHIFT_ZONE_SNAPSHOT",
            related_entity_id: openSnapshotId,
            shift_id: currentShiftId,
            warehouse_id: barWarehouseId,
            selling_price_snapshot: 150,
        })

        const cashReceiptId = Number(
            await dynamicInsert(client, "shift_receipts", receiptColumns, {
                club_id: clubId,
                shift_id: currentShiftId,
                created_by: admin1Id,
                warehouse_id: barWarehouseId,
                payment_type: "cash",
                cash_amount: 300,
                card_amount: 0,
                total_amount: 300,
                notes: "Smoke cash sale",
                committed_at: now.toISOString(),
                counts_in_revenue: true,
            })
        )
        await client.query(
            `INSERT INTO shift_receipt_items (receipt_id, product_id, quantity, selling_price_snapshot, cost_price_snapshot)
             VALUES (${cashReceiptId}, ${productIds["Smoke Beer"]}, 2, 150, 50)`
        )
        await client.query(
            `UPDATE warehouse_stock SET quantity = 3 WHERE warehouse_id = ${barWarehouseId} AND product_id = ${productIds["Smoke Beer"]}`
        )
        await client.query(
            `UPDATE warehouse_products SET current_stock = 3 WHERE id = ${productIds["Smoke Beer"]}`
        )
        await dynamicInsert(client, "warehouse_stock_movements", movementColumns, {
            club_id: clubId,
            product_id: productIds["Smoke Beer"],
            user_id: admin1Id,
            change_amount: -2,
            previous_stock: 5,
            new_stock: 3,
            type: "SALE",
            reason: `POS чек #${cashReceiptId}`,
            related_entity_type: "SHIFT_RECEIPT",
            related_entity_id: cashReceiptId,
            shift_id: currentShiftId,
            warehouse_id: barWarehouseId,
            selling_price_snapshot: 150,
        })

        const salaryReceiptId = Number(
            await dynamicInsert(client, "shift_receipts", receiptColumns, {
                club_id: clubId,
                shift_id: currentShiftId,
                created_by: admin1Id,
                warehouse_id: barWarehouseId,
                payment_type: "salary",
                cash_amount: 0,
                card_amount: 0,
                total_amount: 120,
                notes: "Smoke salary sale",
                committed_at: now.toISOString(),
                salary_target_user_id: admin2Id,
                salary_target_shift_id: sourceShiftId,
                counts_in_revenue: false,
            })
        )
        await client.query(
            `INSERT INTO shift_receipt_items (receipt_id, product_id, quantity, selling_price_snapshot, cost_price_snapshot)
             VALUES (${salaryReceiptId}, ${productIds["Smoke Snack"]}, 1, 120, 40)`
        )
        await client.query(
            `UPDATE warehouse_stock SET quantity = 1 WHERE warehouse_id = ${barWarehouseId} AND product_id = ${productIds["Smoke Snack"]}`
        )
        await client.query(
            `UPDATE warehouse_products SET current_stock = 1 WHERE id = ${productIds["Smoke Snack"]}`
        )
        await dynamicInsert(client, "warehouse_stock_movements", movementColumns, {
            club_id: clubId,
            product_id: productIds["Smoke Snack"],
            user_id: admin1Id,
            change_amount: -1,
            previous_stock: 2,
            new_stock: 1,
            type: "SALE",
            reason: `В счет ЗП: POS чек #${salaryReceiptId}`,
            related_entity_type: "SHIFT_RECEIPT",
            related_entity_id: salaryReceiptId,
            shift_id: currentShiftId,
            warehouse_id: barWarehouseId,
            selling_price_snapshot: 120,
        })
        await client.query(
            `UPDATE shifts SET bar_purchases = COALESCE(bar_purchases, 0) + 120 WHERE id = ${sqlString(sourceShiftId)}`
        )

        await client.query(
            `UPDATE warehouse_stock SET quantity = 4 WHERE warehouse_id = ${barWarehouseId} AND product_id = ${productIds["Smoke Beer"]}`
        )
        await client.query(
            `UPDATE warehouse_products SET current_stock = 4 WHERE id = ${productIds["Smoke Beer"]}`
        )
        await dynamicInsert(client, "warehouse_stock_movements", movementColumns, {
            club_id: clubId,
            product_id: productIds["Smoke Beer"],
            user_id: admin1Id,
            change_amount: 1,
            previous_stock: 3,
            new_stock: 4,
            type: "SUPPLY",
            reason: "Smoke supply",
            related_entity_type: "SUPPLY",
            shift_id: currentShiftId,
            warehouse_id: barWarehouseId,
            selling_price_snapshot: 150,
        })

        await client.query(
            `UPDATE warehouse_stock SET quantity = 8 WHERE warehouse_id = ${barWarehouseId} AND product_id = ${productIds["Smoke Transfer"]}`
        )
        await client.query(
            `UPDATE warehouse_stock SET quantity = 2 WHERE warehouse_id = ${storageWarehouseId} AND product_id = ${productIds["Smoke Transfer"]}`
        )
        await dynamicInsert(client, "warehouse_stock_movements", movementColumns, {
            club_id: clubId,
            product_id: productIds["Smoke Transfer"],
            user_id: admin1Id,
            change_amount: -2,
            previous_stock: 10,
            new_stock: 8,
            type: "TRANSFER",
            reason: "Smoke transfer out",
            related_entity_type: "TRANSFER",
            shift_id: currentShiftId,
            warehouse_id: barWarehouseId,
            selling_price_snapshot: 90,
        })
        await dynamicInsert(client, "warehouse_stock_movements", movementColumns, {
            club_id: clubId,
            product_id: productIds["Smoke Transfer"],
            user_id: admin1Id,
            change_amount: 2,
            previous_stock: 0,
            new_stock: 2,
            type: "TRANSFER",
            reason: "Smoke transfer in",
            related_entity_type: "TRANSFER",
            shift_id: currentShiftId,
            warehouse_id: storageWarehouseId,
            selling_price_snapshot: 90,
        })

        await client.query(
            `UPDATE warehouse_stock SET quantity = 4 WHERE warehouse_id = ${barWarehouseId} AND product_id = ${productIds["Smoke Waste"]}`
        )
        await client.query(
            `UPDATE warehouse_products SET current_stock = 4 WHERE id = ${productIds["Smoke Waste"]}`
        )
        await dynamicInsert(client, "warehouse_stock_movements", movementColumns, {
            club_id: clubId,
            product_id: productIds["Smoke Waste"],
            user_id: admin1Id,
            change_amount: -1,
            previous_stock: 5,
            new_stock: 4,
            type: "WRITE_OFF",
            reason: "Smoke waste",
            related_entity_type: "WRITE_OFF",
            shift_id: currentShiftId,
            warehouse_id: barWarehouseId,
            selling_price_snapshot: 60,
        })

        const closeSnapshotId = Number(
            await dynamicInsert(client, "shift_zone_snapshots", snapshotColumns, {
                club_id: clubId,
                shift_id: currentShiftId,
                employee_id: admin1Id,
                warehouse_id: barWarehouseId,
                snapshot_type: "CLOSE",
            })
        )
        await client.query(
            `INSERT INTO shift_zone_snapshot_items (snapshot_id, product_id, counted_quantity, system_quantity)
             VALUES
             (${closeSnapshotId}, ${productIds["Smoke Beer"]}, 4, 4),
             (${closeSnapshotId}, ${productIds["Smoke Snack"]}, 1, 1),
             (${closeSnapshotId}, ${productIds["Smoke Transfer"]}, 8, 8),
             (${closeSnapshotId}, ${productIds["Smoke Waste"]}, 4, 4)`
        )

        await client.query("COMMIT")

        const shiftResponse = await fetchJson(
            `http://localhost:3000/api/clubs/${clubId}/shifts/${currentShiftId}`,
            ownerId
        )
        const salaryResponse = await fetchJson(
            `http://localhost:3000/api/clubs/${clubId}/salaries/summary?month=${month}&year=${year}`,
            ownerId
        )
        const admin2Stats = await fetchJson(
            `http://localhost:3000/api/employee/clubs/${clubId}/stats`,
            admin2Id
        )

        const stockRows = (
            await client.query(
                `SELECT warehouse_id, product_id, quantity
                 FROM warehouse_stock
                 WHERE warehouse_id IN (${barWarehouseId}, ${storageWarehouseId})
                   AND product_id IN (${productIds["Smoke Beer"]}, ${productIds["Smoke Snack"]}, ${productIds["Smoke Transfer"]}, ${productIds["Smoke Waste"]})
                 ORDER BY warehouse_id, product_id`
            )
        ).rows

        const stockMap = Object.fromEntries(
            stockRows.map((row) => [`${row.warehouse_id}:${row.product_id}`, Number(row.quantity)])
        )

        const employeeSummary = Array.isArray(salaryResponse.data?.summary)
            ? salaryResponse.data.summary.find((row) => row.full_name === "Smoke Admin 2")
            : null

        const assertions = [
            { name: "shift api 200", ok: shiftResponse.status === 200, got: shiftResponse.status },
            { name: "salary summary 200", ok: salaryResponse.status === 200, got: salaryResponse.status },
            { name: "employee stats 200", ok: admin2Stats.status === 200, got: admin2Stats.status },
            {
                name: "handover source captured",
                ok: shiftResponse.data?.handover_source?.accepted_from_employee_name === "Smoke Admin 2",
                got: shiftResponse.data?.handover_source,
            },
            {
                name: "no discrepancies after full flow",
                ok: Array.isArray(shiftResponse.data?.shift_zone_discrepancies) && shiftResponse.data.shift_zone_discrepancies.length === 0,
                got: shiftResponse.data?.shift_zone_discrepancies,
            },
            {
                name: "salary sale in bar purchases",
                ok: Number(employeeSummary?.total_bar_purchases || 0) === 120,
                got: employeeSummary?.total_bar_purchases,
            },
            {
                name: "salary sale excluded from shift product_sales",
                ok: Array.isArray(shiftResponse.data?.product_sales) && shiftResponse.data.product_sales.length === 1,
                got: shiftResponse.data?.product_sales,
            },
            { name: "final stock p1 = 4", ok: stockMap[`${barWarehouseId}:${productIds["Smoke Beer"]}`] === 4, got: stockMap[`${barWarehouseId}:${productIds["Smoke Beer"]}`] },
            { name: "final stock p2 = 1", ok: stockMap[`${barWarehouseId}:${productIds["Smoke Snack"]}`] === 1, got: stockMap[`${barWarehouseId}:${productIds["Smoke Snack"]}`] },
            { name: "final stock p3 bar = 8", ok: stockMap[`${barWarehouseId}:${productIds["Smoke Transfer"]}`] === 8, got: stockMap[`${barWarehouseId}:${productIds["Smoke Transfer"]}`] },
            { name: "final stock p3 storage = 2", ok: stockMap[`${storageWarehouseId}:${productIds["Smoke Transfer"]}`] === 2, got: stockMap[`${storageWarehouseId}:${productIds["Smoke Transfer"]}`] },
            { name: "final stock p4 = 4", ok: stockMap[`${barWarehouseId}:${productIds["Smoke Waste"]}`] === 4, got: stockMap[`${barWarehouseId}:${productIds["Smoke Waste"]}`] },
            {
                name: "admin2 month earnings reflect bar purchase",
                ok: Number(admin2Stats.data?.month_earnings || 0) === 4880,
                got: admin2Stats.data?.month_earnings,
            },
        ]

        const failed = assertions.filter((item) => !item.ok)
        console.log(
            JSON.stringify(
                {
                    fixture: {
                        ownerId,
                        clubId,
                        currentShiftId,
                        sourceShiftId,
                        phones: [phone1, phone2],
                    },
                    assertions,
                },
                null,
                2
            )
        )

        if (failed.length > 0) {
            process.exitCode = 1
        }
    } finally {
        client.release()
        await pool.end()
    }
}

main().catch((error) => {
    console.error(error)
    process.exit(1)
})
