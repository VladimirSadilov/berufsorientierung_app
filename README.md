# Berufsorientierung - Система регистрации на мероприятия

Веб-приложение для регистрации участников на мероприятия проекта профориентации молодежи с миграционным прошлым (Kolibri Dresden).

## 📚 Документация

- **[🚀 DEPLOYMENT.md](./docs/development/DEPLOYMENT.md)** - Полное руководство по развертыванию на Cloudflare Workers
- **[🏗️ ARCHITECTURE.md](./docs/ARCHITECTURE.md)** - Короткая карта архитектуры и навигация по коду
- **[📧 Email Setup](./docs/features/email/DEPLOYMENT.md)** - Настройка DNS (SPF/DKIM/DMARC)
- **[📖 Documentation Index](./docs/README.md)** - Вся документация проекта

## 🚀 Технологический стек

**Frontend:**

- SvelteKit (TypeScript)
- Tailwind CSS
- svelte-i18n (мультиязычность)

**Backend:**

- Cloudflare Workers (serverless)
- Cloudflare D1 (SQLite база данных)
- Cloudflare R2 (QR-коды, постеры мероприятий и другие файлы)

**Библиотеки:**

- Zod (валидация)
- bcryptjs (хеширование паролей)
- jose (JWT токены)
- qrcode (генерация QR-кодов)
- Resend / MailChannels (отправка email)

## 📦 Установка

```bash
# Клонировать репозиторий
git clone <repository-url>
cd berufsorientierung-app

# Установить зависимости
npm install

# Скопировать пример переменных окружения
cp .env.example .env

# Заполнить переменные в .env файле
```

## 🛠️ Разработка

```bash
# Запустить dev сервер
npm run dev

# Открыть браузер на http://localhost:5173
```

## 🧪 Тестирование

```bash
# Запустить тесты
npm test

# Запустить тесты в режиме watch
npm run test:watch

# Открыть UI для тестов
npm run test:ui
```

## 📝 Линтинг и форматирование

```bash
# Проверить код на ошибки
npm run lint

# Форматировать код
npm run format

# Проверить TypeScript типы
npm run check
```

## 🗄️ База данных

### Создание D1 базы данных

```bash
# Создать базу данных в Cloudflare
wrangler d1 create berufsorientierung-db

# Скопировать database_id из вывода в wrangler.toml
```

### Применение миграций

```bash
# Применить миграции локально (для разработки)
wrangler d1 execute berufsorientierung-db --local --file=./migrations/0001_initial.sql
wrangler d1 execute berufsorientierung-db --local --file=./migrations/0002_make_max_participants_nullable.sql
wrangler d1 execute berufsorientierung-db --local --file=./migrations/0003_add_guardian_fields.sql
wrangler d1 execute berufsorientierung-db --local --file=./migrations/0004_add_password_reset_fields.sql
wrangler d1 execute berufsorientierung-db --local --file=./migrations/0005_add_event_end_date.sql
wrangler d1 execute berufsorientierung-db --local --file=./migrations/0006_add_reviews.sql
wrangler d1 execute berufsorientierung-db --local --file=./migrations/0007_add_event_poster_url.sql
wrangler d1 execute berufsorientierung-db --local --file=./migrations/0008_add_events_is_listed.sql

# Применить миграции в продакшн
wrangler d1 execute berufsorientierung-db --file=./migrations/0001_initial.sql
wrangler d1 execute berufsorientierung-db --file=./migrations/0002_make_max_participants_nullable.sql
wrangler d1 execute berufsorientierung-db --file=./migrations/0003_add_guardian_fields.sql
wrangler d1 execute berufsorientierung-db --file=./migrations/0004_add_password_reset_fields.sql
wrangler d1 execute berufsorientierung-db --file=./migrations/0005_add_event_end_date.sql
wrangler d1 execute berufsorientierung-db --file=./migrations/0006_add_reviews.sql
wrangler d1 execute berufsorientierung-db --file=./migrations/0007_add_event_poster_url.sql
wrangler d1 execute berufsorientierung-db --file=./migrations/0008_add_events_is_listed.sql
```

## 📦 R2 Storage

### Создание R2 bucket для файлов

```bash
# Создать bucket
wrangler r2 bucket create berufsorientierung-qr-codes

# Обновить wrangler.toml с именем bucket
```

## 🔐 Секреты

```bash
# Установить секреты для продакшн
wrangler secret put JWT_SECRET
wrangler secret put DKIM_PRIVATE_KEY
wrangler secret put SETUP_TOKEN
wrangler secret put CRON_SECRET
wrangler secret put TURNSTILE_SECRET_KEY
wrangler secret put RESEND_API_KEY  # Если используете Resend
```

### CRON_SECRET

Секретный токен для защиты Cron endpoint от несанкционированных вызовов.

```bash
# Сгенерировать случайный токен
openssl rand -base64 32

# Установить в Cloudflare
wrangler secret put CRON_SECRET
```

## ⏰ Cloudflare Cron Triggers

Приложение использует Cloudflare Cron для автоматического удаления пользователей по расписанию.

### Настройка Cron в production

1. **Cron уже настроен в `wrangler.toml`:**

```toml
[triggers]
crons = ["0 2 * * *"]  # Каждый день в 02:00 UTC
```

2. **Задеплойте приложение:**

```bash
npm run deploy
```

3. **Установите CRON_SECRET:**

```bash
# Сгенерируйте случайный токен
openssl rand -base64 32

# Установите в Cloudflare
wrangler secret put CRON_SECRET
# Введите сгенерированный токен
```

4. **Проверьте настройки Cron в Cloudflare Dashboard:**

- Перейдите в Workers & Pages → Ваше приложение
- Откройте вкладку "Triggers"
- Убедитесь, что Cron триггер активен: `0 2 * * *`

### Как работает Cron

Приложение поддерживает **два варианта** автоматического удаления:

#### Вариант 1: Встроенный Cloudflare Scheduled Handler (рекомендуется)

- Каждый день в **02:00 UTC** Cloudflare автоматически вызывает функцию `scheduled()` в Worker
- Функция напрямую вызывает `DB.gdpr.processScheduledDeletions()` без HTTP запросов
- Результат логируется в `activity_log` с типом `system_cron_deletion`
- **Преимущества:** Нативная интеграция, не расходует request quota, более надёжно

**Настройка:**

1. Build script автоматически интегрирует `scheduled` handler:

   ```bash
   npm run build  # Выполняет: vite build + inject-cron.js
   ```

2. Deploy в Cloudflare:

   ```bash
   npm run deploy
   ```

3. Cron триггер из `wrangler.toml` автоматически активируется

#### Вариант 2: HTTP Endpoint + Внешний Cron сервис

- Внешний сервис (cron-job.org, GitHub Actions) вызывает GET `/api/cron/delete-users`
- Endpoint проверяет `CRON_SECRET` и выполняет удаление
- **Преимущества:** Проще тестировать, не требует интеграции с build

**Безопасность (для обоих вариантов):**

- Все операции логируются в `activity_log`
- Встроенный handler не требует токена (внутренний вызов)
- HTTP endpoint защищён Bearer токеном (CRON_SECRET)

---

### Настройка HTTP endpoint (Вариант 2)

**Установите CRON_SECRET:**

```bash
# Сгенерируйте случайный токен
openssl rand -base64 32

# Установите в Cloudflare
wrangler secret put CRON_SECRET
# Введите сгенерированный токен
```

**Настройка через cron-job.org (бесплатно):**

1. Зарегистрируйтесь на https://cron-job.org
2. Создайте новый Cron Job:
   - URL: `https://your-app.workers.dev/api/cron/delete-users`
   - Method: GET
   - Headers: `Authorization: Bearer YOUR_CRON_SECRET`
   - Schedule: `0 2 * * *` (каждый день в 02:00)
3. Сохраните и активируйте

### Тестирование Cron локально

**⚠️ ВАЖНО:** Cloudflare Cron работает **только в production**. Для локального тестирования используйте ручной endpoint.

**Ручной запуск удаления (только для админов):**

```bash
# Авторизуйтесь как администратор и вызовите:
POST /api/admin/cron/trigger-delete

# Или через curl:
curl -X POST http://localhost:5173/api/admin/cron/trigger-delete \
  -H "Cookie: auth_token=YOUR_JWT_TOKEN"
```

**Что делает ручной endpoint:**

- Проверяет admin права пользователя
- Вызывает ту же функцию удаления, что и автоматический Cron
- Возвращает результат (количество удалённых пользователей)
- Логирует действие с типом `system_cron_deletion`

**Пример ответа:**

```json
{
	"success": true,
	"deleted": 3,
	"message": "Successfully deleted 3 user(s)",
	"timestamp": "2025-11-12T14:30:00.000Z"
}
```

### Мониторинг Cron

**Просмотр логов Cron в Cloudflare:**

```bash
# Реальное время
wrangler tail

# Фильтр по Cron событиям
wrangler tail --format pretty | grep CRON
```

**Просмотр логов в Activity Log:**

- Перейдите в админ-панель → Activity Logs
- Фильтр по типу действия: `system_cron_deletion`
- В деталях будет JSON с количеством удалённых пользователей

**Пример лога:**

```json
{
	"action_type": "system_cron_deletion",
	"details": {
		"deleted_count": 2,
		"triggered_by": "cloudflare_cron",
		"cron_schedule": "0 2 * * *"
	},
	"timestamp": "2025-11-12T02:00:15.000Z"
}
```

## 🚀 Деплой

```bash
# Собрать проект
npm run build

# Задеплоить в Cloudflare Workers
npm run deploy

# Или через wrangler напрямую
wrangler deploy
```

## 🌍 Мультиязычность

Поддерживаемые языки:

- 🇩🇪 Немецкий (по умолчанию)
- 🇬🇧 Английский
- 🇷🇺 Русский
- 🇺🇦 Украинский

Переводы находятся в `static/translations/`.

## 📧 Email настройки

### Рекомендуется: Resend (бесплатно 3000 писем/месяц)

1. Зарегистрируйтесь на https://resend.com
2. Получите API ключ в Dashboard → API Keys
3. Установите секрет:

```bash
wrangler secret put RESEND_API_KEY
```

4. Обновите `wrangler.toml`:

```toml
[vars]
EMAIL_PROVIDER = "resend"
```

5. Верифицируйте домен в Resend Dashboard для отправки с вашего домена

### Альтернатива: MailChannels (только для доменов в Cloudflare)

⚠️ **ВАЖНО:** MailChannels работает только если домен добавлен как зона (site) в том же Cloudflare аккаунте, где развёрнут Worker. Если домен на внешнем DNS (IONOS и т.д.) - используйте Resend.

1. Настроить SPF запись в DNS:

```
v=spf1 a mx include:relay.mailchannels.net ~all
```

2. Настроить DKIM (опционально, но рекомендуется для deliverability):

- Сгенерировать ключи
- Добавить публичный ключ в DNS
- Добавить приватный ключ в секреты Cloudflare

3. Настроить DMARC запись:

```
v=DMARC1; p=quarantine; rua=mailto:dmarc@kolibri-dresden.de
```

Подробнее: [📧 Email Setup Guide](./docs/features/email/DEPLOYMENT.md)

## 📁 Структура проекта

Для точной навигации по коду и связям модулей см. [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md).

```
berufsorientierung-app/
├── src/
│   ├── routes/              # SvelteKit страницы, layouts и API endpoints
│   ├── lib/
│   │   ├── components/      # UI, layout, events и admin компоненты
│   │   ├── server/          # Серверный код (auth, БД, email, middleware, storage)
│   │   ├── types/           # TypeScript типы
│   │   ├── stores/          # Svelte stores
│   │   ├── validation/      # Zod схемы валидации
│   │   ├── utils/           # Утилиты
│   │   └── assets/          # Статические ассеты
│   ├── app.d.ts             # TypeScript декларации
│   ├── hooks.server.ts      # SvelteKit server hooks
│   └── worker.ts            # Cloudflare scheduled handler для Cron
├── static/
│   ├── translations/        # i18n переводы (de/en/ru/uk)
│   ├── flags/               # Флаги языков
│   ├── image/               # Публичные изображения
│   └── img/                 # Публичные изображения, используемые layout/footer
├── migrations/              # SQL миграции (D1 database)
├── tests/                   # Vitest тесты (unit + integration)
├── docs/                    # 📚 Документация проекта
│   ├── development/         # Для разработчиков
│   ├── database/            # Документация модулей БД
│   └── features/            # Функциональные возможности
├── scripts/                 # Build и deployment скрипты
├── keys/                    # DKIM ключи для email
├── wrangler.toml           # Cloudflare конфиг
├── package.json            # NPM зависимости
├── tsconfig.json           # TypeScript конфиг
├── vite.config.ts          # Vite конфиг
├── svelte.config.js        # SvelteKit конфиг
├── tailwind.config.js      # Tailwind CSS конфиг
├── ADMIN_GUIDE.md          # Руководство администратора
└── .env.example            # Пример переменных окружения
```

## 📚 Документация

Полная документация проекта находится в папке [`docs/`](./docs/):

- **[docs/README.md](./docs/README.md)** - Главная страница документации
- **[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)** - Карта архитектуры и быстрый поиск нужного кода
- **[docs/development/](./docs/development/)** - Документация для разработчиков
- **[docs/database/](./docs/database/)** - Описание модулей БД
- **[docs/features/](./docs/features/)** - Функциональные возможности

## 🔒 GDPR Compliance

- Пользователи могут удалить свой профиль в любое время
- Автоматическое удаление через 28 дней после последнего мероприятия
- Минимальная архивация данных для отчетности (только имя и даты участия)
- Явное согласие на обработку данных при регистрации
- Согласие на фото/видео съемку (опционально)
- Для несовершеннолетних (<18 лет) требуется согласие родителя/опекуна
- Все данные об удалениях логируются в activity_log

## 🔐 Безопасность

- JWT токены для аутентификации (httpOnly cookies)
- CSRF защита для всех мутирующих операций
- Cloudflare Turnstile для защиты от ботов на формах регистрации
- bcrypt для хеширования паролей пользователей
- SHA-256 для токенов сброса пароля (одноразовые, с истечением через 1 час)
- Prepared statements для защиты от SQL injection
- Rate limiting через Cloudflare Workers
- Защита админ-эндпоинтов (требуется запись в таблице admins)

## 📱 Мобильная адаптация

- Mobile-first подход
- Минимальная высота кнопок: 44px
- Минимальный размер текста: 16px
- Адаптивные таблицы и формы

## 👥 Команда

Разработано проекта профориентации молодежи с миграционным прошлым и является собственностью **Kinder- und Elternzentrum Kolibri e.V. Dresden**,
Softwarentwikler Dr. Shakun K.S.

## 📄 Лицензия

© 2025 Kinder- und Elternzentrum Kolibri e.V. Dresden. Все права защищены.

Данное программное обеспечение является собственностью **Kinder- und Elternzentrum Kolibri e.V. Dresden**.

**Использование кода:**

- ✅ Разрешено для некоммерческих образовательных целей с письменного разрешения
- ✅ Разрешено для аналогичных социальных проектов с письменного разрешения
- ❌ Запрещено коммерческое использование без разрешения
- ❌ Запрещено распространение без указания авторства

**Для получения разрешения на использование обращайтесь:**

- Email: info@kolibri-dresden.de
- Адрес: Ritzenbergstrasse 3 • 01067 Dresden
  Villa der Kulturen
  Kraftwerk Mitte 2 • 01067 Dresden
  Tel. : +49 176 84235979 (Sekretariat)

При использовании кода с разрешения обязательно указание:
Based on Berufsorientierung App
© Kinder- und Elternzentrum Kolibri e.V. Dresden
Used with permission
