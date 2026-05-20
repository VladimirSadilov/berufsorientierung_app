# Архитектура проекта

Этот файл является короткой картой проекта для разработчиков и Codex. Для исторических деталей, changelog и troubleshooting см. профильные документы из `docs/`.

## 1. Быстрая навигация по коду

| Если нужно изменить | Сначала смотреть |
| --- | --- |
| Главная страница | `src/routes/+page.server.ts`, `src/routes/+page.svelte` |
| Публичный список мероприятий | `src/routes/events/+page.server.ts`, `src/routes/events/+page.svelte`, `src/lib/components/events/` |
| Регистрация на мероприятие | `src/routes/events/[id]/register/`, `src/routes/api/events/register/+server.ts`, `src/lib/server/db/registrations.ts` |
| Отзывы | `src/routes/reviews/`, `src/routes/events/[id]/review/`, `src/routes/reviews/public/[token]/`, `src/lib/server/db/reviews.ts` |
| Авторизация | `src/routes/login/`, `src/routes/register/`, `src/routes/api/auth/`, `src/lib/server/auth/`, `src/lib/server/middleware/auth.ts` |
| Профиль пользователя | `src/routes/profile/`, `src/routes/api/profile/`, `src/lib/server/db/users.ts` |
| Админ-панель | `src/routes/admin/`, `src/lib/components/admin/`, `src/routes/api/admin/` |
| Email и рассылки | `src/lib/server/email/`, `src/routes/admin/newsletter/`, `src/routes/api/admin/newsletter/` |
| D1 database logic | `src/lib/server/db/`, `migrations/`, `docs/database/` |
| R2/файлы/QR/постеры | `src/lib/server/storage/`, `src/routes/api/admin/events/[id]/poster/+server.ts`, `docs/features/storage/` |
| i18n | `src/lib/stores/language.ts`, `static/translations/*.json`, `docs/features/i18n/` |
| CSRF/Turnstile/security | `src/hooks.server.ts`, `src/lib/server/middleware/csrf.ts`, `src/lib/server/middleware/turnstile.ts`, `docs/features/security/` |
| Cron/GDPR deletion | `src/worker.ts`, `scripts/inject-cron.js`, `src/routes/api/cron/delete-users/+server.ts`, `src/lib/server/db/gdpr.ts` |

## 2. Runtime и деплой

Проект - SvelteKit-приложение на TypeScript, деплоится как Cloudflare Worker через `@sveltejs/adapter-cloudflare`.

Ключевые файлы:

- `svelte.config.js` - Cloudflare adapter.
- `wrangler.toml` - Worker config, D1 binding `DB`, R2 binding `R2_BUCKET`, static assets, cron schedule.
- `src/app.d.ts` - типы `App.Platform.env`, `App.Locals`, `App.PageData`.
- `src/hooks.server.ts` - общий request hook: CSRF cookie для GET, извлечение пользователя из JWT, проверка admin-флага.
- `src/worker.ts` - Cloudflare scheduled handler для cron.
- `scripts/inject-cron.js` - post-build вставка `scheduled` export в `.svelte-kit/cloudflare/_worker.js`.

Сборка:

```bash
npm run build
```

Команда выполняет `vite build`, затем `scripts/inject-cron.js`.

Деплой:

```bash
npm run deploy
```

## 3. Верхнеуровневая структура

```text
src/
  routes/                 SvelteKit pages, layouts and API endpoints
  lib/
    components/           UI, layout, event and admin components
    server/
      auth/               password hashing, JWT, reset tokens
      db/                 D1 data access modules
      email/              templates and Workers-friendly sending
      middleware/         auth, admin, csrf, turnstile, API errors
      storage/            R2 helpers and QR generation
    stores/               Svelte stores for user and language
    types/                shared TypeScript types
    validation/           client/shared validation schemas
    utils/                small browser/shared utilities
static/
  translations/           de/en/ru/uk JSON dictionaries
  flags/                  language switcher flags
  image/, img/            public images currently used by UI
migrations/               D1 migration files, apply in numeric order
tests/
  unit/                   Vitest unit tests
  integration/            integration tests
docs/                     developer, feature and database docs
```

## 4. Public routes

| Route | Files | Notes |
| --- | --- | --- |
| `/` | `src/routes/+page.server.ts`, `src/routes/+page.svelte` | Hero, upcoming events, latest approved reviews. Upcoming events come from `getActiveEvents(db)`. |
| `/events` | `src/routes/events/+page.server.ts`, `src/routes/events/+page.svelte` | Upcoming and past listed events. Applies `is_listed` filtering locally. |
| `/events/[id]/register` | `src/routes/events/[id]/register/` | Event registration form. |
| `/events/[id]/review` | `src/routes/events/[id]/review/` | Authenticated review flow for eligible users. |
| `/reviews` | `src/routes/reviews/` | Public approved reviews with pagination. |
| `/reviews/public/[token]` | `src/routes/reviews/public/[token]/` | Public review form by review link token. |
| `/login`, `/register` | `src/routes/login/`, `src/routes/register/` | Auth pages. |
| `/forgot-password`, `/reset-password/[token]` | Password reset flow. |
| `/profile` | `src/routes/profile/` | User profile and account actions. |
| `/datenschutz`, `/privacy`, `/impressum` | Static legal pages. |
| `/demo-ui` | UI demo/dev page. |

## 5. API endpoints

Main endpoint groups:

- `src/routes/api/auth/` - register, login, logout, forgot/reset password.
- `src/routes/api/events/` - public/user registration and cancellation endpoints.
- `src/routes/api/reviews/` - authenticated and public review creation.
- `src/routes/api/profile/` - update and delete profile.
- `src/routes/api/cron/delete-users/+server.ts` - protected HTTP cron fallback.
- `src/routes/api/dev/test-email/+server.ts` - development email test endpoint.
- `src/routes/api/admin/` - admin-only APIs for events, users, registrations, reviews, newsletter, logs and cron trigger.

Admin APIs generally use `requireAdmin` from `src/lib/server/middleware/auth.ts` or related admin middleware. Mutating requests should use CSRF protection where applicable and validate input with Zod/server schemas.

## 6. Admin UI

Admin pages live under `src/routes/admin/`.

Navigation is defined in `src/routes/admin/+layout.svelte`:

- `/admin` - dashboard.
- `/admin/events` - event management.
- `/admin/users` - user management.
- `/admin/registrations` - registration management.
- `/admin/reviews` - review moderation and public links.
- `/admin/newsletter` - bulk email.
- `/admin/stats` - statistics.
- `/admin/logs` - activity logs.

Shared admin components live in `src/lib/components/admin/`.

## 7. Data layer

D1 access is organized by module in `src/lib/server/db/`:

- `users.ts` - users, profile updates, blocking, password reset fields.
- `events.ts` - events CRUD, active/past events, publish/cancel, registration status helpers.
- `eventFields.ts` - dynamic registration fields per event.
- `registrations.ts` - registrations, cancellations, counts, user/event registration lists.
- `reviews.ts` - review links, authenticated/public reviews, moderation, approved review lists.
- `admin.ts` - admin role management.
- `activityLog.ts` - admin/system activity log.
- `gdpr.ts` - deletion eligibility, archive, complete deletion, scheduled deletions.
- `index.ts` - grouped `DB` facade and `getDB(platform)`.

Migrations are in `migrations/` and must be applied in numeric order:

1. `0001_initial.sql`
2. `0002_make_max_participants_nullable.sql`
3. `0003_add_guardian_fields.sql`
4. `0004_add_password_reset_fields.sql`
5. `0005_add_event_end_date.sql`
6. `0006_add_reviews.sql`
7. `0007_add_event_poster_url.sql`
8. `0008_add_events_is_listed.sql`

## 8. Storage and static assets

R2:

- Binding name: `R2_BUCKET`.
- Public URL secret/env: `R2_PUBLIC_URL`.
- Helpers: `src/lib/server/storage/r2.ts`.
- QR generation: `src/lib/server/storage/qr.ts`.
- Event poster upload/delete: `src/routes/api/admin/events/[id]/poster/+server.ts`.

Static assets:

- Files in `static/` are publicly served from `/`.
- Translations are in `static/translations/{de,en,ru,uk}.json`.
- Language flags are in `static/flags/`.
- Current public image folders are `static/image/` and `static/img/`.

## 9. Authentication and request state

JWT auth uses httpOnly cookies. The request flow is:

1. `src/hooks.server.ts` runs for every request.
2. For GET requests it ensures a CSRF cookie and writes `event.locals.csrfToken`.
3. It reads JWT from cookies through `getUserFromRequest`.
4. If a user is found, it checks admin status and writes `event.locals.user`.
5. `src/routes/+layout.server.ts` loads the full user and locale for the app layout.
6. `src/routes/+layout.svelte` synchronizes server user data into the client user store.

Use these helpers:

- `src/lib/server/middleware/auth.ts` for route/API authorization.
- `src/lib/server/middleware/csrf.ts` for CSRF.
- `src/lib/server/middleware/turnstile.ts` for bot protection.
- `src/lib/server/auth/index.ts` for password/JWT/cookie primitives.

## 10. i18n

Supported languages: `de`, `en`, `ru`, `uk`.

Where to edit:

- Dictionaries: `static/translations/*.json`.
- Language store/init: `src/lib/stores/language.ts`.
- Language switcher UI: `src/lib/components/layout/LanguageSwitcher.svelte`.

When adding public UI text, add keys to all four translation files in the same object shape.

## 11. Tests and validation

Commands:

```bash
npm run check
npm test
npm run build
```

Test locations:

- `tests/unit/` - DB modules, auth, CSRF, validation, language.
- `tests/integration/` - registration and CSRF flows.
- `tests/setup.ts` - test setup.

Project-specific source check:

- `npm run check` executes `svelte-kit sync && node scripts/check-src.mjs`.

## 12. Documentation map

- `README.md` - project overview and common setup commands.
- `docs/README.md` - documentation index.
- `docs/ARCHITECTURE.md` - this architectural map.
- `docs/development/DEPLOYMENT.md` - production deployment, Cloudflare, secrets, cron.
- `docs/database/` - DB module docs.
- `docs/features/` - feature-level docs.
- `ADMIN_GUIDE.md` - admin-facing guide.

Prefer this file first when searching for the right code area. Use the detailed docs only after the relevant module is identified.

