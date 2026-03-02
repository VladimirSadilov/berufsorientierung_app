# ТЗ: Исправление регистрации и логина

**Дата:** 2026-02-27
**Статус:** Верифицировано (частично) — ожидает старта реализации

---

## Контекст

При регистрации и логине пользователи сталкиваются с тремя классами проблем:

1. Токен Turnstile истекает и не обновляется → форма падает с ошибкой "токен истёк"
2. Ошибки валидации (пароль, телефон) непонятны пользователю: нет визуальной индикации, нет подсказок о формате
3. Требование к паролю (буквы + цифры) избыточное и неожиданное для пользователя

---

## Задача 1: Turnstile — надёжный сброс токена

### 1а. Автоматическое обновление при истечении (пока заполняют форму)

**Файл:** `src/lib/components/security/Turnstile.svelte`

В функции `renderWidget()` добавить в объект `options` два callback:

```js
options['expired-callback'] = () => {
    // Токен истёк пока пользователь заполнял форму → сбрасываем автоматически
    if (widgetId !== undefined && window.turnstile) {
        window.turnstile.reset(widgetId);
    }
};
options['error-callback'] = () => {
    // Ошибка Turnstile (сеть и т.п.) → пробуем сбросить
    if (widgetId !== undefined && window.turnstile) {
        window.turnstile.reset(widgetId);
    }
};
```

### 1б. Сброс токена после ошибки сервера на странице логина

**Файл:** `src/routes/login/+page.svelte`

Текущее состояние: на Turnstile компоненте нет `bind:this`, поэтому после ошибки сервера токен не сбрасывается.

Что нужно сделать:
- Добавить `let turnstileComponent: any;`
- Добавить `bind:this={turnstileComponent}` на `<Turnstile>` компонент
- В блоке `if (!response.ok)` добавить вызов `turnstileComponent?.reset()` — аналогично тому, как это уже реализовано на странице регистрации

---

## Задача 2: Пароль — упрощение требований + предупреждение о слабом пароле

### 2а. Убрать обязательное требование буквы + цифры

**Файлы:**
- `src/lib/validation/schemas.ts` (клиентская схема)
- `src/lib/server/validation/schemas.ts` (серверная схема)

В `passwordSchema` в **обоих** файлах убрать строки:

```js
.refine(hasLettersAndNumbers, {
    message: 'validation.passwordComplexity', // (клиент)
    // или: message: 'Password must contain both letters and numbers' (сервер)
})
```

Оставить только:
```js
.min(8, { message: 'validation.passwordMinLength' })
```

Функцию `hasLettersAndNumbers` можно удалить — после удаления `.refine(hasLettersAndNumbers, ...)` она больше не используется.

### 2б. Нетвёрдое предупреждение о слабом пароле (не блокирует отправку)

**Файл:** `src/routes/register/+page.svelte`

Добавить реактивную переменную `passwordWeakWarning: string = ''` — текст предупреждения (пустая строка = предупреждения нет).

Логика слабого пароля (проверяется **только на blur**, НЕ при сабмите, НЕ блокирует форму):

```js
const WEAK_PATTERNS = [
    /^\d+$/,           // только цифры: 12345678
    /^[a-z]+$/i,       // только буквы: qwertyui
    /^(qwerty|password|12345678|87654321|abcdefgh|aaaaaaaa)/i,  // очевидные
];

function isWeakPassword(password: string): boolean {
    if (password.length < 8) return false; // уже ошибка, не предупреждение
    return WEAK_PATTERNS.some(p => p.test(password));
}
```

**Поведение поля пароля после blur:**

| Состояние | Цвет рамки | Текст под полем |
|---|---|---|
| Пустое / не тронуто | обычный (серый) | — |
| Менее 8 символов | красный | i18n: `validation.passwordMinLength` (ошибка) |
| ≥8 символов, слабый | жёлто-оранжевый (`border-yellow-500`) | i18n: `validation.passwordWeak` (предупреждение, не ошибка) |
| ≥8 символов, нормальный | зелёный (`border-green-500`) | — |
| Поля пароля совпадают (password_confirm) | зелёный | — |
| Поля пароля НЕ совпадают | красный | i18n: `validation.passwordMismatch` |

Индикатор — **только цвет рамки** (border) поля, без доп. иконок или прогресс-баров.

### 2в. Новые i18n-ключи для пароля

Добавить в файлы переводов (`static/translations/*.json`) в секцию `validation`:

```json
"passwordWeak": "..."
```

| Язык | Текст |
|---|---|
| de | "Dieses Passwort ist sehr einfach. Wir empfehlen ein sichereres Passwort." |
| en | "This password is too simple. We recommend using a stronger password." |
| ru | "Этот пароль очень простой. Рекомендуем использовать более надёжный." |
| uk | "Цей пароль дуже простий. Рекомендуємо використовувати надійніший." |

---

## Задача 3: Телефон — подсказка о формате + визуальная индикация

**Файл:** `src/routes/register/+page.svelte`

### 3а. Статичная подсказка под полями phone и whatsapp

Добавить серый текст-хинт под полями `phone` и `whatsapp`:

i18n-ключ: `form.phoneHint`

| Язык | Текст |
|---|---|
| de | "Format: +49 123 456789 oder +380 XX XXX XXXX" |
| en | "Format: +49 123 456789 or +380 XX XXX XXXX" |
| ru | "Формат: +49 123 456789 или +380 XX XXX XXXX" |
| uk | "Формат: +49 123 456789 або +380 XX XXX XXXX" |

### 3б. Цвет рамки полей phone и whatsapp на blur

Аналогично паролю — только цвет рамки:

| Состояние | Цвет рамки |
|---|---|
| Не тронуто | обычный |
| Формат верный | зелёный |
| Формат неверный | красный + текст ошибки |

Проверка — через уже импортированную на странице `userRegistrationSchema` из `$lib/validation/schemas`:
- `userRegistrationSchema.shape.phone.safeParse(value).success` для `phone`
- `userRegistrationSchema.shape.whatsapp.safeParse(value).success` для `whatsapp`

---

## Задача 4: Исправить отображение серверных ошибок валидации

**Файл:** `src/routes/register/+page.svelte`

### Проблема

Сервер возвращает ошибки валидации в формате:
```json
{
    "error": "Validation failed",
    "code": "BAD_REQUEST",
    "details": {
        "errors": [
            { "field": "password", "message": "validation.passwordComplexity" },
            { "field": "phone", "message": "validation.phoneInvalid" }
        ]
    }
}
```

Клиент ищет `result.errors` (Array) — его нет. Падает на `result.error = "Validation failed"` или, в крайнем случае, на сырой ZodError.message (JSON-строка).

### Исправление

В `handleSubmit`, в блоке `if (!response.ok)`:

```js
// Ищем errors в двух местах: result.errors (старый формат) и result.details?.errors (новый)
const serverErrors = result.errors ?? result.details?.errors;

if (serverErrors && Array.isArray(serverErrors)) {
    serverErrors.forEach((err: any) => {
        if (err.field && err.message) {
            if (typeof err.message === 'string') {
                errors[err.field] = $_(err.message, { default: err.message });
            } else {
                const currentLang = $locale as 'de' | 'en' | 'ru' | 'uk';
                errors[err.field] = err.message[currentLang] || err.message.de || String(err.message);
            }
        }
    });
    errors = errors;
} else if (result.error) {
    errorMessage = result.error;
} else {
    errorMessage = $_('auth.registerError', { default: 'Registration failed' });
}
```

---

## Задача 0 (подготовительная): Доработать FormField компонент

**Файл:** `src/lib/components/ui/FormField.svelte`

Текущее состояние: компонент поддерживает только `error` (красный) и нейтральный серый.
Нет `warning` (жёлтый) и `success` (зелёный) состояний — они нужны для задач 2 и 3.

Что добавить:
- Проп `warning: string = ''` — жёлто-оранжевая рамка + жёлтый текст предупреждения под полем
- Проп `success: boolean = false` — зелёная рамка (без текста)
- Приоритет: `error` > `warning` > `success` > нейтральный

Изменения в стилях:
```js
$: inputClasses = error
    ? `${baseInputClasses} border-red-500 focus:ring-red-500 focus:border-red-500`
    : warning
    ? `${baseInputClasses} border-yellow-500 focus:ring-yellow-500 focus:border-yellow-500`
    : success
    ? `${baseInputClasses} border-green-500 focus:ring-green-500 focus:border-green-500`
    : `${baseInputClasses} border-gray-300 focus:ring-blue-500 focus:border-blue-500`;
```

---

## Файлы к изменению (итого)

| Файл | Задачи |
|---|---|
| `src/lib/components/ui/FormField.svelte` | 0 (подготовительная) |
| `src/lib/components/security/Turnstile.svelte` | 1а |
| `src/routes/login/+page.svelte` | 1б |
| `src/routes/register/+page.svelte` | 2б, 3а, 3б, 4 |
| `src/lib/validation/schemas.ts` | 2а |
| `src/lib/server/validation/schemas.ts` | 2а |
| `static/translations/de.json` | 2в, 3а |
| `static/translations/en.json` | 2в, 3а |
| `static/translations/ru.json` | 2в, 3а |
| `static/translations/uk.json` | 2в, 3а |

---

## Что НЕ входит в ТЗ

- Изменение серверного формата ошибок (только клиент адаптируется под текущий формат)
- Страница `profile/+page.svelte` — аналогичные поля там не трогаем (отдельный задача)
- reset-password, forgot-password — не трогаем

---

## Решённые вопросы

1. **Слабые пароли:** список `WEAK_PATTERNS` достаточен. ✅
2. **FormField компонент:** не поддерживает `warning`/`success` — добавляется в задаче 0. ✅
3. **Страница логина:** задачи 2 и 3 касаются **только регистрации**. Задача 1б (Turnstile reset) на логине остаётся, т.к. первый скрин с ошибкой токена — именно со страницы логина. ✅
