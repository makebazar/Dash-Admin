-- 1. Добавляем реферальный код игрокам
ALTER TABLE promo_players ADD COLUMN IF NOT EXISTS referral_code VARCHAR(32) UNIQUE;

-- 2. Генерируем уникальные коды для уже существующих игроков
UPDATE promo_players 
SET referral_code = 'INV-' || UPPER(substring(md5(random()::text) from 1 for 6))
WHERE referral_code IS NULL;

-- 3. Создаем таблицу реферальных связей
CREATE TABLE IF NOT EXISTS promo_referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_id UUID NOT NULL REFERENCES promo_players(id) ON DELETE CASCADE,
    referred_id UUID NOT NULL UNIQUE REFERENCES promo_players(id) ON DELETE CASCADE,
    status VARCHAR(32) DEFAULT 'registered', -- 'registered', 'threshold_reached'
    total_referred_deposits NUMERIC(10, 2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Создаем индексы
CREATE INDEX IF NOT EXISTS idx_promo_referrals_referrer ON promo_referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_promo_referrals_referred ON promo_referrals(referred_id);
