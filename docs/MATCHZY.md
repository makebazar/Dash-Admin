# MatchZy — Полное руководство по интеграции для DashAdmin & DashMatch

> **MatchZy** — это открытый плагин для CS2 (CounterStrikeSharp), предназначенный для проведения соревновательных матчей, PUG/миксов, турниров и тренировок. Является прямым преемником Get5 для CS2 и полностью совместим с его форматами и API.

---

## 1. Архитектура интеграции с DashAdmin

```
┌────────────────────────────────────────────────────────────────────────┐
│                        DashAdmin (Облако / SaaS)                       │
│  - Лобби / Matchmaking / Турнирные сетки                               │
│  - ELO расчет (src/lib/elo.ts) с учетом ADR, Kills, K-factor           │
│  - Webhook Endpoint: POST /api/clubs/[clubId]/cs2/webhook              │
│  - Match Config Provider: GET /api/cs2/matches/[matchId]/config        │
└───────────────────▲────────────────────────────────────▲───────────────┘
                    │                                    │
          WebSocket │ Команды / Heartbeat       HTTP     │ Webhook Events
                    ▼                                    │ (POST JSON)
┌───────────────────────────────────────┐                │
│    DashMatch Agent (Go / Сервер ПК)   │                │
│  - Управление процессами cs2.exe      │                │
│  - Выделение портов (27015, 27016...) │                │
│  - RCON клиент                        │                │
└───────────────────┬───────────────────┘                │
                    │ RCON (matchzy_loadmatch_url / ...) │
                    ▼                                    │
┌────────────────────────────────────────────────────────┴───────────────┐
│                    CS2 Dedicated Server (srcds)                        │
│   Metamod:Source + CounterStrikeSharp (CSS)                            │
│   └── MatchZy Plugin (MatchZy.dll)                                     │
│       ├── Загружает конфиг матча (ростеры команд по SteamID64)        │
│       ├── Knife раунд / Ready / Паузы / Veto / Whitelist               │
│       ├── Собирает точный ADR, Kills, Deaths, Headshots, Utility Dmg   │
│       └── Шлет Webhooks на DashAdmin при каждом событии                │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Установка на CS2 Dedicated Server

### Требования:
1. **CS2 Dedicated Server** (`cs2.exe` / `cs2.sh` установлен через SteamCMD, AppID: 730).
2. **Metamod:Source v2.x** (установлен в `game/csgo/addons/metamod`).
3. **CounterStrikeSharp (CSS)** — версия `v369+` (.NET 10 runtime build):
   - Папка `game/csgo/addons/counterstrikesharp/`
4. **MatchZy**:
   - Скачать архив релиза MatchZy и распаковать в `game/csgo/`:
     - `game/csgo/addons/counterstrikesharp/plugins/MatchZy/MatchZy.dll`
     - `game/csgo/addons/counterstrikesharp/gamedata/matchzy.json`
     - `game/csgo/cfg/MatchZy/`

### Проверка работоспособности:
В консоли сервера CS2:
```bash
meta list              # Должен отображать CounterStrikeSharp
css_plugins list       # Должен отображать MatchZy by WD-
```

---

## 3. Настройка (CVARs и Конфигурация)

Основные конфигурационные файлы располагаются в `game/csgo/cfg/MatchZy/`:
- `config.cfg` — общие параметры плагина
- `whitelist.cfg` — список SteamID64 игроков
- `admins.json` — админы по SteamID64
- `database.json` — подключение к SQLite / MySQL
- `live.cfg`, `warmup.cfg`, `knife.cfg`, `prac.cfg` — серверные настройки фаз матча

### Ключевые переменные MatchZy (CVARs):

| CVAR / Команда | По умолчанию | Описание |
|---|---|---|
| `matchzy_remote_log_url` | `""` | **URL для отправки вебхуков** всех событий матча (POST JSON) |
| `matchzy_remote_log_header_key` | `""` | Имя заголовка авторизации вебхука (напр. `Authorization` или `X-Club-Token`) |
| `matchzy_remote_log_header_value` | `""` | Значение заголовка авторизации |
| `matchzy_autostart_mode` | `1` | `0` — ничего, `1` — Match mode, `2` — Practice mode |
| `matchzy_kick_when_no_match_loaded` | `false` | Кикать ли игроков, если конфиг матча не загружен |
| `matchzy_whitelist_enabled_default` | `false` | Включен ли вайтлист по умолчанию |
| `matchzy_knife_enabled_default` | `true` | Включен ли ножевой раунд за сторону |
| `matchzy_playout_enabled_default` | `false` | Играть ли все раунды (для скримов / разминок) |
| `matchzy_allow_force_ready` | `true` | Разрешена ли команда `!forceready` |
| `matchzy_enable_damage_report` | `true` | Показывать ли урон в чате после раунда |
| `matchzy_hostname_format` | `"MatchZy \| {TEAM1} vs {TEAM2}"` | Формат названия сервера в поиске |
| `matchzy_demo_recording_enabled` | `true` | Автоматическая запись GOTV демок |
| `matchzy_demo_upload_url` | `""` | URL куда автоматически заливать архив демки по завершении |
| `matchzy_remote_backup_url` | `""` | URL куда слать раунд-бэкапы для удаленного восстановления |

---

## 4. Запуск и управление матчем (Match Setup)

MatchZy загружает матчи двумя RCON командами:
1. `matchzy_loadmatch <filepath>` — загрузка локального JSON файла из папки `game/csgo/`.
2. `matchzy_loadmatch_url "<url>" "[header_name]" "[header_value]"` — загрузка конфигурации матча по HTTP(S) GET с авторизационным заголовком.

### JSON Схема конфигурации матча (Get5 Compatible):

```json
{
  "matchid": "match_club1_1042",
  "num_maps": 1,
  "maplist": [
    "de_mirage"
  ],
  "map_sides": [
    "knife"
  ],
  "clinch_series": true,
  "players_per_team": 5,
  "skip_veto": true,
  "team1": {
    "name": "Team Spirit Local",
    "tag": "TS",
    "players": {
      "76561198012345678": "PlayerOne",
      "76561198012345679": "PlayerTwo",
      "76561198012345680": "PlayerThree",
      "76561198012345681": "PlayerFour",
      "76561198012345682": "PlayerFive"
    }
  },
  "team2": {
    "name": "Cloud9 Local",
    "tag": "C9",
    "players": [
      "76561198098765431",
      "76561198098765432",
      "76561198098765433",
      "76561198098765434",
      "76561198098765435"
    ]
  },
  "spectators": {
    "players": {
      "76561198000000000": "Admin/Referee"
    }
  },
  "cvars": {
    "hostname": "DashAdmin CS2: Arena #1",
    "mp_friendlyfire": "0",
    "matchzy_remote_log_url": "https://api.mydashadmin.ru/api/clubs/1/cs2/webhook",
    "matchzy_remote_log_header_key": "X-Club-Match-Token",
    "matchzy_remote_log_header_value": "super_secret_club_token_123"
  }
}
```

> **Важно**: При загрузке матча MatchZy автоматически включает Whitelist: на сервер могут зайти **только те SteamID64**, которые перечислены в `team1`, `team2` или `spectators`! Лишние игроки не смогут подключиться.

---

## 5. Webhook События (Outbound HTTP JSON)

MatchZy шлет HTTP POST запросы на `matchzy_remote_log_url` с таймаутом 15 секунд. Ответ сервера должен быть `200 OK`.

Каждое событие содержит поле `"event"`.

### Список событий MatchZy:

| Название события (`event`) | Когда срабатывает | Что передается в payload |
|---|---|---|
| `series_start` | Старт серии после загрузки конфига | `matchid`, `num_maps`, `team1`, `team2` |
| `going_live` | Завершение разминки/ножевого, старт игры | `matchid`, `map_number`, `map_name` |
| `round_start` | Старт нового раунда | `matchid`, `round_number` |
| `player_death` | Убийство игрока | Убийца, жертва, ассистент, оружие, headshot, flash_assist |
| `bomb_planted` | Установка C4 | SteamID игрока, плент (`A` / `B`) |
| `bomb_defused` | Разминирование C4 | SteamID игрока, оставшееся время |
| `round_end` | Окончание раунда | Победившая команда (`team1`/`team2`), причина победы, счет команд |
| `map_result` | Окончание карты | Итоговый счет карты, победитель, полная статистика всех игроков |
| `series_end` | Окончание всего матча | Победитель серии, финальный счет карт |
| `game_paused` | Поставлена пауза | Кто поставил (`team1`, `team2`, `admin`), тип (`technical`/`tactical`) |
| `game_unpaused` | Пауза снята | Кто снял |
| `player_disconnect` | Игрок отключился | SteamID и имя игрока |
| `backup_loaded` | Восстановлен раунд | Имя файла бэкапа и номер раунда |
| `demo_upload_ended` | Завершена заливка демки | Статус успеха, имя файла |

### Пример структуры `map_result` (для начисления ELO):
```json
{
  "event": "map_result",
  "matchid": "match_club1_1042",
  "map_number": 0,
  "map_name": "de_mirage",
  "winner": {
    "team": "team1",
    "name": "Team Spirit Local"
  },
  "team1": {
    "score": 13,
    "players": [
      {
        "steamid": "76561198012345678",
        "name": "PlayerOne",
        "stats": {
          "kills": 22,
          "deaths": 11,
          "assists": 4,
          "damage": 2150,
          "headshot_kills": 12,
          "first_kills": 4,
          "first_deaths": 1,
          "utility_damage": 120,
          "mvps": 4
        }
      }
    ]
  },
  "team2": {
    "score": 8,
    "players": [
      {
        "steamid": "76561198098765431",
        "name": "OpponentPlayer",
        "stats": {
          "kills": 14,
          "deaths": 18,
          "assists": 2,
          "damage": 1320,
          "headshot_kills": 5,
          "mvps": 1
        }
      }
    ]
  }
}
```

> **Интеграция с DashAdmin ELO**:
> Из `map_result` мы получаем точные `damage` и раунды:
> $$\text{ADR} = \frac{\text{damage}}{\text{rounds}}$$
> И передаем напрямую в `calculateCs2MatchElo(team1Players, team2Players, team1Won)` из `src/lib/elo.ts`!

---

## 6. RCON Команды для управления сервером

Управление инстансом из DashMatch Agent или DashAdmin выполняется по стандартному Valve RCON протоколу:

### Управление матчем:
- `matchzy_loadmatch <file.json>` — загрузить локальный файл матча
- `matchzy_loadmatch_url "<url>" "[header_k]" "[header_v]"` — загрузить матч из URL
- `matchzy_endmatch` — завершить матч без победителя
- `matchzy_endmatch team1` / `matchzy_endmatch team2` — принудительно присудить победу команде
- `matchzy_restart` — рестарт/сброс матча
- `matchzy_start` — принудительно запустить матч (пропустить фазу готовности)
- `matchzy_skipveto` — пропустить стадию veto карт

### Паузы и бэкапы:
- `matchzy_pause` / `matchzy_unpause` — тактическая пауза
- `matchzy_forcepause` — админская пауза (игроки не могут снять)
- `matchzy_forceunpause` — принудительное снятие паузы
- `matchzy_restore <round_number>` — откат на конкретный раунд
- `matchzy_loadbackup <filename>` — загрузка файла бэкапа

### Управление игроками:
- `matchzy_addplayer <steam64> <team1|team2|spec> [name]` — добавить игрока в команду прямо во время игры
- `matchzy_removeplayer <steam64>` — удалить игрока из матча
- `matchzy_whitelist 0|1` — включить/выключить вайтлист

### Статус сервера (Get5 API):
- `get5_status` — **возвращает JSON-строку** с полным состоянием сервера:
  - `plugin_version`
  - `gamestate`: `"none"`, `"warmup"`, `"knife"`, `"live"`, `"post_game"`
  - `paused`: `true`/`false`
  - `matchid`, `map_number`, `maps`
  - `team1` / `team2` (стороны CT/T, счет, готовность, кол-во подключенных игроков)

---

## 7. Чат-команды для игроков

Игроки могут использовать команды в чате через точку `.` или восклицательный знак `!`:
- `.ready` / `.r` — готов к матчу
- `.unready` / `.ur` — отмена готовности
- `.forceready` — капитан помечает команду готовой
- `.pause` — запросить тактическую паузу
- `.tech` — запросить техническую паузу
- `.unpause` — запросить снятие паузы (требуется от обеих команд)
- `.stay` — остаться за сторону (после победы на knife round)
- `.switch` / `.swap` — сменить сторону
- `.coach <ct|t>` — сесть в слот тренера
- `.uncoach` — выйти из слота тренера

---

## 8. Итог: Что делает интеграция для компьютерного клуба

1. **Создание матча**: DashAdmin формирует JSON матча со списком игроков и шлет RCON команду `matchzy_loadmatch_url` на сервер.
2. **Faceit-опыт**: Сервер автоматически пускает только участников матча, запускает разминку, ждет `.ready`, проводит ножевой раунд `.stay/.switch` и ведет матч со счетом и паузами.
3. **Статистика в реальном времени**: MatchZy шлет вебхуки в DashAdmin при каждом убийстве, бомбе и конце раунда.
4. **Завершение и ELO**: По событию `map_result` DashAdmin мгновенно рассчитывает изменение рейтинга ELO и ADR игроков в базе данных.
