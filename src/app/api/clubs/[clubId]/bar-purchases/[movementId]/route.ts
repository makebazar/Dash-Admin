import { NextResponse } from 'next/server';
import { query, getClient } from '@/db';
import { cookies } from 'next/headers';

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ clubId: string, movementId: string }> }
) {
    const client = await getClient();
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        const { clubId, movementId } = await params;

        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        // Check if user is owner
        const ownerCheck = await query(`SELECT 1 FROM clubs WHERE id=$1 AND owner_id=$2`, [clubId, userId]);
        if (ownerCheck.rowCount === 0) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

        await client.query('BEGIN');

        // 1. Get movement details
        const movementRes = await client.query(`
            SELECT 
                m.*, 
                p.selling_price
            FROM warehouse_stock_movements m
            JOIN warehouse_products p ON m.product_id = p.id
            WHERE m.id = $1 AND m.club_id = $2 AND m.type = 'SALE' AND m.reason LIKE 'В счет ЗП%'
        `, [movementId, clubId]);

        if (movementRes.rowCount === 0) {
            throw new Error('Транзакция не найдена или уже удалена');
        }

        const movement = movementRes.rows[0];
        const productId = movement.product_id;
        const quantityToReturn = Math.abs(movement.change_amount);
        const totalAmount = movement.selling_price * quantityToReturn;
        const shiftId = movement.shift_id;
        const warehouseId = movement.warehouse_id;

        // 2. Return stock to warehouse
        // Use the warehouse where it was originally taken from
        let finalWarehouseId = warehouseId;

        if (!finalWarehouseId) {
            const whRes = await client.query(`
                SELECT id FROM warehouses WHERE club_id = $1 ORDER BY is_default DESC LIMIT 1
            `, [clubId]);
            finalWarehouseId = whRes.rows[0]?.id;
        }

        if (finalWarehouseId) {
            await client.query(`
                INSERT INTO warehouse_stock (warehouse_id, product_id, quantity)
                VALUES ($1, $2, $3)
                ON CONFLICT (warehouse_id, product_id) DO UPDATE 
                SET quantity = warehouse_stock.quantity + $3
            `, [finalWarehouseId, productId, quantityToReturn]);
        }

        // 3. Update product cache
        await client.query(`
            UPDATE warehouse_products
            SET current_stock = (SELECT COALESCE(SUM(quantity), 0) FROM warehouse_stock WHERE product_id = $1)
            WHERE id = $1
        `, [productId]);

        // 4. Update shift bar_purchases
        if (shiftId) {
            await client.query(`
                UPDATE shifts 
                SET bar_purchases = GREATEST(0, COALESCE(bar_purchases, 0) - $1)
                WHERE id = $2
            `, [totalAmount, shiftId]);
        }

        // 5. Delete the movement record
        await client.query(`DELETE FROM warehouse_stock_movements WHERE id = $1`, [movementId]);

        await client.query('COMMIT');

        return NextResponse.json({ success: true });
    } catch (error: any) {
        await client.query('ROLLBACK');
        console.error('Delete bar purchase error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    } finally {
        client.release();
    }
}
