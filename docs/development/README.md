# 🔧 Документация для разработчиков

Материалы для команды разработки проекта.

## 📋 Содержание

### [../ARCHITECTURE.md](../ARCHITECTURE.md)

**Короткая карта архитектуры и быстрый поиск нужного кода.**

Начинайте с нее, если задача требует понять, где находится логика маршрутов, API, БД, storage, auth, cron или i18n.

### [DEPLOYMENT.md](./DEPLOYMENT.md) 🚀

**Полное руководство по развертыванию приложения на Cloudflare Workers.**

Включает:

- Настройку D1 Database и R2 Storage
- Конфигурацию Email (SPF/DKIM/DMARC)
- Настройку Cloudflare Turnstile
- Управление секретами
- Создание первого администратора
- Процесс деплоя и Cron Triggers
- Troubleshooting и мониторинг

### [PROGRESS.md](./PROGRESS.md)

История развития проекта, основные вехи и выполненные задачи.

### [TYPE_SYSTEM.md](./TYPE_SYSTEM.md)

Документация по системе типов TypeScript проекта:

- Типы для пользователей
- Типы для мероприятий
- Типы для регистраций
- Типы для администраторов

### [fixes/](./fixes/)

История исправлений и багфиксов:

- [ADMIN_ACTIVITYLOG.md](./fixes/ADMIN_ACTIVITYLOG.md) - Исправления в модуле логирования админов
- [REPORT_EVENTS.md](./fixes/REPORT_EVENTS.md) - Исправления в модуле событий
- [AUTH_CLOUDFLARE_COMPATIBILITY.md](./fixes/AUTH_CLOUDFLARE_COMPATIBILITY.md) - Совместимость Auth модуля с Cloudflare Workers
- [NEWSLETTER_BATCHING.md](./fixes/NEWSLETTER_BATCHING.md) - Исправление батчинга в массовой email рассылке
- [I18N_DUPLICATE_KEYS.md](./fixes/I18N_DUPLICATE_KEYS.md) - Устранение дублирующих ключей в переводах
- [SVELTEKIT_INVALIDATION.md](./fixes/SVELTEKIT_INVALIDATION.md) - Правильное использование invalidateAll в SvelteKit
- [NEWSLETTER_SELECT_TYPE.md](./fixes/NEWSLETTER_SELECT_TYPE.md) - Исправление типов для select элемента в newsletter форме
- [TYPESCRIPT_ERRORS_FIX.md](./fixes/TYPESCRIPT_ERRORS_FIX.md) - Миграция Button API (variant vs type) и устранение TS2322 ошибок

### [TYPESCRIPT_ERRORS.md](./TYPESCRIPT_ERRORS.md)

Анализ и решения TypeScript ошибок в проекте.

---

[← Назад к главной документации](../README.md)
