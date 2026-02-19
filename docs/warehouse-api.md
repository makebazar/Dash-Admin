# Warehouse System API Documentation

## Overview
The Warehouse System is built using Next.js Server Actions. All actions are located in `src/app/clubs/[clubId]/inventory/actions.ts`.

## Authentication
All actions require a valid `session_user_id` cookie. Access is scoped to the `clubId` provided in the path or arguments.

## 1. Categories Management

### Get Categories
`getCategories(clubId: string): Promise<Category[]>`
- Returns a list of categories for the club.
- Includes `parent_name` and `products_count`.

### Create Category
`createCategory(clubId: string, userId: string, data: CategoryInput): Promise<void>`
- **Input**: `{ name: string, description?: string, parent_id?: number }`
- **Validation**: Checks for unique name within the club.
- **Logging**: Logs `CREATE_CATEGORY` operation.

### Update Category
`updateCategory(id: number, clubId: string, userId: string, data: CategoryInput): Promise<void>`
- **Validation**: Checks for unique name and circular dependency (cannot be own parent).
- **Logging**: Logs `UPDATE_CATEGORY` operation.

### Delete Category
`deleteCategory(id: number, clubId: string, userId: string): Promise<void>`
- **Validation**: Cannot delete if products are assigned to this category.
- **Logging**: Logs `DELETE_CATEGORY` operation.

## 2. Warehouse Management

### Get Warehouses
`getWarehouses(clubId: string): Promise<Warehouse[]>`
- Returns a list of warehouses.
- Includes `responsible_name` (joined from Users).

### Create Warehouse
`createWarehouse(clubId: string, userId: string, data: WarehouseInput): Promise<void>`
- **Input**: 
  - `name`: string (Required)
  - `address`: string
  - `type`: string (GENERAL, COLD_STORAGE, etc.)
  - `responsible_user_id`: string (UUID)
  - `contact_info`: string
  - `characteristics`: JSON object (area, temperature, etc.)
- **Logging**: Logs `CREATE_WAREHOUSE` operation.

### Update Warehouse
`updateWarehouse(id: number, clubId: string, userId: string, data: WarehouseInput): Promise<void>`
- Updates warehouse details.
- **Logging**: Logs `UPDATE_WAREHOUSE` operation.

## 3. Data Models

### Category
```typescript
type Category = {
    id: number
    name: string
    description?: string
    parent_id?: number
    parent_name?: string
}
```

### Warehouse
```typescript
type Warehouse = {
    id: number
    name: string
    address?: string
    type: string
    responsible_user_id?: string
    characteristics?: Record<string, any>
}
```

## 4. Logging
All state-changing operations are logged to the `operation_logs` table via `logOperation` utility.
