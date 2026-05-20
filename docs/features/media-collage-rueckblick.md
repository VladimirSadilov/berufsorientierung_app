# ТЗ: медиа-коллаж на главной странице и публичная вкладка Rückblick

## 1. Контекст

На главной странице сайта сейчас показывается блок активных мероприятий. Если активных мероприятий нет, отображается статичная заглушка, из-за чего сайт выглядит заброшенным.

Требуется заменить это поведение: если активные мероприятия отсутствуют, на их месте должен отображаться адаптивный коллаж из загруженных фото и видео.

Также требуется предусмотреть новую публичную вкладку `Rückblick` правее `Bewertungen`, где будут отображаться медиа, опубликованные для Rückblick, с фильтрацией и сортировкой по датам и мероприятиям.

На текущем этапе реализуются:

- миграция БД и серверная структура данных;
- публичный коллаж на главной странице;
- публичная страница `/rueckblick`;
- подготовка структуры под будущую админку.

Загрузка и удаление медиа через админ-панель планируются отдельным будущим этапом.

## 2. Текущая структура проекта

Ключевые существующие файлы:

- главная страница: `src/routes/+page.server.ts`, `src/routes/+page.svelte`;
- публичная страница мероприятий: `src/routes/events/+page.server.ts`, `src/routes/events/+page.svelte`;
- верхнее меню: `src/lib/components/layout/Header.svelte`;
- D1-логика мероприятий: `src/lib/server/db/events.ts`;
- типы мероприятий: `src/lib/types/event.ts`;
- R2-хранилище: `src/lib/server/storage/r2.ts`;
- загрузка постеров мероприятий: `src/routes/api/admin/events/[id]/poster/+server.ts`;
- переводы: `static/translations/de.json`, `en.json`, `ru.json`, `uk.json`;
- Tailwind/PostCSS: `tailwind.config.js`, `postcss.config.js`.

Активные мероприятия уже выбираются через `getActiveEvents(db)`.

Активное мероприятие:

- `events.status = 'active'`;
- дата окончания `end_date`, а если ее нет, `date`, находится в будущем.

## 3. Термины

`created_at` - техническая дата загрузки медиа в систему.

`captured_at` - дата, к которой относится медиа: дата съемки или дата мероприятия. Это поле нужно для корректной сортировки Rückblick. Например, если фото мартовского мероприятия загрузили в июне, по `created_at` оно будет июньским, а по `captured_at` останется мартовским.

Если `captured_at` не указано, система должна использовать дату связанного мероприятия `events.date` как fallback.

## 4. Хранение медиа

Файлы должны храниться в Cloudflare R2, так как проект уже использует R2 для QR-кодов и постеров.

В D1 должна храниться только метаинформация:

- связь с мероприятием;
- тип медиа;
- R2 object key;
- публичный URL;
- MIME type;
- размер;
- длительность для видео;
- размеры изображения/видео;
- флаги публикации;
- технические даты.

Рекомендуемые R2-префиксы:

- `event-media/{eventId}/{timestamp-or-uuid}.{ext}`;
- `event-media-thumbnails/{eventId}/{timestamp-or-uuid}.jpg`.

`event_id` обязателен. Общие медиа без привязки к мероприятию не допускаются.

При удалении мероприятия должны удаляться:

- связанные записи из `event_media`;
- связанные файлы из R2;
- связанные thumbnail-файлы из R2.

Для метаданных в D1 использовать `ON DELETE CASCADE`. Для физических файлов R2 нужна серверная логика в `deleteEvent(...)` или отдельном helper-е, потому что D1 cascade не удаляет R2-объекты автоматически.

## 5. Миграция БД

Создать новую миграцию, например:

`migrations/0009_create_event_media.sql`

Рекомендуемая структура:

```sql
CREATE TABLE IF NOT EXISTS event_media (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,

    media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video')),

    -- Base moderation/storage status.
    -- Public placement is controlled by flags below because one media item
    -- can be shown both on the homepage and on Rückblick.
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
    duration_seconds REAL,
    width INTEGER,
    height INTEGER,

    original_filename TEXT,
    alt_text TEXT,
    captured_at TEXT,

    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,

    CHECK (
        (media_type = 'image' AND size_bytes <= 3145728)
        OR
        (media_type = 'video' AND size_bytes <= 31457280 AND duration_seconds IS NOT NULL AND duration_seconds <= 10)
    )
);

CREATE INDEX IF NOT EXISTS idx_event_media_event_id
    ON event_media(event_id);

CREATE INDEX IF NOT EXISTS idx_event_media_homepage_created
    ON event_media(show_on_homepage, status, created_at);

CREATE INDEX IF NOT EXISTS idx_event_media_rueckblick_captured
    ON event_media(show_on_rueckblick, status, captured_at);

CREATE INDEX IF NOT EXISTS idx_event_media_type
    ON event_media(media_type);
```

Эффективные пользовательские статусы в UI:

- `Uploaded`: `status = 'uploaded'`, оба флага публикации равны `0`;
- `Homepage`: `show_on_homepage = 1`;
- `Rückblick`: `show_on_rueckblick = 1`;
- `Hidden`: `status = 'hidden'`;
- если `show_on_homepage = 1` и `show_on_rueckblick = 1`, показывать оба бейджа.

## 6. Серверная логика

Добавить новый DB-модуль:

`src/lib/server/db/eventMedia.ts`

Минимальные функции:

- `getHomepageMedia(db, limit?)`;
- `getRueckblickMedia(db, filters)`;
- `getRueckblickEvents(db)`;
- `getEventMediaObjectKeys(db, eventId)`;
- в будущем: `createEventMedia(...)`, `updateEventMediaVisibility(...)`, `deleteEventMedia(...)`.

Добавить типы:

`src/lib/types/eventMedia.ts`

Минимальные типы:

- `EventMedia`;
- `EventMediaType = 'image' | 'video'`;
- `EventMediaStatus = 'uploaded' | 'hidden'`;
- `PublicEventMedia`;
- `RueckblickMediaFilters`.

Подключить новый модуль в `src/lib/server/db/index.ts`.

## 7. Главная страница

Файл: `src/routes/+page.server.ts`

Поведение:

1. Загрузить активные мероприятия через существующий `getActiveEvents(db)`.
2. Если активные мероприятия есть, вернуть их как сейчас.
3. Если активных мероприятий нет, загрузить медиа для коллажа:
   - `show_on_homepage = 1`;
   - `status != 'hidden'`;
   - фото: `media_type = 'image'` и `size_bytes <= 3 MB`;
   - видео: `media_type = 'video'`, `size_bytes <= 30 MB`, `duration_seconds <= 10`;
   - сортировка: наиболее новые отобранные первыми, то есть `created_at DESC`.

Файл: `src/routes/+page.svelte`

Поведение:

- если `data.events.length > 0`, показывать текущую сетку `EventCard`;
- если `data.events.length === 0` и есть media для главной, показывать коллаж;
- если `data.events.length === 0` и media нет или медиа не удалось загрузить, показывать информативное сообщение на английском:

`We are preparing new events and media highlights. Please check back soon.`

Страница не должна падать при ошибке загрузки медиа.

## 8. Компонент коллажа

Создать компонент:

`src/lib/components/media/HomepageMediaCollage.svelte`

Внешний вид:

- адаптивный mobile-first layout;
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
- при количестве медиа меньше 3 показывать доступное количество без поломки layout.

Видео:

- autoplay запрещен;
- видео не должно загружаться и проигрываться автоматически;
- поверх preview показывается кастомная play-кнопка;
- при клике пользователя видео начинает проигрываться;
- если thumbnail отсутствует, показывается fallback-плитка с play-кнопкой;
- отсутствие thumbnail не блокирует запуск видео;
- при переключении стрелками активное видео должно останавливаться.

## 9. Публичная вкладка Rückblick

Добавить пункт меню в `Header.svelte`:

- label: `Rückblick`;
- URL: `/rueckblick`;
- расположение: правее `Bewertungen` / `/reviews`.

Добавить переводы для `nav.rueckblick`.

Создать маршрут:

- `src/routes/rueckblick/+page.server.ts`;
- `src/routes/rueckblick/+page.svelte`.

Публичная страница `/rueckblick` должна показывать только публичные медиа:

- `show_on_rueckblick = 1`;
- `status != 'hidden'`.

Важно: скрытые или просто загруженные, но не опубликованные в Rückblick медиа не должны отображаться публичным пользователям.

Фильтры:

- мероприятие (`event_id`);
- дата от;
- дата до.

Сортировка:

- newest first;
- oldest first.

Дата сортировки:

- `COALESCE(event_media.captured_at, events.date)`;
- если обе даты отсутствуют или невалидны, fallback на `event_media.created_at`.

Страница должна использовать пагинацию или ограниченную загрузку, чтобы не загружать большое количество видео сразу.

## 10. Будущий этап: админка медиа

Отдельным будущим этапом разработать административный инструментарий:

- новая админская страница, например `/admin/media`;
- загрузка фото/видео;
- удаление фото/видео;
- привязка медиа к мероприятию;
- управление флагами:
  - показывать на главной;
  - показывать в Rückblick;
  - скрыть;
- отображение статусов/бейджей;
- фильтрация по мероприятию, дате, типу медиа и статусу;
- сортировка;
- предпросмотр;
- удаление R2-файла вместе с D1-записью.

Клиентская проверка при загрузке:

- фото больше 3 MB отклонять до отправки;
- видео больше 30 MB отклонять до отправки;
- видео длительностью больше 10 секунд отклонять до отправки;
- длительность проверять на клиенте через временный object URL и metadata видео;
- показывать понятное сообщение об ошибке.

Первая реализация не должна включать клиентскую обрезку и перекодирование в H.265.

Причина: браузерная обработка через `ffmpeg.wasm` слишком тяжелая для первого этапа, увеличивает bundle, может зависать на слабых устройствах и не гарантирует надежную поддержку H.265.

## 11. Edge-кейсы

Нет активных мероприятий и есть homepage media:

- показывается коллаж.

Нет активных мероприятий и нет homepage media:

- показывается сообщение:
  `We are preparing new events and media highlights. Please check back soon.`

БД недоступна:

- страница не падает;
- пользователь видит понятное сообщение;
- ошибка логируется на сервере.

R2-файл недоступен, но запись есть в БД:

- вся страница не падает;
- конкретный элемент показывает fallback или пропускается;
- ошибка не блокирует остальные медиа.

Видео без thumbnail:

- показывается fallback-плитка с play-кнопкой;
- видео запускается только после клика пользователя.

Видео проигрывается, пользователь нажимает стрелку:

- видео останавливается;
- новый видимый набор медиа не должен содержать продолжающий играть скрытый элемент.

Медиа меньше, чем нужно для 3 карточек:

- показывать доступные элементы;
- стрелки скрыть или сделать disabled, если переключать нечего.

Одно медиа опубликовано и на главной, и в Rückblick:

- это допустимо;
- в админском UI в будущем показывать оба бейджа.

Мероприятие удаляется:

- D1-записи `event_media` удаляются через `ON DELETE CASCADE`;
- R2-файлы удаляются серверной логикой до или во время удаления мероприятия;
- если R2-удаление частично не удалось, ошибка логируется.

Невалидные query-параметры `/rueckblick`:

- использовать безопасные значения по умолчанию;
- не отдавать 500 из-за некорректного `event_id`, `dateFrom`, `dateTo` или `sort`.

Большая медиатека:

- использовать pagination/limit;
- не рендерить и не загружать все видео сразу.

## 12. Критерии готовности

Главная страница:

- если есть активные мероприятия, отображаются карточки мероприятий;
- если активных мероприятий нет, отображается медиа-коллаж;
- если активных мероприятий нет и медиа нет, отображается понятное сообщение;
- видео не проигрывается автоматически;
- видео запускается только после клика пользователя;
- переключение стрелками сдвигает коллаж на 1 элемент;
- layout адаптируется: 1 / 2 / 3 элемента;
- страница не зависает.

Rückblick:

- вкладка `Rückblick` добавлена правее `Bewertungen`;
- URL `/rueckblick` доступен публично;
- отображаются только медиа, опубликованные для Rückblick;
- работают фильтры по датам и мероприятиям;
- работает сортировка по датам;
- скрытые медиа публично не отображаются.

База данных:

- миграция создает `event_media`;
- `event_id` обязателен;
- связь с `events` использует `ON DELETE CASCADE`;
- одно медиа может быть одновременно опубликовано на главной и в Rückblick;
- ограничения размера и длительности отражены в схеме и серверной логике.

Проверки:

- проект проходит `npm run check`;
- проект проходит сборку;
- публичные страницы не падают при пустых данных.
