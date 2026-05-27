# Промпт 04: безопасное удаление мероприятий и R2-файлов event media

Ты работаешь в проекте `berufsorientierung_app`. Исправь процедуру hard-delete мероприятий с учетом `event_media` и любых регистраций.

Промпт должен быть исполним после предыдущих этапов или после частичной попытки: сначала проверь, есть ли `DB.eventMedia.getEventMediaObjectKeys`, и добавь только недостающий минимум, не переписывая весь DB-модуль.

## Сбор контекста

1. Перейди в корень проекта `berufsorientierung_app`.
2. Прочитай разделы ТЗ: 8.5, 13, 15 и критерии "Удаление мероприятий" из 16.
3. Осмотри файлы:
   - `src/routes/api/admin/events/delete/+server.ts`;
   - `src/lib/server/db/events.ts`;
   - `src/lib/server/db/registrations.ts`;
   - `src/lib/server/db/eventMedia.ts`, если он уже есть;
   - `src/lib/server/storage/r2.ts`;
   - `src/lib/server/storage/index.ts`;
   - `src/routes/api/admin/events/[id]/poster/+server.ts`.
4. Найди текущие helpers удаления R2 через `rg "delete.*R2|deleteObject|R2_BUCKET|poster|qr" src/lib src/routes/api`.

## Задача

Обнови endpoint `src/routes/api/admin/events/delete/+server.ts`. Можно также аккуратно расширить helper `deleteEvent` в `src/lib/server/db/events.ts`, если это лучше соответствует текущему коду, но итоговый flow должен быть единым и читаемым: собрать ключи до удаления, best-effort удалить R2, затем удалить запись из `events`.

Требуемая процедура hard-delete из раздела 13:

1. Проверить, что мероприятие существует.
2. Проверить, что нет регистраций вообще:
   `SELECT COUNT(*) FROM registrations WHERE event_id = ?`.
3. Если `count > 0`, запретить hard-delete. Важно: блокировать не только активные регистрации, а любые регистрации.
4. До `DELETE FROM events` собрать:
   - существующие QR/poster URL или ключи мероприятия по текущей логике проекта;
   - `object_key` и `thumbnail_object_key` через `getEventMediaObjectKeys(db, eventId)`.
5. Удалить R2-файлы best-effort через существующие helpers или через `Promise.allSettled`.
6. Неуспешные удаления R2 залогировать по конкретным ключам/URL, но не ломать весь endpoint, если БД-удаление допустимо.
7. Выполнить `DELETE FROM events WHERE id = ?`.
8. Залогировать итоговое действие текущим способом проекта.

Если `src/lib/server/db/eventMedia.ts` отсутствует или в нем нет `getEventMediaObjectKeys`, добавь минимальную реализацию этой функции и экспорт `DB.eventMedia`, не реализуя весь медиа-модуль заново.

Для мероприятия с регистрациями не делай hard-delete. В этом endpoint не запускай отмену мероприятия автоматически: для отмены нужны отдельный сценарий, причина и уведомления. Верни понятную ошибку для оператора и не удаляй данные.

## Ограничения

- Не добавляй новую миграцию soft-delete, если ее нет в ТЗ текущего этапа.
- Не удаляй записи `event_media` вручную перед `DELETE FROM events`: их удаляет `ON DELETE CASCADE`.
- Не пытайся удалить R2-файлы после `DELETE FROM events`, потому что ключи уже будут потеряны через cascade.
- Не реализуй админку медиа из раздела 14.
- Не оставляй ситуацию, где QR/poster удаляются одним helper-ом, а event-media вообще не удаляются. Если текущий `deleteEvent` уже удаляет QR/poster, либо расширь его event-media ключами, либо удали event-media ключи в endpoint до вызова `deleteEvent`.

## Проверка

1. Запусти `npm run check`.
2. Проверь кодом, что SQL считает все регистрации без фильтра статуса.
3. Проверь кодом, что R2-ключи event-media собираются до удаления события.

## Критерии приемки

- Endpoint блокирует hard-delete при любых регистрациях.
- R2-ключи `event_media` собираются до `DELETE FROM events`.
- Связанные media-файлы и thumbnails удаляются best-effort.
- Ошибки частичного удаления R2 логируются.
- Cascade-delete D1 остается ответственным за строки `event_media`.
- Существующее удаление QR/poster не сломано.
- Проект проходит `npm run check` или причина невозможности проверки описана в отчете.
