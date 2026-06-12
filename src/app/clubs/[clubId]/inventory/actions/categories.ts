import { logOperation } from "@/lib/logger";
import { query, getClient } from "@/db";
import { revalidatePath } from "next/cache";
import type { Category } from "./types";
import { assertUserCanAccessClub, requireClubAccess } from "./auth";

export async function getCategories(clubId: string) {
  await requireClubAccess(clubId);
  const res = await query(
    `
        SELECT c.*, p.name as parent_name,
        (SELECT COUNT(*) FROM warehouse_products WHERE category_id = c.id) as products_count
        FROM warehouse_categories c
        LEFT JOIN warehouse_categories p ON c.parent_id = p.id
        WHERE c.club_id = $1
        ORDER BY c.name
    `,
    [clubId],
  );
  return res.rows as Category[];
}

export async function createCategory(
  clubId: string,
  userId: string,
  data: { name: string; description?: string; parent_id?: number | null },
) {
  await assertUserCanAccessClub(clubId, userId);
  // Validation: Unique Name
  const existing = await query(
    `SELECT 1 FROM warehouse_categories WHERE club_id = $1 AND name = $2`,
    [clubId, data.name],
  );
  if (existing.rowCount && existing.rowCount > 0) {
    throw new Error("Категория с таким названием уже существует");
  }

  const res = await query(
    `
        INSERT INTO warehouse_categories (club_id, name, description, parent_id)
        VALUES ($1, $2, $3, $4)
        RETURNING id
    `,
    [clubId, data.name, data.description, data.parent_id],
  );

  await logOperation(
    clubId,
    userId,
    "CREATE_CATEGORY",
    "CATEGORY",
    res.rows[0].id,
    data,
  );
  revalidatePath(`/clubs/${clubId}/inventory`);
}

export async function updateCategory(
  id: number,
  clubId: string,
  userId: string,
  data: { name: string; description?: string; parent_id?: number | null },
) {
  await assertUserCanAccessClub(clubId, userId);
  // Validation: Unique Name (excluding self)
  const existing = await query(
    `SELECT 1 FROM warehouse_categories WHERE club_id = $1 AND name = $2 AND id != $3`,
    [clubId, data.name, id],
  );
  if (existing.rowCount && existing.rowCount > 0) {
    throw new Error("Категория с таким названием уже существует");
  }

  // Validation: Circular Dependency
  if (data.parent_id === id) {
    throw new Error("Категория не может быть родительской для самой себя");
  }

  await query(
    `
        UPDATE warehouse_categories
        SET name = $1, description = $2, parent_id = $3
        WHERE id = $4
    `,
    [data.name, data.description, data.parent_id, id],
  );

  await logOperation(clubId, userId, "UPDATE_CATEGORY", "CATEGORY", id, data);
  revalidatePath(`/clubs/${clubId}/inventory`);
}

export async function deleteCategory(
  id: number,
  clubId: string,
  userId: string,
) {
  await assertUserCanAccessClub(clubId, userId);
  // Check if has products
  const products = await query(
    `SELECT 1 FROM warehouse_products WHERE category_id = $1`,
    [id],
  );
  if (products.rowCount && products.rowCount > 0) {
    throw new Error("Нельзя удалить категорию, к которой привязаны товары");
  }

  await query(`DELETE FROM warehouse_categories WHERE id = $1`, [id]);
  await logOperation(clubId, userId, "DELETE_CATEGORY", "CATEGORY", id);
  revalidatePath(`/clubs/${clubId}/inventory`);
}

// --- WAREHOUSES ---