# Промпт 02: серверный DB-модуль eventMedia

Ты работаешь в проекте `berufsorientierung_app`. Реализуй серверную логику чтения медиа для главной страницы, Rückblick и удаления мероприятий.

Промпт должен быть исполним в отдельной последовательной сессии: сначала проверь текущее состояние файлов, затем добавляй только отсутствующую или некорректную логику. Не дублируй функции и не переписывай уже корректные реализации.

## Сбор контекста

1. Перейди в корень проекта `berufsorientierung_app`.
2. Прочитай разделы ТЗ: 3, 8, 9, 15 и критерии БД/Rückblick из 16.
3. Осмотри существующие DB-модули и стиль D1-запросов:
   - `src/lib/server/db/events.ts`
   - `src/lib/server/db/reviews.ts`
   - `src/lib/server/db/index.ts`
4. Проверь, есть ли `src/lib/types/eventMedia.ts`. Если файла нет, создай минимальные типы из раздела 9 ТЗ, потому что этот модуль зависит от них.
5. Проверь миграцию `migrations/0009_create_event_media.sql`. Если ее нет, не переписывай весь этап миграции; зафиксируй это в отчете и реализуй DB-модуль так, чтобы он соответствовал ожидаемой схеме из раздела 7.

## Задача

Создай `src/lib/server/db/eventMedia.ts` и подключи его в `src/lib/server/db/index.ts` как `DB.eventMedia`.

Минимальные функции текущего этапа:

- `getMediaSettings(db)`;
- `getHomepageMedia(db)`;
- `getRueckblickMedia(db, filters)`;
- `getRueckblickEvents(db)`;
- `getEventMediaObjectKeys(db, eventId)`.

### `getMediaSettings(db)`

- Возвращает настройки из `media_settings` для `id = 1`.
- Если строка отсутствует или запрос не дал значений, возвращает `{ homepage_max_images: 300, homepage_max_videos: 30 }`.
- Дополнительно ограничивает значения на сервере:
  - `homepage_max_images`: 0..300;
  - `homepage_max_videos`: 0..30.

### `getHomepageMedia(db)`

Реализуй логику из раздела 8.2:

- сначала получает настройки через `getMediaSettings`;
- отдельно выбирает изображения с `show_on_homepage = 1`, `status = 'uploaded'`, `publication_approved_at IS NOT NULL`, `media_type = 'image'`, `size_bytes <= 3145728`;
- отдельно выбирает видео с `show_on_homepage = 1`, `status = 'uploaded'`, `publication_approved_at IS NOT NULL`, `media_type = 'video'`, `size_bytes <= 31457280`, `duration_seconds > 0`, `duration_seconds <= 10`;
- использует `LIMIT` из настроек;
- объединяет результаты на сервере;
- сортирует общий массив по `created_at DESC`;
- возвращает не больше `homepage_max_images + homepage_max_videos`;
- не использует условие `status != 'hidden'`.
- возвращает публичную форму данных `PublicEventMedia[]`, не отдавая на клиент внутренние поля `object_key`, `thumbnail_object_key`, `status`, `show_on_*`, `publication_approved_*`, `created_by`.
- для `effective_date` в homepage-данных использует безопасное значение `COALESCE(datetime(NULLIF(captured_at, '')), datetime(created_at))`, если нет join с events.

### `getRueckblickMedia(db, filters)`

Реализуй логику из раздела 8.3:

- возвращает `{ items, total }`;
- типизируй параметр как `Partial<RueckblickMediaFilters> = {}` или эквивалентно, потому что route может передавать нормализованные значения, а сам DB-helper должен иметь безопасные defaults;
- базовая публичность: `em.show_on_rueckblick = 1 AND em.status = 'uploaded' AND em.publication_approved_at IS NOT NULL`;
- поддерживает `eventId`, `dateFrom`, `dateTo`, `sort`, `limit`, `offset`;
- при выбранном `eventId` добавляет `em.media_scope = 'event' AND em.event_id = ?`;
- вычисляет `effective_date` через:
  `COALESCE(datetime(NULLIF(em.captured_at, '')), datetime(e.date), datetime(em.created_at))`;
- фильтрует даты по `date(effective_date)`;
- сортирует:
  - `newest`: `effective_date DESC, em.id DESC`;
  - `oldest`: `effective_date ASC, em.id ASC`;
- применяет `limit` по умолчанию 24 и максимум 60, если вызывающий код передал некорректные значения.
- выбирает только публичные поля, совместимые с `PublicEventMedia`, плюс `effective_date` и локализованные названия/дату мероприятия через `LEFT JOIN events e ON e.id = em.event_id`;
- не возвращает `object_key`, audit-поля или служебные publication flags наружу.
- для фильтрации по `effective_date` используй CTE/subquery или повторяй выражение явно в `WHERE`; не полагайся на SELECT-alias в `WHERE`, чтобы запрос оставался переносимым для D1/SQLite.
- `total` считай отдельным запросом с теми же `WHERE`-условиями и теми же bind-параметрами, но без `LIMIT/OFFSET`.

### `getRueckblickEvents(db)`

Реализуй раздел 8.4:

- возвращает только мероприятия, у которых есть хотя бы одно публичное Rückblick-медиа;
- фильтрует `em.show_on_rueckblick = 1`, `em.status = 'uploaded'`, `em.publication_approved_at IS NOT NULL`, `em.media_scope = 'event'`;
- не фильтрует по `events.status`;
- сортирует по `datetime(e.date) DESC`.

### `getEventMediaObjectKeys(db, eventId)`

Реализуй раздел 8.5:

- возвращает все `object_key`;
- возвращает `thumbnail_object_key`, если он есть;
- результат должен быть удобен для последующего удаления R2-объектов;
- запрос должен выполняться до удаления мероприятия, так как `ON DELETE CASCADE` удалит строки.

## Ограничения

- Не реализуй загрузку, редактирование и удаление медиа через админку.
- Не добавляй публичные маршруты в этом промпте.
- Не меняй UI.
- Не доверяй `status != 'hidden'`; публичные выборки используют строго `status = 'uploaded'`.

## Проверка

1. Запусти `npm run check`.
2. Если в проекте есть тесты DB-модулей, добавь или обнови минимальные тесты для лимитов, сортировки и фильтра `eventId`.

## Критерии приемки

- `src/lib/server/db/eventMedia.ts` существует.
- Все пять функций реализованы и типизированы.
- `DB.eventMedia` экспортируется из `src/lib/server/db/index.ts`.
- Homepage-запросы соблюдают лимиты 300 фото и 30 видео через настройки и hard cap.
- Homepage- и Rückblick-запросы не возвращают media без `publication_approved_at`.
- Rückblick-запросы используют `effective_date`, пагинацию и безопасный limit.
- При выбранном `eventId` general-media не возвращаются.
- `getEventMediaObjectKeys` возвращает ключи до cascade-delete.
- Проект проходит `npm run check` или причина невозможности проверки описана в отчете.
