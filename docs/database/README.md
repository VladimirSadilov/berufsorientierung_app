# 🗄️ Документация базы данных

Документация по всем модулям работы с базой данных D1 (SQLite).

## 📋 Модули

### [activitylog/](./activitylog/) - Логирование действий

Модуль для записи действий администраторов.

- [README.md](./activitylog/README.md) - Полное описание API
- [QUICK_REFERENCE.md](./activitylog/QUICK_REFERENCE.md) - Быстрый справочник
- [EXAMPLES.md](./activitylog/EXAMPLES.md) - Примеры использования
- [CHANGELOG.md](./activitylog/CHANGELOG.md) - История изменений

### [admin/](./admin/) - Администраторы

Модуль управления администраторами системы.

- [README.md](./admin/README.md) - Описание API и функций

### [events/](./events/) - Мероприятия

Модуль управления мероприятиями.

- [README.md](./events/README.md) - Полное описание API
- [EVENTFIELDS.md](./events/EVENTFIELDS.md) - Дополнительные поля мероприятий
- [CHANGELOG.md](./events/CHANGELOG.md) - История изменений

### [registrations/](./registrations/) - Регистрации

Модуль управления регистрациями участников на мероприятия.

- [README.md](./registrations/README.md) - Полное описание API
- [CHANGELOG.md](./registrations/CHANGELOG.md) - История изменений

### [users/](./users/) - Пользователи

Модуль управления пользователями системы.

- [README.md](./users/README.md) - Полное описание API
- [CHANGELOG.md](./users/CHANGELOG.md) - История изменений

### [reviews/](./reviews/) - Отзывы

Модуль управления отзывами и публичными ссылками для сбора отзывов.

- [README.md](./reviews/README.md) - Описание API и связанных маршрутов

### [gdpr/](./gdpr/) - GDPR Compliance

Модуль для управления удалением пользователей в соответствии с GDPR.

- [README.md](./gdpr/README.md) - Полное описание API
- [QUICK_REFERENCE.md](./gdpr/QUICK_REFERENCE.md) - Быстрый справочник
- [EXAMPLES.md](./gdpr/EXAMPLES.md) - Примеры использования
- [CHANGELOG.md](./gdpr/CHANGELOG.md) - История изменений

---

## 📖 Общие концепции

Все модули следуют единому подходу:

- **CRUD операции** - Create, Read, Update, Delete
- **Типобезопасность** - TypeScript типы для всех данных
- **Валидация** - Проверка данных перед записью в БД
- **Транзакции** - Использование транзакций для сложных операций
- **Логирование** - Автоматическое логирование изменений через activityLog

---

[← Назад к главной документации](../README.md)
