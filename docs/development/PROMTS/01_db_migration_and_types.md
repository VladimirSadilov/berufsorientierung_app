# Промпт 01: миграция БД и типы event media

Ты работаешь в проекте `berufsorientierung_app`. Реализуй только базовую схему данных и TypeScript-типы для ТЗ `docs/media-collage-rueckblick_corrected.md`.

## Сбор контекста

1. Перейди в корень проекта `berufsorientierung_app`.
2. Прочитай разделы ТЗ: 3, 5, 6, 7, 9 и критерии БД из 16.
3. Осмотри текущие миграции и стиль SQL:
   - `migrations/0001_initial.sql`
   - `migrations/0008_add_events_is_listed.sql`
4. Осмотри текущий экспорт типов:
   - `src/lib/types/index.ts`
   - соседние файлы в `src/lib/types`.

## Задача

Создай миграцию `migrations/0009_create_event_media.sql` и типы `src/lib/types/eventMedia.ts`.

Миграция должна создать:

- таблицу `event_media`;
- индексы, описанные в разделе 7 ТЗ;
- таблицу `media_settings`;
- строку настроек по умолчанию с `id = 1`, `homepage_max_images = 300`, `homepage_max_videos = 30`.

Схема должна отражать ограничения из разделов 5-7:

- `media_scope` только `event` или `general`;
- `event_id` обязателен только при `media_scope = 'event'`;
- при `media_scope = 'general'` поле `event_id` должно быть `NULL`;
- `media_type` только `image` или `video`;
- `status` только `uploaded` или `hidden`;
- изображения: `image/jpeg`, `image/png`, `image/webp`, размер не больше 3 MB, `duration_seconds IS NULL`;
- видео: `video/mp4`, `video/webm`, размер не больше 30 MB, `duration_seconds` обязателен, больше 0 и не больше 10;
- `width` и `height`, если указаны, больше 0;
- публичные флаги `show_on_homepage` или `show_on_rueckblick` нельзя выставить без `publication_approved_at`;
- связь `event_media.event_id -> events.id` использует `ON DELETE CASCADE`;
- `publication_approved_by`, `created_by`, `updated_by` ссылаются на `users(id)` через `ON DELETE SET NULL`;
- лимиты `media_settings` имеют hard cap: фото 0..300, видео 0..30.

Создай `src/lib/types/eventMedia.ts` с типами из раздела 9:

- `EventMediaType`;
- `EventMediaStatus`;
- `EventMediaScope`;
- `RueckblickSort`;
- `EventMedia`;
- `PublicEventMedia`;
- `RueckblickMediaFilters`;
- `MediaSettings`.

Экспортируй новые типы из `src/lib/types/index.ts`.

## Ограничения

- Не реализуй админку медиа из раздела 14.
- Не добавляй загрузку файлов.
- Не меняй существующие миграции.
- Не меняй поведение страниц.

## Проверка

1. Убедись, что имя миграции следует после `0008_add_events_is_listed.sql`.
2. Проверь, что SQL не содержит SQLite/D1-несовместимого синтаксиса.
3. Запусти `npm run check`, если зависимости доступны локально.

## Критерии приемки

- Файл `migrations/0009_create_event_media.sql` создан.
- `event_media` и `media_settings` создаются через `CREATE TABLE IF NOT EXISTS`.
- Все CHECK-ограничения из разделов 6 и 7 присутствуют.
- `media_settings` получает строку по умолчанию `id = 1`.
- Типы из раздела 9 созданы и экспортируются из общего индекса.
- Проект проходит `npm run check` или в отчете явно указана причина, почему проверка не была выполнена.
