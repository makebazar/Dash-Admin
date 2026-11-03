# SmartShell API — Документация по интеграции

> Получено путём live introspection GraphQL схемы `billing.smartshell.gg/api/graphql`  
> Дата: 2026-08-19 | Версия API: v1

---

## Подключение

**Endpoint:** `https://billing.smartshell.gg/api/graphql`  
**Протокол:** GraphQL over HTTP POST  
**Официальная документация:** https://apidoc.smartshell.gg/index.html

### Способы аутентификации

#### 1. API ключ (новый, рекомендуемый)
```http
Authorization: Bearer <api_key>
Company-Id: <company_id>
```

#### 2. Логин + пароль (через mutation `login`)
```graphql
mutation login($input: LoginInput!) {
  login(input: $input) {
    access_token
    expires_in
    refresh_token
  }
}
```
Переменные:
```json
{
  "input": {
    "login": "79991234567",
    "password": "password",
    "company_id": 10436
  }
}
```
Полученный `access_token` передаётся в хедере `Authorization: Bearer <token>`.

---

## Смены (WorkShift)

### Queries

#### `activeWorkShift` — активная смена
```graphql
query {
  activeWorkShift {
    id
    created_at
    finished_at
    comment
    worker {
      id
      phone
      first_name
      last_name
      email
    }
    money {
      cash_on_start
      sum {
        cash
        card
        deposit
        bonus
        total
      }
    }
    payments {
      id
      sum
      cash_sum
      card_sum
      method
      created_at
      items {
        id
        type
        sum
        amount
        entity {
          ... on Good {
            id
            title
            cost
            wholesale_cost
          }
        }
      }
    }
    cashOrders {
      sum
    }
    events {
      type
    }
  }
}
```
> ⚠️ Требует токен сотрудника (не API ключ). С API ключом возвращает `not permitted`.

---

#### `canStartWorkShift` — проверить возможность открыть смену
```graphql
query {
  canStartWorkShift
}
```
Возвращает `Boolean`. Проверяет: нет ли уже открытой смены.

---

#### `canFinishWorkShift` — проверить возможность закрыть смену
```graphql
query {
  canFinishWorkShift(confirm_pass: "пароль_сотрудника")
}
```
Возвращает `Boolean`.

---

#### `workShifts` — список смен
```graphql
query {
  workShifts(input: $input, page: 1, first: 20) {
    data {
      id
      created_at
      finished_at
    }
    paginatorInfo {
      total
      currentPage
    }
  }
}
```

---

#### `workShift` — одна смена по ID
```graphql
query {
  workShift(id: 12345) {
    id
    created_at
    finished_at
    worker { id first_name last_name }
    money { sum { total cash card } }
  }
}
```

---

#### `workShiftsReport` / `workShiftsSummaryReport`
Отчёты по сменам. Принимают `input: WorkShiftsReport!`.

---

#### `getWorkShiftPaymentOverviewData`
```graphql
query {
  getWorkShiftPaymentOverviewData(id: 12345) {
    ...
  }
}
```

---

#### `workShiftSummary`
```graphql
query {
  workShiftSummary(id: 12345) {
    ...
  }
}
```

---

### Mutations

#### `startWorkShift` — **открыть смену** ✅
```graphql
mutation {
  startWorkShift(input: { cash: 5000.0 }) {
    id
    created_at
  }
}
```

**`StartWorkShiftInput`:**
| Поле | Тип | Описание |
|------|-----|----------|
| `cash` | `Float!` | Сумма наличных в кассе на начало смены |

---

#### `finishWorkShift` — **закрыть смену** ✅
```graphql
mutation {
  finishWorkShift(
    input: { comment: "Смена закрыта" }
    confirm_pass: "пароль_сотрудника"
  ) {
    id
    finished_at
  }
}
```

**Аргументы:**
| Аргумент | Тип | Описание |
|----------|-----|----------|
| `input` | `FinishWorkShiftInput` | Опциональный ввод |
| `confirm_pass` | `String!` | Пароль сотрудника для подтверждения |

**`FinishWorkShiftInput`:**
| Поле | Тип | Описание |
|------|-----|----------|
| `comment` | `String` | Комментарий к закрытию смены |

---

#### `forceFinishWorkShift` — **принудительно закрыть смену** ✅
```graphql
mutation {
  forceFinishWorkShift(input: { comment: "Принудительное закрытие" }) {
    id
    finished_at
  }
}
```
Не требует `confirm_pass`. Для экстренного закрытия администратором.

---

## Товары (Goods)

#### `goods` — список товаров
```graphql
query {
  goods {
    id
    title
    amount
    cost
    wholesale_cost
    eans
  }
}
```

#### `changeGoodsQuantity` — изменить остатки
```graphql
mutation {
  changeGoodsQuantity(input: {
    items: [{ id: 123, quantity: 10 }]
    operation: ADD  # SET | ADD | DISPOSAL | SOLD | CREATE
    comment: "Приход товара"
  })
}
```

#### `createGood`
```graphql
mutation {
  createGood(input: {
    title: "Газировка"
    cost: 150
    wholesale_cost: 80
    amount: 100
    use_global_discounts: true
  }) {
    id
    title
    cost
  }
}
```

#### `updateGood`
```graphql
mutation {
  updateGood(id: 123, input: {
    title: "Новое название"
    cost: 200
  }) {
    id
    title
    cost
  }
}
```

---

## Клубы

#### `myClubs`
```graphql
query {
  myClubs {
    id
    city
    address
  }
}
```

---

## Оплаты / Сессии

#### `createPayment`
```graphql
mutation {
  createPayment(input: { ... }) { ... }
}
```

#### `startClientSession`
```graphql
mutation {
  startClientSession(input: { ... }) { ... }
}
```

#### `setDeposit`
```graphql
mutation {
  setDeposit(...) { ... }
}
```

---

## Хосты (компьютеры)

#### `hostsOverview`
```graphql
query {
  hostsOverview {
    ...
  }
}
```

#### `setHostServiceMode`
```graphql
mutation {
  setHostServiceMode(id: 123, enabled: true)
}
```

#### `createCommand` / `createCommands`
Отправить команду на хост (выключить, перезагрузить и т.д.)

---

## Полный список Mutations (215 штук)

<details>
<summary>Развернуть полный список</summary>

```
createAchievement, deleteAchievement,
createBooking, updateBooking, setBookingStatus, createClientBooking, clientBookingCancel,
createCashOrder,
changeClientSessionHost, stopClientSession, startClientSession, finishClientSession, unpauseClientSession,
createCombo, updateCombo, deleteCombo,
createComment, updateComment, deleteComment, createClubComment, createClientClubComment, readAllClubComments, readClubComment,
createDiscount, updateDiscount, deleteDiscount,
createGameAccount, updateGameAccount, deleteGameAccount, freeGameAccount, pickGameAccount,
createGameAccountGroup, updateGameAccountGroup, deleteGameAccountGroup,
createGood, updateGood, updateGoods, deleteGood, deleteGoods, changeGoodsQuantity,
createCategory, updateCategory, deleteCategory,
registerHost, createHost, updateHost, updateHosts, deleteHost, setHostServiceMode, setShellMode, updateHostState, penaltyHost, applyNewHostDevices, callAdmin, adminCallDone, updateHostIpAddress, createHostPIN,
createCommand, createCommands, sendWakePacket, sendWakePackets, updateHostCommandStatus,
createHostCommandTemplate, updateHostCommandTemplate, deleteHostCommandTemplate,
createHostGroup, updateHostGroup, deleteHostGroup,
startHostSession, finishHostSession,
createDepositCashback, updateDepositCashback, deleteDepositCashback,
createNetwork, updateNetwork, addCompaniesToNetwork, updateNetworkCompany, deleteNetworkCompany,
createCompanyNews, updateCompanyNews, deleteCompanyNews,
createBeneficiaryByInn, setBeneficiaryToCompany, updateBeneficiaryBankDetails, executeDealAndPayToCheckingAccount,
organizationRegister, organizationConfirmCode, organizationLogin, organizationLogout, organizationStartResetPassword, organizationResetPassword, organizationSendConfirmationCode, organizationVerifyConfirmationCode, organizationUpdate,
createClub, updateClub, deleteClub, importClub, importUsers, importUsersHours,
createLicenseTariff, updateLicenseTariff, deleteLicenseTariff,
createLicenseModule, updateLicenseModule, deleteLicenseModule,
createLicenseModuleCategory, updateLicenseModuleCategory, deleteLicenseModuleCategory,
createContractor, updateContractor, deleteContractor,
createLicensePayment, createAdditionalLicensePayment,
magicInit, magicRoles, magicRoles2,
sendClubOnVerification, setClubAutoPayStatus, setClubAutoPayCardId, deleteOrganizationPaymentCard, useDebt, activateTrial,
createOwner, updateOwner, setCompanyOwner,
createPayment, refundPayment, processPostPayment, createPaymentTransaction, externalPaymentTransaction, connectPaymentService, disconnectPaymentService,
createPromoCode, updatePromoCode, deletePromoCode,
updateCompanyPermissions,
createService, updateService, deleteService,
setSettingValue, setMultipleSettingValues, setSetting, setSettings, setCloudPaymentsAccountToCompany, updateTelegramSettings, copySettings,
createShortcut, updateShortcut, deleteShortcut, uploadShortcutImage, updateShortcutSort, setShortcutFavorite,
createShortcutGroup, createShortcutGroups, updateShortcutGroup, updateShortcutGroupSort, deleteShortcutGroup,
processStats, shortcutClicked,
createTariff, updateTariff, updateTariffSort, deleteTariff, purchaseTariffByQR,
verifyUser, banClient, setDeposit, transferDeposit, setBonus, setUserDiscount, uploadUserTable, forceDeleteUser, resetUserPassword,
createWorker, updateWorker, disableWorker, deleteWorker,
createUserGroup, updateUserGroup, deleteUserGroup, changeUsersGroup,
startWorkShift, finishWorkShift, forceFinishWorkShift,
createWorkerTask, updateWorkerTask, deleteWorkerTask, setWorkerTaskComplete,
login, loginQR, generateQR, validateQR, relogin, logout, refreshToken, register, emailRegister, resetPassword, updateMe, updatePassword, updateNewsConsent,
clientRegister, clientLogin, clientRefreshToken, clientResetPassword, clientUpdateMe, clientUpdatePassword, clientBuyPremium,
verifyClient, verifyMe, sendConfirmationCode, sendClientConfirmationCode, sendExtendConfirmationCode, sendConfirmationCodeToEnter
```

</details>

---

## Текущее состояние интеграции DashAdmin ↔ SmartShell

| Функция | Статус | Файл |
|---------|--------|------|
| Авторизация (login/password) | ✅ Реализовано | `src/lib/smartshell/client.ts` |
| Авторизация (API Key) | ❌ Не реализовано | — |
| Получение активной смены | ✅ Реализовано | `src/lib/smartshell/client.ts` |
| Синхронизация смен SS → DA | ✅ Реализовано | `src/lib/smartshell/shift-sync.ts` |
| Открытие смены DA → SS | ❌ Не реализовано | — |
| Закрытие смены DA → SS | ❌ Не реализовано | — |
| Принудительное закрытие DA → SS | ❌ Не реализовано | — |
| Товары (CRUD + остатки) | ✅ Реализовано | `src/lib/smartshell/client.ts` |
| Webhook от SmartShell | ✅ Реализовано | `src/app/api/webhooks/smartshell/` |
| Cron-синхронизация | ✅ Реализовано | `src/app/api/cron/smartshell-sync/` |

---

## Заметки

- Интроспекция без авторизации — **не работает** (требует токен)
- `activeWorkShift` с API-ключом — `not permitted` (нужен токен сотрудника, не мастер-ключ)
- `startWorkShift` / `finishWorkShift` — вероятно тоже требуют токен сотрудника, не API-ключ
- Официальная документация https://apidoc.smartshell.gg устарела (показывает только 12 мутаций, по факту 215)
