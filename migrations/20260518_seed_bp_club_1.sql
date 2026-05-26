-- INITIAL BATTLE PASS DATA FOR CLUB ID 1

BEGIN;

-- 1. Create Active Season
INSERT INTO promo_bp_seasons (club_id, name, start_date, end_date, is_active)
VALUES (
    1,
    'Сезон 1: Кибер-Лето 2026',
    NOW(),
    NOW() + interval '30 days',
    TRUE
);

-- 2. Define Levels and Rewards (30 Tiers)
-- 1 RUB = 1 XP
-- Every level has a Premium reward.
-- Every 5th level has a Free reward.

-- Tier 1
INSERT INTO promo_bp_tiers (season_id, level_number, xp_required, reward_type, reward_value, reward_name, is_premium) VALUES
((SELECT id FROM promo_bp_seasons WHERE club_id = 1 AND is_active = TRUE LIMIT 1), 1, 300, 'bonus_balance', 50, '50 Бонусов', TRUE);

-- Tier 2
INSERT INTO promo_bp_tiers (season_id, level_number, xp_required, reward_type, reward_value, reward_name, is_premium) VALUES
((SELECT id FROM promo_bp_seasons WHERE club_id = 1 AND is_active = TRUE LIMIT 1), 2, 600, 'ticket', 2, '2 Билета', TRUE);

-- Tier 3
INSERT INTO promo_bp_tiers (season_id, level_number, xp_required, reward_type, reward_value, reward_name, is_premium) VALUES
((SELECT id FROM promo_bp_seasons WHERE club_id = 1 AND is_active = TRUE LIMIT 1), 3, 1000, 'bonus_balance', 100, '100 Бонусов', TRUE);

-- Tier 4
INSERT INTO promo_bp_tiers (season_id, level_number, xp_required, reward_type, reward_value, reward_name, is_premium) VALUES
((SELECT id FROM promo_bp_seasons WHERE club_id = 1 AND is_active = TRUE LIMIT 1), 4, 1500, 'xp_boost', 24, 'Бустер x2 (24ч)', TRUE);

-- Tier 5 (Free + Premium)
INSERT INTO promo_bp_tiers (season_id, level_number, xp_required, reward_type, reward_value, reward_name, is_premium) VALUES
((SELECT id FROM promo_bp_seasons WHERE club_id = 1 AND is_active = TRUE LIMIT 1), 5, 2000, 'ticket', 1, '1 Билет (Free)', FALSE),
((SELECT id FROM promo_bp_seasons WHERE club_id = 1 AND is_active = TRUE LIMIT 1), 5, 2000, 'bonus_balance', 200, '200 Бонусов', TRUE);

-- Tier 6
INSERT INTO promo_bp_tiers (season_id, level_number, xp_required, reward_type, reward_value, reward_name, is_premium) VALUES
((SELECT id FROM promo_bp_seasons WHERE club_id = 1 AND is_active = TRUE LIMIT 1), 6, 2500, 'ticket', 3, '3 Билета', TRUE);

-- Tier 7
INSERT INTO promo_bp_tiers (season_id, level_number, xp_required, reward_type, reward_value, reward_name, is_premium) VALUES
((SELECT id FROM promo_bp_seasons WHERE club_id = 1 AND is_active = TRUE LIMIT 1), 7, 3000, 'bonus_balance', 150, '150 Бонусов', TRUE);

-- Tier 8
INSERT INTO promo_bp_tiers (season_id, level_number, xp_required, reward_type, reward_value, reward_name, is_premium) VALUES
((SELECT id FROM promo_bp_seasons WHERE club_id = 1 AND is_active = TRUE LIMIT 1), 8, 3500, 'xp_boost', 24, 'Бустер x2 (24ч)', TRUE);

-- Tier 10 (Free + Premium)
INSERT INTO promo_bp_tiers (season_id, level_number, xp_required, reward_type, reward_value, reward_name, is_premium) VALUES
((SELECT id FROM promo_bp_seasons WHERE club_id = 1 AND is_active = TRUE LIMIT 1), 10, 5000, 'bonus_balance', 100, '100 Бонусов (Free)', FALSE),
((SELECT id FROM promo_bp_seasons WHERE club_id = 1 AND is_active = TRUE LIMIT 1), 10, 5000, 'bonus_balance', 500, '500 Бонусов', TRUE);

-- Tier 15 (Free + Premium)
INSERT INTO promo_bp_tiers (season_id, level_number, xp_required, reward_type, reward_value, reward_name, is_premium) VALUES
((SELECT id FROM promo_bp_seasons WHERE club_id = 1 AND is_active = TRUE LIMIT 1), 15, 8000, 'ticket', 5, '5 Билетов (Free)', FALSE),
((SELECT id FROM promo_bp_seasons WHERE club_id = 1 AND is_active = TRUE LIMIT 1), 15, 8000, 'bonus_balance', 800, '800 Бонусов', TRUE);

-- Tier 20 (Free + Premium)
INSERT INTO promo_bp_tiers (season_id, level_number, xp_required, reward_type, reward_value, reward_name, is_premium) VALUES
((SELECT id FROM promo_bp_seasons WHERE club_id = 1 AND is_active = TRUE LIMIT 1), 20, 12000, 'bonus_balance', 200, '200 Бонусов (Free)', FALSE),
((SELECT id FROM promo_bp_seasons WHERE club_id = 1 AND is_active = TRUE LIMIT 1), 20, 12000, 'bonus_balance', 1000, '1000 Бонусов', TRUE);

-- Tier 25 (Free + Premium)
INSERT INTO promo_bp_tiers (season_id, level_number, xp_required, reward_type, reward_value, reward_name, is_premium) VALUES
((SELECT id FROM promo_bp_seasons WHERE club_id = 1 AND is_active = TRUE LIMIT 1), 25, 18000, 'ticket', 10, '10 Билетов (Free)', FALSE),
((SELECT id FROM promo_bp_seasons WHERE club_id = 1 AND is_active = TRUE LIMIT 1), 25, 18000, 'xp_boost', 48, 'Мега-Бустер x2 (48ч)', TRUE);

-- Tier 30 (MAX)
INSERT INTO promo_bp_tiers (season_id, level_number, xp_required, reward_type, reward_value, reward_name, is_premium) VALUES
((SELECT id FROM promo_bp_seasons WHERE club_id = 1 AND is_active = TRUE LIMIT 1), 30, 25000, 'bonus_balance', 500, '500 Бонусов (Free)', FALSE),
((SELECT id FROM promo_bp_seasons WHERE club_id = 1 AND is_active = TRUE LIMIT 1), 30, 25000, 'bonus_balance', 3000, 'ДЖЕКПОТ: 3000 Бонусов', TRUE);

COMMIT;
