# Suppy.Redeem API

**Base URL:** `https://redeem.suppy.org/api`

Все эндпоинты публичные (без авторизации), rate-limit: **10 запросов/минуту** на IP.

---

## 1. Получить информацию о ключе

```
GET /chatgpt/keys/{code}
```

**Ответ 200:**
```json
{
  "code": "ABCD1234EFGH5678",
  "status": "available",
  "key_type": "personal",
  "subscription_hours": 0,
  "activated_email": null,
  "activated_at": null,
  "subscription_ends_at": null,
  "plan": "plus",
  "term": "30d",
  "service": "chatgpt"
}
```

| Поле | Тип | Описание |
|------|-----|----------|
| `code` | string | Код ключа |
| `status` | string | `"available"` / `"reserved"` / `"activated"` |
| `key_type` | string | `"personal"` (сессия) или `"team"` (email) |
| `subscription_hours` | int | Длительность подписки в часах (для team-ключей) |
| `activated_email` | string \| null | Email, использованный при активации |
| `activated_at` | int \| null | Unix timestamp активации |
| `subscription_ends_at` | int \| null | Unix timestamp окончания подписки |
| `plan` | string \| null | `"plus"`, `"pro"`, `"go"`, `"max5x"`, `"max20x"` |
| `term` | string \| null | `"30d"`, `"365d"` |
| `service` | string \| null | `"chatgpt"` или `"claude"` |

**Ошибки:** `404` — ключ не найден.

---

## 2. Активировать ключ (personal, по сессии)

```
POST /chatgpt/keys/activate-session
Content-Type: application/json
```

**Тело запроса:**
```json
{
  "code": "ABCD1234EFGH5678",
  "session": "<session_data>"
}
```

### Формат `session` зависит от сервиса:

**ChatGPT** (`service: "chatgpt"`) — JSON-строка содержимого `chatgpt.com/api/auth/session`:
```json
{
  "accessToken": "eyJhbGciOiJSUzI1NiI...",
  "user": {
    "id": "user-abc123"
  }
}
```

**Claude** (`service: "claude"`) — значение `sessionKey` из Cookie Editor на claude.ai:
```
sk-ant-sid01-...
```

**Ответ 200:**
```json
{
  "code": "ABCD1234EFGH5678",
  "status": "started"
}
```

Активация происходит **асинхронно**. Поллите статус через эндпоинт 3 или 1.

**Ошибки:**

| Код | Тело | Условие |
|-----|------|---------|
| 400 | `"session is required"` | Пустая сессия |
| 400 | `"session must be valid JSON"` | Невалидный JSON (для ChatGPT) |
| 400 | `"no_access_token"` | Нет `accessToken` в JSON |
| 400 | `"workspace_account"` | Корпоративный аккаунт ChatGPT |
| 400 | `"session_expired"` | Сессия истекла |
| 400 | `"session_invalid"` | Невалидная сессия |
| 400 | `"session_check_failed"` | Проверка сессии не прошла |
| 404 | `"key not found"` | Ключ не найден |
| 409 | `"key already activated"` | Уже активирован |

---

## 3. Активировать ключ (team, по email)

```
POST /chatgpt/keys/activate
Content-Type: application/json
```

**Тело запроса:**
```json
{
  "code": "ABCD1234EFGH5678",
  "email": "user@example.com"
}
```

**Ответ 200:**
```json
{
  "key": {
    "code": "ABCD1234EFGH5678",
    "status": "activated",
    "key_type": "team",
    "subscription_hours": 720,
    "activated_email": "user@example.com",
    "activated_at": 1743897600,
    "subscription_ends_at": 1746489600,
    "plan": null,
    "term": null,
    "service": null
  },
  "activation_type": "new"
}
```

| Поле | Тип | Описание |
|------|-----|----------|
| `key` | object | Полная информация о ключе (см. эндпоинт 1) |
| `activation_type` | string | `"new"` — новая подписка, `"renew"` — продление |

**Ошибки:** `400` — невалидный email, `404` — ключ не найден, `409` — уже активирован.

---

## 4. Проверить статус активации

```
GET /chatgpt/keys/activation-status/{code}
```

**Ответ 200:**
```json
{
  "code": "ABCD1234EFGH5678",
  "status": "subscription_sent",
  "key": { "...полная информация о ключе..." },
  "activation_type": "new"
}
```

Возможные `status`:

| Статус | Описание |
|--------|----------|
| `"started"` | Активация начата |
| `"account_found"` | Аккаунт найден |
| `"subscription_sent"` | Подписка выдана (содержит `key` и `activation_type`) |
| `"error"` | Ошибка (содержит `message`) |

**Ошибки:** `404` — ключ не найден или активация не начата.

---

## 5. Магазин — создать заказ

```
POST /shop/order
Content-Type: application/json
```

**Тело запроса:**
```json
{
  "items": [
    { "product_id": "plus-1m", "quantity": 1 }
  ],
  "pay_currency": "usdtton",
  "buyer_email": "user@example.com"
}
```

| Поле | Тип | Описание |
|------|-----|----------|
| `items` | array | Список товаров |
| `items[].product_id` | string | ID продукта (см. таблицу ниже) |
| `items[].quantity` | int | Количество (≥ 1) |
| `pay_currency` | string | Валюта оплаты |
| `buyer_email` | string \| null | Email покупателя (опционально) |

**Доступные продукты:**

| `product_id` | Название | Цена от (USD) |
|--------------|----------|---------------|
| `plus-1m` | ChatGPT Plus 1M | $1.00 |
| `plus-12m` | ChatGPT Plus 1Y | $13.00 |
| `go-12m` | ChatGPT Go 1Y | $1.50 |
| `pro-1m` | ChatGPT Pro | $50.00 |
| `claude-5x` | Claude Max 5x | $50.00 |
| `claude-20x` | Claude Max 20x | $95.00 |

Цены зависят от количества (оптовые скидки). Точная цена рассчитывается сервером.

**Доступные `pay_currency`:** `usdttrc20`, `usdterc20`, `usdtbsc`, `usdtsol`, `usdtton`, `usdtpolygon`, `ton`, `btc`, `eth`, `ltc`, `trx`, `sol`, `bnb`.

**Ответ 200:**
```json
{
  "order_id": "5e1f23d9-ca08-49e1-8d3b-6efeb02281e2",
  "total_usd": 1.50,
  "pay_address": "UQCUkWAIKmoh...",
  "pay_amount": 1.500053,
  "pay_currency": "usdtton",
  "payment_id": "4820419990"
}
```

| Поле | Тип | Описание |
|------|-----|----------|
| `order_id` | string (UUID) | ID заказа для polling |
| `total_usd` | float | Итого в USD |
| `pay_address` | string | Адрес для отправки криптовалюты |
| `pay_amount` | float | Точная сумма к оплате в выбранной валюте |
| `pay_currency` | string | Валюта оплаты |
| `payment_id` | string | ID платежа |

---

## 6. Магазин — проверить статус заказа

```
GET /shop/order/{order_id}
```

**Ответ 200:**
```json
{
  "order_id": "5e1f23d9-ca08-49e1-8d3b-6efeb02281e2",
  "status": "completed",
  "total_usd": 1.50,
  "items": [
    {
      "product_id": "plus-1m",
      "name": "ChatGPT Plus 1M",
      "quantity": 1,
      "unit_price": 1.50
    }
  ],
  "payment": {
    "payment_id": "4820419990",
    "pay_address": "UQCUkWAIKmoh...",
    "pay_amount": 1.500053,
    "pay_currency": "usdtton",
    "actually_paid": 1.500053,
    "payment_status": "finished"
  },
  "delivered_keys": [
    {
      "product_id": "plus-1m",
      "key_code": "ABCD1234EFGH5678IJKL9012MNOP3456"
    }
  ]
}
```

| Поле | Тип | Описание |
|------|-----|----------|
| `order_id` | string (UUID) | ID заказа |
| `status` | string | Статус заказа (см. ниже) |
| `total_usd` | float | Итого в USD |
| `items` | array | Список товаров с рассчитанными ценами |
| `items[].product_id` | string | ID продукта |
| `items[].name` | string | Название продукта |
| `items[].quantity` | int | Количество |
| `items[].unit_price` | float | Цена за единицу (USD) |
| `payment` | object \| null | Информация об оплате (null до создания инвойса) |
| `payment.payment_id` | string | ID платежа |
| `payment.pay_address` | string \| null | Адрес кошелька |
| `payment.pay_amount` | float \| null | Сумма к оплате |
| `payment.pay_currency` | string \| null | Валюта |
| `payment.actually_paid` | float \| null | Фактически оплачено |
| `payment.payment_status` | string \| null | Статус платежа (`"waiting"`, `"confirming"`, `"confirmed"`, `"finished"`, `"failed"`, `"expired"`) |
| `delivered_keys` | array \| null | Выданные ключи (null до выдачи) |
| `delivered_keys[].product_id` | string | ID продукта |
| `delivered_keys[].key_code` | string | Код ключа для активации |

**Статусы заказа:**

| `status` | Описание |
|----------|----------|
| `"pending"` | Ожидание оплаты |
| `"paid"` | Оплата получена, ключи выдаются |
| `"completed"` | Ключи выданы, `delivered_keys` заполнен |
| `"failed"` | Оплата не прошла |
| `"expired"` | Время оплаты истекло |

---

## Flow интеграции

### Активация personal-ключа (по сессии)

```
1. GET  /chatgpt/keys/{code}                → проверить status == "available", прочитать service
2. POST /chatgpt/keys/activate-session       → передать сессию/токен
3. Poll GET /chatgpt/keys/{code}             → ждать status == "activated" (каждые 3–5 сек)
4. Готово — подписка на аккаунте покупателя
```

### Активация team-ключа (по email)

```
1. GET  /chatgpt/keys/{code}                → проверить status == "available", key_type == "team"
2. POST /chatgpt/keys/activate              → передать email
3. Готово — приглашение отправлено на email
```

### Покупка + активация через магазин

```
1. POST /shop/order                          → создать заказ, получить pay_address + pay_amount
2. Покупатель отправляет крипту на pay_address
3. Poll GET /shop/order/{order_id}           → ждать status == "completed" (каждые 5 сек)
4. Получить ключи из delivered_keys[].key_code
5. Активировать каждый ключ через flow выше
```

### Прямая ссылка на активацию (для конечных покупателей)

```
https://redeem.suppy.org/activate?code={KEY_CODE}
```

---

## Поддержка

Telegram: [@PolinaAlphaAffiliates](https://t.me/PolinaAlphaAffiliates)
