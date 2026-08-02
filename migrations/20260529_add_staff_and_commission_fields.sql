-- Add is_staff to users and referral commission configuration to clubs

-- 1. Add is_staff to users
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS is_staff BOOLEAN DEFAULT FALSE;

-- Create index for staff members
CREATE INDEX IF NOT EXISTS idx_users_is_staff ON users(is_staff) WHERE is_staff = TRUE;

-- 2. Add commission configuration fields to clubs
ALTER TABLE clubs 
ADD COLUMN IF NOT EXISTS referral_reward_type VARCHAR(20) DEFAULT 'percentage';

ALTER TABLE clubs 
ADD COLUMN IF NOT EXISTS referral_reward_value DECIMAL(10, 2) DEFAULT 0.00;
