import { query } from "@/db"

export const SUPPORT_CATEGORIES = ["GENERAL", "BILLING", "TECHNICAL", "ACCESS", "BUG", "FEATURE"] as const
export const SUPPORT_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const
export const SUPPORT_STATUSES = ["OPEN", "IN_PROGRESS", "ANSWERED", "CLOSED"] as const

export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number]
export type SupportPriority = (typeof SUPPORT_PRIORITIES)[number]
export type SupportStatus = (typeof SUPPORT_STATUSES)[number]

export async function ensureSupportTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS support_tickets (
      id SERIAL PRIMARY KEY,
      user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
      guest_name VARCHAR(255) NULL,
      guest_email VARCHAR(255) NULL,
      guest_phone VARCHAR(50) NULL,
      source VARCHAR(32) NOT NULL DEFAULT 'web',
      subject VARCHAR(255) NOT NULL,
      category VARCHAR(32) NOT NULL DEFAULT 'GENERAL',
      priority VARCHAR(16) NOT NULL DEFAULT 'MEDIUM',
      status VARCHAR(16) NOT NULL DEFAULT 'OPEN',
      description TEXT NOT NULL,
      assigned_to UUID NULL REFERENCES users(id) ON DELETE SET NULL,
      closed_at TIMESTAMP NULL,
      last_message_at TIMESTAMP NOT NULL DEFAULT NOW(),
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `)

  await query(`
    CREATE TABLE IF NOT EXISTS support_messages (
      id SERIAL PRIMARY KEY,
      ticket_id INTEGER NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
      sender_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
      sender_name VARCHAR(255) NULL,
      sender_email VARCHAR(255) NULL,
      sender_phone VARCHAR(50) NULL,
      message TEXT NOT NULL,
      is_staff BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `)

  await query(`CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON support_tickets(user_id, created_at DESC)`)
  await query(`CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status, last_message_at DESC)`)
  await query(`CREATE INDEX IF NOT EXISTS idx_support_messages_ticket_id ON support_messages(ticket_id, created_at ASC)`)

  await query(`ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS assigned_to UUID NULL`)
  await query(`ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP NULL`)
  await query(`ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMP NOT NULL DEFAULT NOW()`)
  await query(`ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS guest_name VARCHAR(255) NULL`)
  await query(`ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS guest_email VARCHAR(255) NULL`)
  await query(`ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS guest_phone VARCHAR(50) NULL`)
  await query(`ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS source VARCHAR(32) NOT NULL DEFAULT 'web'`)
  await query(`ALTER TABLE support_tickets ALTER COLUMN user_id DROP NOT NULL`)
  await query(`ALTER TABLE support_messages ALTER COLUMN sender_id DROP NOT NULL`)
  await query(`ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS sender_name VARCHAR(255) NULL`)
  await query(`ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS sender_email VARCHAR(255) NULL`)
  await query(`ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS sender_phone VARCHAR(50) NULL`)

  await query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'support_tickets_assigned_to_fkey'
      ) THEN
        ALTER TABLE support_tickets
        ADD CONSTRAINT support_tickets_assigned_to_fkey
        FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL;
      END IF;
    END $$;
  `)
}
