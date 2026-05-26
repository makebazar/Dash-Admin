-- ==============================================================================
-- Скрипт инициализации Геймификации и Экономики для Клуба ID 1
-- Включает: Уровни (Levels), Призы (Prizes) для игр и 16 Квестов (Quests).
-- ==============================================================================

BEGIN;

-- Определение недостающих колонок на случай, если предыдущие миграции не отработали
ALTER TABLE promo_prizes ADD COLUMN IF NOT EXISTS min_level INTEGER DEFAULT 1;
ALTER TABLE promo_prizes ADD COLUMN IF NOT EXISTS max_level INTEGER DEFAULT 999;
ALTER TABLE promo_prizes ADD COLUMN IF NOT EXISTS game_slug VARCHAR(50);
ALTER TABLE promo_prizes ADD COLUMN IF NOT EXISTS win_condition JSONB;

ALTER TABLE promo_quests ADD COLUMN IF NOT EXISTS reset_period VARCHAR(20) DEFAULT 'none';
ALTER TABLE promo_quests ADD COLUMN IF NOT EXISTS requires_photo_verification BOOLEAN DEFAULT FALSE;
ALTER TABLE promo_quests ADD COLUMN IF NOT EXISTS min_level INTEGER DEFAULT 1;

-- 0. Деактивация старых данных для клуба 1 (вместо удаления, чтобы не нарушать связи в истории)
UPDATE promo_prizes SET is_active = FALSE WHERE club_id = 1;
UPDATE promo_quests SET is_active = FALSE WHERE club_id = 1;
-- Уровни можно удалять, так как на них обычно нет прямых FK с данными игроков (только расчетные)
DELETE FROM promo_levels WHERE club_id = 1;

-- ==============================================================================
-- 1. PROMO LEVELS (Уровни XP)
-- 1 RUB = 1 XP
-- ==============================================================================
INSERT INTO promo_levels (club_id, level_number, xp_required) VALUES
(1, 1, 0),         -- Базовый
(1, 2, 1000),      -- Бронза
(1, 3, 3000),      -- Серебро
(1, 4, 7000),      -- Золото
(1, 5, 15000),     -- Платина
(1, 6, 30000);     -- Diamond

-- ==============================================================================
-- 2. PROMO PRIZES (Призовой фонд по играм)
-- Тип всегда 'virtual' (Бонусные рубли)
-- ==============================================================================

-- ИГРА: КОЛЕСО ФОРТУНЫ (game_slug: 'wheel')
INSERT INTO promo_prizes (club_id, name, type, value, probability, min_level, game_slug) VALUES
(1, 'Пусто', 'virtual', 0, 35.00, 1, 'wheel'),                 -- 35%
(1, '50 Бонусов', 'virtual', 50, 40.00, 1, 'wheel'),           -- 40%
(1, '100 Бонусов', 'virtual', 100, 15.00, 1, 'wheel'),         -- 15%
(1, '300 Бонусов', 'virtual', 300, 8.00, 3, 'wheel'),          -- 8% (Открывается на Ур. 3)
(1, '500 Бонусов', 'virtual', 500, 2.00, 5, 'wheel');          -- 2% (Открывается на Ур. 5)

-- ИГРА: СЕЙФ (game_slug: 'safe')
INSERT INTO promo_prizes (club_id, name, type, value, probability, min_level, game_slug) VALUES
(1, '500 Бонусов', 'virtual', 500, 70.00, 1, 'safe'),          -- 70% из пула (при угадывании)
(1, '1500 Бонусов', 'virtual', 1500, 30.00, 4, 'safe');        -- 30% из пула (с Ур. 4)

-- ИГРА: КОСТИ (game_slug: 'dice')
-- Для костей probability не имеет значения, важен win_condition (JSON)
INSERT INTO promo_prizes (club_id, name, type, value, probability, min_level, game_slug, win_condition) VALUES
(1, '50 Бонусов', 'virtual', 50, 0, 1, 'dice', '{"dice_sums": [7, 8]}'),                   -- Сумма 7 или 8
(1, '200 Бонусов', 'virtual', 200, 0, 2, 'dice', '{"dice_double": "any"}'),                -- Любой дубль
(1, '1000 Бонусов', 'virtual', 1000, 0, 4, 'dice', '{"dice_double": 6}');                  -- Две шестерки

-- ИГРА: ТРИ КАРТЫ (game_slug: 'cards')
INSERT INTO promo_prizes (club_id, name, type, value, probability, min_level, game_slug) VALUES
(1, 'Пусто', 'virtual', 0, 45.00, 1, 'cards'),                 -- 45%
(1, '100 Бонусов', 'virtual', 100, 40.00, 1, 'cards'),         -- 40%
(1, '300 Бонусов', 'virtual', 300, 12.00, 2, 'cards'),         -- 12% (с Ур. 2)
(1, '1000 Бонусов', 'virtual', 1000, 3.00, 4, 'cards');        -- 3% (с Ур. 4)

-- ==============================================================================
-- 3. PROMO QUESTS (Система квестов на 16 заданий)
-- ==============================================================================

-- =======================
-- УРОВЕНЬ 1 (Вовлечение)
-- =======================
INSERT INTO promo_quests (club_id, title, description, trigger_type, target_value, reward_tickets, reward_xp, reward_bonus_balance, reset_period) VALUES
(1, 'Разгон', 'Пополни баланс на 500₽ одним платежом.', 'balance_topup', 500, 1, 0, 0, 'none'),
(1, 'Легкий перекус', 'Соверши покупку в баре от 300₽ одним чеком.', 'receipt_total', 300, 1, 0, 0, 'none');

INSERT INTO promo_quests (club_id, title, description, trigger_type, target_value, target_entity_id, reward_tickets, reward_xp, reward_bonus_balance, reset_period) VALUES
(1, 'Энергетический запас', 'Купи 2 любых энергетика в одном чеке.', 'receipt_item', 2, '27', 1, 0, 0, 'none');

INSERT INTO promo_quests (club_id, title, description, trigger_type, target_value, reward_tickets, reward_xp, reward_bonus_balance, reset_period, requires_photo_verification) VALUES
(1, 'Победа дня', 'Выиграй 1 матч в MM (CS2, Dota 2, Valorant). Скинь скриншот!', 'manual_verification', 1, 0, 50, 20, 'daily', TRUE);

-- =======================
-- УРОВЕНЬ 2 (От 1,000 XP)
-- =======================
INSERT INTO promo_quests (club_id, title, description, trigger_type, target_value, reward_tickets, reward_xp, reward_bonus_balance, reset_period, min_level) VALUES
(1, 'Плотная катка', 'Пополни баланс на 1,000₽ одним платежом.', 'balance_topup', 1000, 2, 100, 0, 'none', 2),
(1, 'Плотный ужин', 'Соверши покупку в баре от 700₽ одним чеком.', 'receipt_total', 700, 2, 50, 0, 'none', 2);

INSERT INTO promo_quests (club_id, title, description, trigger_type, target_value, target_entity_id, reward_tickets, reward_xp, reward_bonus_balance, reset_period, min_level) VALUES
(1, 'Геймерский сет', 'Купи пакет "3 ЧАСА" или "5 ЧАСОВ".', 'service_award', 1, 'hv216413f,81cnfpaft', 1, 50, 0, 'none', 2);

INSERT INTO promo_quests (club_id, title, description, trigger_type, target_value, reward_tickets, reward_xp, reward_bonus_balance, reset_period, requires_photo_verification, min_level) VALUES
(1, 'MVP Матча', 'Стань MVP в матчмейкинге. Докажи скриншотом!', 'manual_verification', 1, 0, 100, 50, 'daily', TRUE, 2),
(1, 'Кибер-Атлет', 'Сделай 30+ киллов в CS2/Valorant или 15+ в Dota 2.', 'manual_verification', 1, 0, 100, 50, 'daily', TRUE, 2);

-- =======================
-- УРОВЕНЬ 3 (От 3,000 XP)
-- =======================
INSERT INTO promo_quests (club_id, title, description, trigger_type, target_value, reward_tickets, reward_xp, reward_bonus_balance, reset_period, min_level) VALUES
(1, 'Инвестор', 'Пополни баланс на 2,000₽ одним платежом.', 'balance_topup', 2000, 5, 300, 0, 'none', 3),
(1, 'Барный Босс', 'Разовая покупка в баре от 1,500₽.', 'receipt_total', 1500, 4, 200, 0, 'none', 3);

INSERT INTO promo_quests (club_id, title, description, trigger_type, target_value, target_entity_id, reward_tickets, reward_xp, reward_bonus_balance, reset_period, min_level) VALUES
(1, 'Профессионал', 'Купи любой пакет в зоне BOOTCAMP или SOLO.', 'service_award', 1, '', 2, 100, 0, 'none', 3);

INSERT INTO promo_quests (club_id, title, description, trigger_type, target_value, reward_tickets, reward_xp, reward_bonus_balance, reset_period, requires_photo_verification, min_level) VALUES
(1, 'Винстрик', 'Сделай 3 победы подряд за одну сессию.', 'manual_verification', 1, 0, 200, 100, 'weekly', TRUE, 3),
(1, 'Клатч Мастер / Ранкап', 'Вытащи сложный клатч или повысь ранг.', 'manual_verification', 1, 0, 250, 0, 'weekly', TRUE, 3);

-- =======================
-- УРОВНИ 4-6 (VIP/Хардкор)
-- =======================
INSERT INTO promo_quests (club_id, title, description, trigger_type, target_value, reward_tickets, reward_xp, reward_bonus_balance, reset_period, min_level) VALUES
(1, 'Спонсор Клуба', 'Пополни баланс на 5,000₽ одним платежом.', 'balance_topup', 5000, 15, 1000, 0, 'none', 5),
(1, 'Завсегдатай бара', 'Потрать в баре 3,000₽ накопительно за неделю.', 'receipt_total', 3000, 7, 500, 0, 'weekly', 4);

INSERT INTO promo_quests (club_id, title, description, trigger_type, target_value, target_entity_id, reward_tickets, reward_xp, reward_bonus_balance, reset_period, min_level) VALUES
(1, 'Режим Совы', 'Купи пакет "НОЧЬ" 3 раза за неделю.', 'service_award', 3, 'tj521qbrd', 4, 300, 0, 'weekly', 4);

INSERT INTO promo_quests (club_id, title, description, trigger_type, target_value, reward_tickets, reward_xp, reward_bonus_balance, reset_period, requires_photo_verification, min_level) VALUES
(1, 'Rampage / Ace', 'Сделай Эйс (-5) в CS2 или Rampage в Dota 2.', 'manual_verification', 1, 3, 500, 500, 'none', TRUE, 4);

COMMIT;
