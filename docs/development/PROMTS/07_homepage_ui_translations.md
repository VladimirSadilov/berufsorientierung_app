# Промпт 07: UI главной страницы и переводы fallback-сообщения

Ты работаешь в проекте `berufsorientierung_app`. Подключи коллаж к главной странице и добавь локализованное fallback-сообщение.

Промпт должен быть исполним отдельной последовательной сессией: если сервер уже возвращает `homepageMedia`, используй это; если поле отсутствует из-за незавершенного предыдущего этапа, не ломай UI и явно отметь проблему в отчете.

## Сбор контекста

1. Перейди в корень проекта `berufsorientierung_app`.
2. Прочитай разделы ТЗ: 10, 11, 15 и критерии "Главная страница" из 16.
3. Осмотри файлы:
   - `src/routes/+page.svelte`;
   - `src/routes/+page.server.ts`;
   - `src/lib/components/media/HomepageMediaCollage.svelte`;
   - `src/lib/components/events/EventCard.svelte`;
   - `src/lib/stores/language.ts`;
   - `static/translations/de.json`;
   - `static/translations/en.json`;
   - `static/translations/ru.json`;
   - `static/translations/uk.json`.
4. Изучи текущий способ получения переводов на страницах через `rg "translations|t\\(" src/routes src/lib`.

## Задача

Обнови `src/routes/+page.svelte`:

- если `data.events.length > 0`, показывай текущую сетку `EventCard`;
- если `data.events.length === 0` и `data.homepageMedia.length > 0`, показывай `HomepageMediaCollage`;
- если `data.events.length === 0` и media нет, показывай информативное локализованное сообщение.
- обнови тип `data`, чтобы он включал `homepageMedia: PublicEventMedia[]`;
- в Svelte-коде используй безопасный derived/default, например `let homepageMedia = $derived(data.homepageMedia ?? [])`, чтобы временное отсутствие поля не приводило к runtime-ошибке;
- если `HomepageMediaCollage.svelte` отсутствует, не реализуй весь компонент в этом промпте; создай только явный отчет о блокере или минимальную компиляционную заглушку с тем же prop, если это необходимо для `npm run check`.

Добавь переводы в `de.json`, `en.json`, `ru.json`, `uk.json`.

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

Английский fallback message должен быть ровно:

`We are preparing new events and media highlights. Please check back soon.`

## Ограничения

- Не меняй серверную выборку media, кроме минимальной правки типов, если UI не компилируется.
- Не показывай коллаж, если есть активные мероприятия.
- Не удаляй текущий блок отзывов или другое содержимое главной страницы.
- Не реализуй `/rueckblick` в этом промпте.

## Проверка

1. Запусти `npm run check`.
2. Проверь, что все четыре JSON-файла остаются валидным JSON.
3. Проверь кодом три состояния:
   - есть events -> EventCard;
   - нет events, есть homepageMedia -> HomepageMediaCollage;
   - нет events и media -> fallback-сообщение.

## Критерии приемки

- Главная страница использует `HomepageMediaCollage`, когда активных мероприятий нет и media есть.
- При активных мероприятиях коллаж не отображается.
- При отсутствии мероприятий и media отображается локализованное fallback-сообщение.
- Английская fallback-строка соответствует ТЗ.
- Существующие блоки главной страницы не удалены.
- Проект проходит `npm run check` или причина невозможности проверки описана в отчете.
