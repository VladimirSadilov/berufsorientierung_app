# Промпт 08: серверный маршрут /rueckblick и безопасные query-параметры

Ты работаешь в проекте `berufsorientierung_app`. Создай серверную часть публичной страницы `/rueckblick`.

Промпт должен быть исполним в отдельной последовательной сессии: если route или DB-functions уже частично существуют, сначала проверь их и исправь только несоответствия.

## Сбор контекста

1. Перейди в корень проекта `berufsorientierung_app`.
2. Прочитай разделы ТЗ: 8.3, 8.4, 12.1, 12.2, 12.3, 15 и критерии "Rückblick" из 16.
3. Осмотри файлы:
   - `src/routes/events/+page.server.ts`;
   - `src/routes/reviews/+page.server.ts`;
   - `src/lib/server/db/eventMedia.ts`;
   - `src/lib/server/db/index.ts`;
   - `src/lib/types/eventMedia.ts`.
4. Если DB-функции `getRueckblickMedia` и `getRueckblickEvents` отсутствуют, реализуй их по разделам 8.3 и 8.4 до создания route server.

## Задача

Создай `src/routes/rueckblick/+page.server.ts`.

Серверная страница должна:

- читать query-параметры `eventId`, `dateFrom`, `dateTo`, `sort`, `page`;
- принимать только положительный целый `eventId`;
- принимать даты только в формате `YYYY-MM-DD` и проверять, что дата реально валидна (regex + Date roundtrip, чтобы `2026-99-99` не проходила);
- принимать `sort` только `newest` или `oldest`;
- использовать безопасные значения по умолчанию:
  - `sort = 'newest'`;
  - `page = 1`;
  - `limit = 24`;
- не отдавать 500 из-за невалидных query-параметров;
- если `dateFrom > dateTo`, либо поменять даты местами, либо игнорировать обе даты;
- вычислять `offset = (page - 1) * limit`;
- вызывать `DB.eventMedia.getRueckblickMedia(db, filters)`;
- вызывать `DB.eventMedia.getRueckblickEvents(db)`;
- возвращать:
  - `items`;
  - `events`;
  - `filters`;
  - `total`;
  - `page`;
  - `limit`;
  - `totalPages`;
  - `hasMore`.
- экспортировать тип данных страницы, например `export interface RueckblickPageData { ... }`, чтобы `+page.svelte` из следующего промпта мог типизироваться без гадания;
- в `filters` возвращать нормализованные значения, которые UI должен сохранить в форме: `eventId`, `dateFrom`, `dateTo`, `sort`.

При недоступной БД или ошибке запроса:

- залогируй ошибку;
- верни пустой результат с безопасными значениями;
- не ломай публичную страницу.

## Ограничения

- Не создавай полноценный UI в этом промпте.
- Если SvelteKit/`npm run check` требует sibling `+page.svelte` для `+page.server.ts`, создай минимальный временный `src/routes/rueckblick/+page.svelte`, который только принимает `data` и выводит простой заголовок/пустой контейнер. Явно пометь в комментарии файла, что полноценный UI будет реализован промптом 09.
- Не добавляй пункт меню.
- Не меняй главную страницу.
- Публичная выборка должна использовать `show_on_rueckblick = 1`, `status = 'uploaded'` и `publication_approved_at IS NOT NULL` на уровне DB-helper-а.

## Проверка

1. Запусти `npm run check`.
2. Проверь ручным чтением кода, что невалидные параметры не приводят к `throw error(500)`.
3. Проверь, что `limit` равен 24 и не превышает 60 на уровне DB-функции.

## Критерии приемки

- `src/routes/rueckblick/+page.server.ts` создан.
- Query-параметры валидируются и нормализуются безопасно.
- Возвращаются `totalPages` и `hasMore`.
- При выбранном `eventId` general-media не попадут в результат через DB-функцию.
- Ошибка БД не ломает публичную страницу.
- Проект проходит `npm run check` или причина невозможности проверки описана в отчете.
