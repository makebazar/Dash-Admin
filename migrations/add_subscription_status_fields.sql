ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(30) DEFAULT 'trialing';
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_canceled_at TIMESTAMP;
ALTER TABLE users ALTER COLUMN subscription_started_at SET DEFAULT NOW();

UPDATE users
SET subscription_status = CASE
    WHEN subscription_plan = 'new_user' THEN 'trialing'
    WHEN subscription_ends_at IS NOT NULL AND subscription_ends_at < NOW() THEN 'expired'
    ELSE 'active'
END
WHERE subscription_status IS NULL;
