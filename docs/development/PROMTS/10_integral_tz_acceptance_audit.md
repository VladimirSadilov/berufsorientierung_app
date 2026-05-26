# Промпт 10: полная интегральная проверка исполнения ТЗ

Ты работаешь в проекте `berufsorientierung_app`. Проведи полную интегральную проверку реализации ТЗ `docs/media-collage-rueckblick_corrected.md` и исправь найденные несоответствия без нарушения существующей логики.

## Сбор контекста

1. Перейди в корень проекта `berufsorientierung_app`.
2. Прочитай весь файл `docs/media-collage-rueckblick_corrected.md`, особенно разделы 1-16.
3. Осмотри итоговые файлы, которые должны быть задействованы:
   - `migrations/0009_create_event_media.sql`;
   - `src/lib/types/eventMedia.ts`;
   - `src/lib/types/index.ts`;
   - `src/lib/server/db/eventMedia.ts`;
   - `src/lib/server/db/events.ts`;
   - `src/lib/server/db/index.ts`;
   - `src/routes/+page.server.ts`;
   - `src/routes/+page.svelte`;
   - `src/lib/components/media/HomepageMediaCollage.svelte`;
   - `src/routes/rueckblick/+page.server.ts`;
   - `src/routes/rueckblick/+page.svelte`;
   - `src/lib/components/layout/Header.svelte`;
   - `src/routes/api/admin/events/delete/+server.ts`;
   - `static/translations/de.json`;
   - `static/translations/en.json`;
   - `static/translations/ru.json`;
   - `static/translations/uk.json`.
4. Используй `rg` для поиска дублирующей или устаревшей логики:
   - `rg "status != 'hidden'|status != \"hidden\"" src`;
   - `rg "show_on_homepage|show_on_rueckblick|event_media|media_settings" src migrations`;
   - `rg "getActiveEvents|getPastEvents|getHomepageMedia|getRueckblickMedia|getEventMediaObjectKeys" src`;

## Задача

Проверь все критерии готовности из раздела 16 ТЗ и исправь только реальные несоответствия.

### Главная страница

Проверь, что:

- если есть активные мероприятия, отображаются карточки мероприятий;
- мероприятие с `end_date` в будущем считается активным даже после наступления `date`;
- если активных мероприятий нет, отображается медиа-коллаж;
- если активных мероприятий нет и media нет, отображается понятное локализованное сообщение;
- видео не autoplay;
- видео не получает `src` и не загружается до клика;
- стрелки сдвигают коллаж на 1 элемент;
- при переключении стрелками активное видео останавливается;
- layout адаптируется на 1/2/3 элемента;
- компонент не рендерит все 330 media одновременно.

### Rückblick

Проверь, что:

- вкладка `Rückblick` добавлена правее `Bewertungen`;
- `/rueckblick` доступен публично;
- отображаются только media с `show_on_rueckblick = 1` и `status = 'uploaded'`;
- фильтры по датам и мероприятиям работают;
- при выбранном мероприятии general-media не отображаются;
- сортировка идет по `effective_media_date`;
- скрытые media публично не отображаются;
- пагинация работает;
- невалидные query-параметры не приводят к 500.

### База данных и серверная логика

Проверь, что:

- миграция создает `event_media` и `media_settings`;
- `event_id` обязателен только для `media_scope = 'event'`;
- general media хранится без привязки к мероприятию;
- связь с `events` использует `ON DELETE CASCADE`;
- лимиты по умолчанию 300 фото и 30 видео;
- hard cap лимитов 300/30 есть и в SQL, и в серверной логике;
- одно media может быть опубликовано одновременно на главной и в Rückblick;
- ограничения MIME/размера/duration есть в SQL и серверных публичных выборках;
- публичная публикация требует `publication_approved_at`;
- `getHomepageMedia` не использует `status != 'hidden'`;
- `getRueckblickMedia` использует `effective_date` с fallback `captured_at -> events.date -> created_at`.

### Удаление мероприятий

Проверь, что:

- hard-delete запрещен при любых регистрациях;
- endpoint не проверяет только активные регистрации;
- R2-ключи event-media собираются до `DELETE FROM events`;
- R2-файлы удаляются best-effort;
- частичные ошибки R2 логируются;
- cascade-delete D1 не заменяет удаление R2-файлов.

## Проверки

Выполни:

1. `npm run check`;
2. `npm run build`, если проект поддерживает эту команду;
3. имеющиеся тесты проекта, если они есть в `package.json`.

Если команда падает из-за окружения, зафиксируй точную причину и отдели проблемы окружения от ошибок реализации.

## Ограничения

- Не реализуй админку медиа из раздела 14.
- Не добавляй крупные рефакторинги.
- Не меняй unrelated-файлы.
- Не ломай существующие страницы `/`, `/events`, `/reviews`.
- Если находишь пользовательские незакоммиченные изменения, не откатывай их; работай поверх них аккуратно.

## Критерии приемки

- Все обязательные пункты раздела 16 либо выполнены, либо явно отмечены как заблокированные с причиной.
- `npm run check` проходит.
- Сборка проходит или дана точная причина сбоя.
- Публичные страницы устойчивы к пустым данным и ошибке отдельного media-URL.
- Существующие страницы `/`, `/events`, `/reviews` продолжают работать.
- Итоговый ответ содержит краткий audit report: что проверено, что исправлено, какие команды выполнены, какие риски остались.
