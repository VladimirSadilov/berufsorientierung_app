# ТЗ: медиа-коллаж на главной странице и публичная вкладка Rückblick

## 1. Контекст

На главной странице сайта сейчас показывается блок активных мероприятий. Если активных мероприятий нет, отображается статичная заглушка, из-за чего сайт выглядит заброшенным.

Требуется заменить это поведение: если активные мероприятия отсутствуют, на их месте должен отображаться адаптивный коллаж из опубликованных фото и видео.

Также требуется добавить новую публичную вкладку `Rückblick` правее `Bewertungen`, где будут отображаться опубликованные retrospective-медиа с фильтрацией и сортировкой по датам и мероприятиям.

На текущем этапе реализуются:

- миграция БД и серверная структура данных;
- исправление определения активных/прошедших мероприятий через `end_date`;
- публичный коллаж на главной странице;
- публичная страница `/rueckblick`;
- подготовка структуры под будущую админку медиа.

Загрузка, редактирование и удаление медиа через админ-панель реализуются отдельным будущим этапом.

## 2. Текущая структура проекта

Ключевые существующие файлы:

- главная страница: `src/routes/+page.server.ts`, `src/routes/+page.svelte`;
- публичная страница мероприятий: `src/routes/events/+page.server.ts`, `src/routes/events/+page.svelte`;
- верхнее меню: `src/lib/components/layout/Header.svelte`;
- D1-логика мероприятий: `src/lib/server/db/events.ts`;
- типы мероприятий: `src/lib/types/event.ts`;
- R2-хранилище: `src/lib/server/storage/r2.ts`;
- загрузка постеров мероприятий: `src/routes/api/admin/events/[id]/poster/+server.ts`;
- endpoint удаления мероприятия: `src/routes/api/admin/events/delete/+server.ts`;
- переводы: `static/translations/de.json`, `en.json`, `ru.json`, `uk.json`;
- Tailwind/PostCSS: `tailwind.config.js`, `postcss.config.js`;
- текущая последняя миграция: `migrations/0008_add_events_is_listed.sql`.

Текущий проект использует Svelte 5-стиль (`$props`, `$state`, `$derived`) и Cloudflare Workers bindings (`DB`, `R2_BUCKET`, `R2_PUBLIC_URL`). Новые компоненты должны следовать этим соглашениям.

## 3. Термины

`created_at` — техническая дата создания записи медиа в системе.

`updated_at` — техническая дата последнего изменения записи медиа.

`captured_at` — дата, к которой относится медиа: дата съемки или дата мероприятия. Это поле используется для корректной сортировки Rückblick. Например, если фото мартовского мероприятия загрузили в июне, по `created_at` оно будет июньским, а по `captured_at` останется мартовским.

Если `captured_at` не указано или невалидно, система должна использовать дату связанного мероприятия `events.date` как fallback. Для общих медиа без привязки к мероприятию fallback — `event_media.created_at`.

`effective_media_date` — вычисляемая дата для сортировки и фильтрации:

```sql
COALESCE(
    datetime(NULLIF(event_media.captured_at, '')),
    datetime(events.date),
    datetime(event_media.created_at)
)
```

`media_scope` — область назначения медиа:

- `event` — медиа связано с конкретным мероприятием;
- `general` — медиа общего назначения, например короткий промо-ролик или изображение для главной страницы.

`publication_approved_at` / `publication_approved_by` — аудиторская отметка, что оператор проверил права на публикацию, согласия участников или отсутствие идентифицируемых людей. Публичные флаги нельзя выставлять без этой отметки.

## 4. Исправление определения активных и прошедших мероприятий

Перед подключением коллажа нужно исправить `getActiveEvents(db)` в `src/lib/server/db/events.ts`.

### 4.1. Активное мероприятие

Активное мероприятие:

- `events.status = 'active'`;
- `COALESCE(events.end_date, events.date)` находится в будущем или равно текущему времени.

Рекомендуемое условие:

```sql
WHERE e.status = 'active'
  AND COALESCE(e.end_date, e.date) >= ?
```

Сортировка активных мероприятий остается по `e.date ASC`, чтобы ближайшие начавшиеся/предстоящие мероприятия были первыми.

### 4.2. Прошедшее мероприятие

`getPastEvents(db)` также нужно привести к той же логике:

```sql
WHERE COALESCE(e.end_date, e.date) < ?
```

Это предотвращает ситуацию, когда мероприятие уже началось, но еще идет, и при этом попадает в прошедшие или исчезает с главной страницы.

### 4.3. `is_listed`

Текущий проект фильтрует `is_listed` на `/events` после вызова `getActiveEvents` / `getPastEvents`. Для главной страницы существующее поведение можно сохранить, если бизнес-логика предполагает, что активные мероприятия показываются на главной независимо от `is_listed`.

Если `is_listed = 0` должно скрывать мероприятие и с главной страницы, это нужно явно согласовать и добавить фильтр `e.is_listed != 0` в `src/routes/+page.server.ts`. По умолчанию в этом ТЗ `is_listed` остается фильтром только для `/events`, как сейчас в коде.

## 5. Хранение медиа

Файлы должны храниться в Cloudflare R2, так как проект уже использует R2 для QR-кодов и постеров.

В D1 должна храниться только метаинформация:

- опциональная связь с мероприятием;
- область назначения медиа (`event` или `general`);
- тип медиа;
- R2 object key;
- публичный URL;
- MIME type;
- размер;
- длительность для видео;
- размеры изображения/видео;
- флаги публикации;
- аудиторская отметка проверки прав/согласия;
- технические даты.

Рекомендуемые R2-префиксы:

- `event-media/{eventId}/{uuid-or-timestamp}.{ext}`;
- `event-media-thumbnails/{eventId}/{uuid-or-timestamp}.jpg`;
- `general-media/{homepage|rueckblick|mixed|other}/{uuid-or-timestamp}.{ext}`;
- `general-media-thumbnails/{homepage|rueckblick|mixed|other}/{uuid-or-timestamp}.jpg`.

`event_id` не является обязательным для всех медиа:

- для `media_scope = 'event'` он обязателен;
- для `media_scope = 'general'` он должен быть `NULL`.

Общие медиа допускаются для материалов без конкретного мероприятия: промо-роликов, изображений для главной страницы, общих фото, которые оператор публикует в Rückblick без привязки к событию.

## 6. Безопасность MIME-типов и размеров

Разрешенные MIME-типы для первой реализации:

- изображения: `image/jpeg`, `image/png`, `image/webp`;
- видео: `video/mp4`, `video/webm`.

SVG не разрешать для публичных пользовательских медиа, чтобы не создавать риск XSS через SVG-контент. Расширение файла нельзя доверять; расширение в R2-key нужно выводить из проверенного MIME-типа.

Ограничения:

- изображение: максимум 3 MB;
- видео: максимум 30 MB;
- видео: максимум 10 секунд;
- `duration_seconds` для видео обязателен и должен быть больше `0`;
- `width` и `height`, если указаны, должны быть больше `0`.

Ограничения должны быть отражены и в SQL CHECK constraints, и в серверной логике будущей загрузки.

## 7. Миграция БД

Создать новую миграцию:

`migrations/0009_create_event_media.sql`

Рекомендуемая структура:

```sql
CREATE TABLE IF NOT EXISTS event_media (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,

    media_scope TEXT NOT NULL DEFAULT 'event'
        CHECK (media_scope IN ('event', 'general')),

    media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video')),

    -- Базовый storage/moderation status.
    -- Публичное размещение управляется отдельными флагами, потому что один файл
    -- может быть показан и на главной, и в Rückblick.
    status TEXT NOT NULL DEFAULT 'uploaded'
        CHECK (status IN ('uploaded', 'hidden')),

    show_on_homepage INTEGER NOT NULL DEFAULT 0 CHECK (show_on_homepage IN (0, 1)),
    show_on_rueckblick INTEGER NOT NULL DEFAULT 0 CHECK (show_on_rueckblick IN (0, 1)),

    object_key TEXT NOT NULL UNIQUE,
    public_url TEXT NOT NULL,

    thumbnail_object_key TEXT,
    thumbnail_url TEXT,

    mime_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL CHECK (size_bytes > 0),
    duration_seconds REAL CHECK (duration_seconds IS NULL OR duration_seconds > 0),
    width INTEGER CHECK (width IS NULL OR width > 0),
    height INTEGER CHECK (height IS NULL OR height > 0),

    original_filename TEXT,
    alt_text TEXT,
    captured_at TEXT,

    -- Аудит проверки прав/согласия перед публичной публикацией.
    publication_approved_at TEXT,
    publication_approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,

    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),

    CHECK (
        (media_type = 'image'
            AND mime_type IN ('image/jpeg', 'image/png', 'image/webp')
            AND size_bytes <= 3145728
            AND duration_seconds IS NULL)
        OR
        (media_type = 'video'
            AND mime_type IN ('video/mp4', 'video/webm')
            AND size_bytes <= 31457280
            AND duration_seconds IS NOT NULL
            AND duration_seconds <= 10)
    ),

    CHECK (
        (media_scope = 'event' AND event_id IS NOT NULL)
        OR
        (media_scope = 'general' AND event_id IS NULL)
    ),

    -- Нельзя публично показывать медиа без ручного подтверждения прав/согласия.
    CHECK (
        (show_on_homepage = 0 AND show_on_rueckblick = 0)
        OR publication_approved_at IS NOT NULL
    )
);

CREATE INDEX IF NOT EXISTS idx_event_media_event_id
    ON event_media(event_id);

CREATE INDEX IF NOT EXISTS idx_event_media_homepage_lookup
    ON event_media(show_on_homepage, status, media_type, created_at);

CREATE INDEX IF NOT EXISTS idx_event_media_rueckblick_lookup
    ON event_media(show_on_rueckblick, status, event_id, captured_at, created_at);

CREATE INDEX IF NOT EXISTS idx_event_media_scope
    ON event_media(media_scope, show_on_homepage, show_on_rueckblick, status);

CREATE TABLE IF NOT EXISTS media_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    homepage_max_images INTEGER NOT NULL DEFAULT 300
        CHECK (homepage_max_images >= 0 AND homepage_max_images <= 300),
    homepage_max_videos INTEGER NOT NULL DEFAULT 30
        CHECK (homepage_max_videos >= 0 AND homepage_max_videos <= 30),
    updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

INSERT OR IGNORE INTO media_settings (id, homepage_max_images, homepage_max_videos)
VALUES (1, 300, 30);
```

`updated_at` обновлять серверной логикой при изменениях. Триггер не обязателен.

Эффективные пользовательские статусы в будущей админке:

- `Uploaded`: `status = 'uploaded'`, оба флага публикации равны `0`;
- `Homepage`: `show_on_homepage = 1`;
- `Rückblick`: `show_on_rueckblick = 1`;
- `Hidden`: `status = 'hidden'`;
- `General`: дополнительный бейдж для `media_scope = 'general'`;
- `Publication approved`: `publication_approved_at IS NOT NULL`;
- если `show_on_homepage = 1` и `show_on_rueckblick = 1`, показывать оба бейджа.

## 8. Серверная логика

Добавить новый DB-модуль:

`src/lib/server/db/eventMedia.ts`

Минимальные функции текущего этапа:

- `getHomepageMedia(db)`;
- `getRueckblickMedia(db, filters)`;
- `getRueckblickEvents(db)`;
- `getEventMediaObjectKeys(db, eventId)`;
- `getMediaSettings(db)`.

Функции будущего этапа:

- `updateMediaSettings(...)`;
- `createEventMedia(...)`;
- `updateEventMediaVisibility(...)`;
- `deleteEventMedia(...)`;
- `deleteEventMediaFiles(...)` или аналогичный helper для R2.

Подключить новый модуль в `src/lib/server/db/index.ts`:

```ts
import * as eventMedia from "./eventMedia";

export const DB = {
  // existing modules
  eventMedia,
};
```

### 8.1. `getMediaSettings(db)`

Функция должна возвращать строку `media_settings.id = 1`.

Если строка отсутствует по любой причине, вернуть безопасные значения по умолчанию:

```ts
{
    homepage_max_images: 300,
    homepage_max_videos: 30,
}
```

Даже если в БД попадут некорректные значения, сервер должен дополнительно ограничить их hard cap:

- изображения: `0..300`;
- видео: `0..30`.

### 8.2. `getHomepageMedia(db)`

Функция должна:

1. Получить настройки через `getMediaSettings(db)`.
2. Отдельно выбрать изображения:

```sql
SELECT *
FROM event_media
WHERE show_on_homepage = 1
  AND status = 'uploaded'
  AND media_type = 'image'
  AND size_bytes <= 3145728
ORDER BY datetime(created_at) DESC
LIMIT ?
```

3. Отдельно выбрать видео:

```sql
SELECT *
FROM event_media
WHERE show_on_homepage = 1
  AND status = 'uploaded'
  AND media_type = 'video'
  AND size_bytes <= 31457280
  AND duration_seconds IS NOT NULL
  AND duration_seconds > 0
  AND duration_seconds <= 10
ORDER BY datetime(created_at) DESC
LIMIT ?
```

4. Объединить два массива на сервере.
5. Отсортировать объединенный результат по `created_at DESC`.
6. Вернуть не более `homepage_max_images + homepage_max_videos` записей.

Важно: не использовать `status != 'hidden'`.

### 8.3. `getRueckblickMedia(db, filters)`

Функция должна возвращать `{ items, total }` и поддерживать фильтры:

- `eventId?: number`;
- `dateFrom?: string` в формате `YYYY-MM-DD`;
- `dateTo?: string` в формате `YYYY-MM-DD`;
- `sort?: 'newest' | 'oldest'`;
- `limit?: number`;
- `offset?: number`.

Базовое условие публичности:

```sql
WHERE em.show_on_rueckblick = 1
  AND em.status = 'uploaded'
```

Если выбран `eventId`, общие медиа не попадают в результат:

```sql
AND em.media_scope = 'event'
AND em.event_id = ?
```

Вычисляемая дата:

```sql
COALESCE(
    datetime(NULLIF(em.captured_at, '')),
    datetime(e.date),
    datetime(em.created_at)
)
```

Фильтрация по датам:

```sql
AND date(effective_media_date) >= date(?)
AND date(effective_media_date) <= date(?)
```

Сортировка:

- `newest`: `ORDER BY effective_media_date DESC, em.id DESC`;
- `oldest`: `ORDER BY effective_media_date ASC, em.id ASC`.

`limit` по умолчанию: `24`.

Максимальный `limit`: `60`.

### 8.4. `getRueckblickEvents(db)`

Функция должна возвращать только мероприятия, у которых есть хотя бы одно публичное Rückblick-медиа:

```sql
SELECT DISTINCT
    e.id,
    e.title_de,
    e.title_en,
    e.title_ru,
    e.title_uk,
    e.date
FROM events e
JOIN event_media em ON em.event_id = e.id
WHERE em.show_on_rueckblick = 1
  AND em.status = 'uploaded'
  AND em.media_scope = 'event'
ORDER BY datetime(e.date) DESC
```

Не фильтровать автоматически по `events.status`, если медиа явно опубликовано оператором. Публичность контролируется флагами `event_media`.

### 8.5. `getEventMediaObjectKeys(db, eventId)`

Функция должна вернуть все R2-ключи, которые нужно удалить при hard-delete события:

- `object_key`;
- `thumbnail_object_key`, если есть.

Ключи нужно получить до удаления записи из `events`, потому что `ON DELETE CASCADE` удалит строки `event_media`.

## 9. Типы

Добавить файл:

`src/lib/types/eventMedia.ts`

Минимальные типы:

```ts
export type EventMediaType = "image" | "video";
export type EventMediaStatus = "uploaded" | "hidden";
export type EventMediaScope = "event" | "general";
export type RueckblickSort = "newest" | "oldest";

export interface EventMedia {
  id: number;
  event_id: number | null;
  media_scope: EventMediaScope;
  media_type: EventMediaType;
  status: EventMediaStatus;
  show_on_homepage: 0 | 1;
  show_on_rueckblick: 0 | 1;
  object_key: string;
  public_url: string;
  thumbnail_object_key: string | null;
  thumbnail_url: string | null;
  mime_type: string;
  size_bytes: number;
  duration_seconds: number | null;
  width: number | null;
  height: number | null;
  original_filename: string | null;
  alt_text: string | null;
  captured_at: string | null;
  publication_approved_at: string | null;
  publication_approved_by: number | null;
  created_by: number | null;
  created_at: string;
  updated_at: string;
}

export interface PublicEventMedia {
  id: number;
  event_id: number | null;
  media_scope: EventMediaScope;
  media_type: EventMediaType;
  public_url: string;
  thumbnail_url: string | null;
  mime_type: string;
  duration_seconds: number | null;
  width: number | null;
  height: number | null;
  alt_text: string | null;
  captured_at: string | null;
  effective_date: string;
  event_title_de?: string | null;
  event_title_en?: string | null;
  event_title_ru?: string | null;
  event_title_uk?: string | null;
  event_date?: string | null;
}

export interface RueckblickMediaFilters {
  eventId?: number;
  dateFrom?: string;
  dateTo?: string;
  sort: RueckblickSort;
  limit: number;
  offset: number;
}

export interface MediaSettings {
  homepage_max_images: number;
  homepage_max_videos: number;
}
```

Экспортировать типы из `src/lib/types/index.ts`.

## 10. Главная страница

Файл: `src/routes/+page.server.ts`.

Поведение:

1. Загрузить активные мероприятия через исправленный `getActiveEvents(db)`.
2. Если активные мероприятия есть, вернуть их как сейчас и не загружать медиа для коллажа.
3. Если активных мероприятий нет, загрузить медиа для коллажа через `getHomepageMedia(db)`.
4. Загрузка отзывов должна остаться best-effort, как сейчас.
5. Ошибка загрузки media не должна ломать страницу; нужно залогировать ошибку и вернуть пустой массив `homepageMedia`.

Возвращаемая структура должна стать примерно такой:

```ts
return {
  events: eventsWithStats,
  homepageMedia,
  latestReviews,
};
```

Если БД недоступна, страница возвращает пустые массивы и показывает fallback-сообщение.

Файл: `src/routes/+page.svelte`.

Поведение:

- если `data.events.length > 0`, показывать текущую сетку `EventCard`;
- если `data.events.length === 0` и `data.homepageMedia.length > 0`, показывать `HomepageMediaCollage`;
- если `data.events.length === 0` и media нет или медиа не удалось загрузить, показывать информативное сообщение.

Так как проект мультиязычный, сообщение нужно добавить в переводы. Английский fallback:

`We are preparing new events and media highlights. Please check back soon.`

Рекомендуемые ключи:

```json
{
  "homepage": {
    "events": {
      "mediaFallback": {
        "title": "New highlights are coming",
        "message": "We are preparing new events and media highlights. Please check back soon."
      }
    }
  }
}
```

Добавить локализованные значения в `de.json`, `en.json`, `ru.json`, `uk.json`.

## 11. Компонент коллажа

Создать компонент:

`src/lib/components/media/HomepageMediaCollage.svelte`

Пропсы:

```ts
let { media } = $props<{ media: PublicEventMedia[] }>();
```

Внешний вид:

- mobile-first layout;
- 1 элемент на mobile;
- 2 элемента на tablet;
- 3 элемента на desktop;
- все видимые элементы находятся в общем контейнере;
- контейнер имеет тонкую синюю рамку, скругленные углы и легкую тень;
- использовать цвета проекта из `tailwind.config.js`, прежде всего `primary` / `blue`:
  - `primary.500` / `#3b82f6`;
  - `primary.600` / `#2563eb`;
  - `primary.700` / `#1d4ed8`;
- стрелки расположены слева и справа внутри контейнера;
- стрелки белые, внутри синего круга;
- нажатие на стрелку сдвигает коллаж на 1 медиа-элемент;
- при количестве медиа меньше видимого количества показывать доступное количество без поломки layout;
- если переключать нечего, стрелки скрыть или сделать disabled.

Производительность:

- не рендерить все 330 потенциальных элементов одновременно;
- рендерить только текущий видимый window, допустимо плюс 1 соседний элемент для плавности;
- изображения использовать с `loading="lazy"` и `decoding="async"`;
- видео не должно получать `src` до клика пользователя.

Видео:

- autoplay запрещен;
- `<video>` использовать с `preload="none"`;
- видео не должно загружаться и проигрываться автоматически;
- поверх preview показывается кастомная play-кнопка;
- при клике пользователя видео начинает проигрываться;
- если thumbnail отсутствует, показывается fallback-плитка с play-кнопкой;
- отсутствие thumbnail не блокирует запуск видео;
- при переключении стрелками активное видео должно останавливаться;
- при unmount компонента активное видео должно останавливаться.

Доступность:

- кнопки стрелок должны иметь `aria-label`;
- play-кнопка должна быть настоящей `<button>`;
- для изображений использовать `alt_text`, если есть; если нет — пустой `alt=""` или локализованный fallback в зависимости от контекста.

## 12. Публичная вкладка Rückblick

Добавить пункт меню в `Header.svelte`:

- ключ перевода: `nav.rueckblick`;
- URL: `/rueckblick`;
- расположение: сразу после `Bewertungen` / `/reviews`;
- в немецком переводе label должен быть `Rückblick`.

Добавить переводы:

```json
{
  "nav": {
    "rueckblick": "Rückblick"
  }
}
```

Для `en`, `ru`, `uk` можно использовать локализованные подписи, но немецкий label должен быть точным.

Создать маршрут:

- `src/routes/rueckblick/+page.server.ts`;
- `src/routes/rueckblick/+page.svelte`.

Публичная страница `/rueckblick` должна показывать только публичные медиа:

- `show_on_rueckblick = 1`;
- `status = 'uploaded'`.

Скрытые, просто загруженные или не подтвержденные для публикации медиа не должны отображаться публичным пользователям.

### 12.1. Query-параметры

Поддерживаемые параметры:

- `eventId`: положительное целое число;
- `dateFrom`: `YYYY-MM-DD`;
- `dateTo`: `YYYY-MM-DD`;
- `sort`: `newest` или `oldest`;
- `page`: положительное целое число.

Безопасные значения по умолчанию:

- `sort = 'newest'`;
- `page = 1`;
- `limit = 24`.

Невалидные параметры не должны приводить к 500. Их нужно игнорировать или заменять безопасными значениями.

Если `dateFrom > dateTo`, допустимо либо поменять даты местами, либо игнорировать обе. Главное — не отдавать 500.

### 12.2. Фильтры

Фильтры:

- мероприятие (`eventId`);
- дата от;
- дата до;
- сортировка.

При выбранном мероприятии общие медиа `media_scope = 'general'` не попадают в результат.

### 12.3. Пагинация

Страница должна использовать пагинацию, чтобы не загружать большое количество видео сразу.

- на странице по умолчанию: 24 элемента;
- максимум: 60 элементов;
- сервер возвращает `total`, `page`, `totalPages`, `hasMore`.

### 12.4. UI страницы

`+page.svelte` должен:

- показывать заголовок и описание страницы через переводы;
- показывать форму фильтров с `method="GET"`;
- показывать сетку медиа;
- показывать пустое состояние, если медиа нет;
- показывать пагинацию;
- не монтировать/не загружать видео до клика пользователя;
- использовать thumbnail или fallback-плитку для видео;
- корректно обрабатывать ошибку загрузки конкретного media-URL, не ломая всю страницу.

## 13. Удаление мероприятий и R2-файлов

При hard-delete мероприятия должны удаляться:

- связанные записи из `event_media` через `ON DELETE CASCADE`;
- связанные файлы из R2;
- связанные thumbnail-файлы из R2;
- существующие QR/poster-файлы мероприятия, как сейчас.

Важно: D1 cascade удаляет только строки БД, но не удаляет R2-объекты. Поэтому R2-ключи нужно получить до удаления события.

Рекомендуемый порядок для hard-delete:

1. Проверить, что мероприятие существует.
2. Проверить, что регистраций нет вообще:

```sql
SELECT COUNT(*) as count
FROM registrations
WHERE event_id = ?
```

3. Если `count > 0`, hard-delete запрещен.
4. До удаления события получить:
   - QR/poster URLs из `events`;
   - `object_key` и `thumbnail_object_key` через `getEventMediaObjectKeys(db, eventId)`.
5. Удалить R2-файлы best-effort через `Promise.allSettled` или существующий helper.
6. Залогировать неуспешные удаления R2.
7. Выполнить `DELETE FROM events WHERE id = ?`.
8. Залогировать итоговое действие.

Endpoint `src/routes/api/admin/events/delete/+server.ts` нужно исправить: блокировать hard-delete не только при активных регистрациях, а при любых регистрациях.

Для мероприятия с регистрациями использовать безопасное скрытие/soft-delete:

- `status = 'cancelled'`;
- `is_listed = 0`;
- при необходимости отдельное поле `deleted_at` в будущей миграции;
- активные регистрации отменяются через существующий сценарий отмены мероприятия;
- пользователи уведомляются;
- связанные event-медиа скрываются или удаляются через явный server helper, но не через `ON DELETE CASCADE`, потому что hard-delete не выполняется.

При soft-delete/скрытии медиа:

- поставить `status = 'hidden'`;
- поставить `show_on_homepage = 0`;
- поставить `show_on_rueckblick = 0`;
- при необходимости удалить R2-объекты отдельным helper-ом;
- залогировать количество скрытых/удаленных записей и результат R2-операций.

## 14. Будущий этап: админка медиа

Отдельным будущим этапом разработать административный инструментарий:

- новая админская страница, например `/admin/media`;
- загрузка фото/видео;
- удаление фото/видео;
- привязка медиа к мероприятию;
- создание general-media без привязки к мероприятию;
- управление флагами:
  - показывать на главной;
  - показывать в Rückblick;
  - скрыть;
- обязательное подтверждение проверки прав/согласия перед публичной публикацией;
- отображение статусов/бейджей;
- фильтрация по мероприятию, дате, типу медиа и статусу;
- сортировка;
- предпросмотр;
- удаление R2-файла вместе с D1-записью;
- fallback-изображение для плитки видео, если у видео отсутствует thumbnail;
- настройки лимитов коллажа: оператор может уменьшать максимальное количество фото и видео, доступных для коллажа на главной странице; значения по умолчанию — 300 фото и 30 видео.

Клиентская проверка при загрузке:

- фото больше 3 MB отклонять до отправки;
- видео больше 30 MB отклонять до отправки;
- видео длительностью больше 10 секунд отклонять до отправки;
- длительность проверять на клиенте через временный object URL и metadata видео;
- MIME-тип проверять на клиенте предварительно, но считать серверную проверку источником истины;
- при публикации на главной предупреждать оператора, если после изменения будет превышен лимит фото или видео из `media_settings`;
- показывать понятное сообщение об ошибке.

Серверная проверка при загрузке:

- не доверять `file.type` и имени файла без проверки;
- проверять MIME type;
- проверять размер;
- проверять duration для видео;
- формировать R2-key из безопасного UUID/timestamp и расширения, полученного из MIME type;
- не разрешать SVG;
- не разрешать публичные флаги без `publication_approved_at`.

Первая реализация не должна включать клиентскую обрезку и перекодирование в H.265.

Причина: браузерная обработка через `ffmpeg.wasm` слишком тяжелая для первого этапа, увеличивает bundle, может зависать на слабых устройствах и не гарантирует надежную поддержку H.265.

## 15. Edge-кейсы

Нет активных мероприятий и есть homepage media:

- показывается коллаж.

Нет активных мероприятий и нет homepage media:

- показывается локализованное сообщение с английским fallback:
  `We are preparing new events and media highlights. Please check back soon.`

Мероприятие началось, но `end_date` еще в будущем:

- мероприятие считается активным;
- коллаж не показывается вместо него.

БД недоступна:

- страница не падает;
- пользователь видит понятное сообщение;
- ошибка логируется на сервере.

R2-файл недоступен, но запись есть в БД:

- вся страница не падает;
- конкретный элемент показывает fallback или скрывает сломанную плитку;
- ошибка не блокирует остальные медиа.

Видео без thumbnail:

- показывается fallback-плитка с play-кнопкой;
- если оператор загрузил fallback-изображение, использовать его;
- иначе использовать встроенную нейтральную плитку;
- видео запускается только после клика пользователя.

Видео проигрывается, пользователь нажимает стрелку:

- видео останавливается;
- новый видимый набор медиа не должен содержать продолжающий играть скрытый элемент.

Медиа меньше, чем нужно для 3 карточек:

- показывать доступные элементы;
- стрелки скрыть или сделать disabled, если переключать нечего.

Одно медиа опубликовано и на главной, и в Rückblick:

- это допустимо;
- в будущем админском UI показывать оба бейджа.

Медиа имеет `status = 'hidden'` и публичные флаги `1`:

- публичные страницы его не показывают, потому что требуют `status = 'uploaded'`.

Невалидный `captured_at`:

- сортировка Rückblick использует fallback на `events.date`, затем `created_at`.

Мероприятие удаляется:

- если есть любые регистрации, hard-delete блокируется;
- оператор сначала отменяет мероприятие с причиной, система отменяет активные регистрации и отправляет уведомления;
- если у мероприятия есть любые регистрации, используется soft-delete/скрытие, чтобы не ломать историю регистраций;
- hard-delete без регистраций удаляет D1-записи `event_media` через `ON DELETE CASCADE`;
- R2-ключи event-media должны быть получены до cascade-delete;
- R2-файлы удаляются серверной логикой;
- если R2-удаление частично не удалось, ошибка логируется.

Невалидные query-параметры `/rueckblick`:

- использовать безопасные значения по умолчанию;
- не отдавать 500 из-за некорректного `eventId`, `dateFrom`, `dateTo`, `sort` или `page`.

Большая медиатека:

- использовать pagination/limit;
- не рендерить и не загружать все видео сразу;
- сервер не возвращает в коллаж больше лимитов из `media_settings`: максимум 300 фото и 30 видео.

## 16. Критерии готовности

### Главная страница

- если есть активные мероприятия, отображаются карточки мероприятий;
- мероприятие с `end_date` в будущем считается активным даже после наступления `date`;
- если активных мероприятий нет, отображается медиа-коллаж;
- если активных мероприятий нет и media нет, отображается понятное локализованное сообщение;
- видео не проигрывается автоматически;
- видео не загружается до клика пользователя;
- видео запускается только после клика пользователя;
- переключение стрелками сдвигает коллаж на 1 элемент;
- при переключении стрелками активное видео останавливается;
- layout адаптируется: 1 / 2 / 3 элемента;
- компонент не рендерит все 330 media-элементов одновременно;
- страница не зависает.

### Rückblick

- вкладка `Rückblick` добавлена правее `Bewertungen`;
- URL `/rueckblick` доступен публично;
- отображаются только медиа, опубликованные для Rückblick;
- публичный запрос использует `status = 'uploaded'`;
- работают фильтры по датам и мероприятиям;
- при выбранном мероприятии general-media не отображаются;
- работает сортировка по `effective_media_date`;
- скрытые медиа публично не отображаются;
- пагинация работает;
- невалидные query-параметры не приводят к 500.

### База данных

- миграция создает `event_media`;
- `event_id` обязателен только для `media_scope = 'event'`;
- общие медиа `media_scope = 'general'` хранятся без привязки к мероприятию;
- связь с `events` использует `ON DELETE CASCADE`;
- миграция создает `media_settings` с лимитами по умолчанию 300 фото и 30 видео;
- hard cap лимитов: 300 фото и 30 видео;
- одно медиа может быть одновременно опубликовано на главной и в Rückblick;
- ограничения размера, MIME-типа и длительности отражены в схеме и серверной логике;
- публичная публикация требует `publication_approved_at`.

### Удаление мероприятий

- мероприятие с любыми регистрациями нельзя hard-delete без отдельной миграции, сохраняющей историю регистраций;
- мероприятие с регистрациями удаляется безопасно через soft-delete/скрытие;
- endpoint удаления больше не блокирует только активные регистрации, а проверяет любые регистрации;
- связанные event-media и R2-объекты удаляются или скрываются по явно описанной серверной процедуре;
- R2-ключи собираются до `DELETE FROM events`.

### Проверки

- проект проходит `npm run check`;
- проект проходит сборку;
- публичные страницы не падают при пустых данных;
- публичные страницы не падают при ошибке загрузки отдельного media-URL;
- существующие страницы `/`, `/events`, `/reviews` продолжают работать.
