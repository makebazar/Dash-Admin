-- Add subscription fields to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_plan VARCHAR(50) DEFAULT 'starter';
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_started_at TIMESTAMP DEFAULT NOW();
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_ends_at TIMESTAMP;
