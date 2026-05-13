# Reviews Database Module

Модуль: `src/lib/server/db/reviews.ts`

Назначение: работа с отзывами участников и публичными ссылками для сбора отзывов.

## Таблицы

Создаются миграцией `migrations/0006_add_reviews.sql`:

- `review_public_links` - публичные ссылки для сбора отзывов по мероприятию.
- `reviews` - сами отзывы, их рейтинг, комментарий, статус модерации и связь с пользователем/мероприятием.

Связанные типы:

- `src/lib/types/review.ts`
- `src/lib/types/event.ts`
- `src/lib/types/user.ts`

## Основные сценарии

### Публичные ссылки

Используются для формы `/reviews/public/[token]`.

Ключевые функции:

- `createReviewPublicLink`
- `getPublicLinkByToken`
- `revokePublicLink`
- `getPublicLinksForEvent`

### Отзывы авторизованных пользователей

Используются для `/events/[id]/review` и проверки права пользователя оставить отзыв после участия.

Ключевые функции:

- `createUserReview`
- `getUserReviewForEvent`
- `getUserReviewsByEventIds`
- `canUserReviewEvent`
- `getReviewWindow`
- `isNowWithinWindow`

### Публичные отзывы

Используются для публичной страницы `/reviews` и блока последних отзывов на главной странице.

Ключевые функции:

- `createPublicReview`
- `getLatestApprovedReviews`
- `getApprovedReviews`

### Модерация

Используется в админ-панели `/admin/reviews` и API `src/routes/api/admin/reviews/`.

Ключевые функции:

- `listReviewsForAdmin`
- `getReviewById`
- `moderateReviews`
- `getEventReviewStats`

## Связанные маршруты

- `src/routes/reviews/+page.server.ts`
- `src/routes/reviews/+page.svelte`
- `src/routes/reviews/public/[token]/+page.server.ts`
- `src/routes/reviews/public/[token]/+page.svelte`
- `src/routes/events/[id]/review/+page.server.ts`
- `src/routes/events/[id]/review/+page.svelte`
- `src/routes/api/reviews/create/+server.ts`
- `src/routes/api/reviews/public/+server.ts`
- `src/routes/admin/reviews/+page.server.ts`
- `src/routes/admin/reviews/+page.svelte`
- `src/routes/api/admin/reviews/approve/+server.ts`
- `src/routes/api/admin/reviews/reject/+server.ts`
- `src/routes/api/admin/reviews/links/create/+server.ts`

## Где искать UI

- Публичная лента: `src/routes/reviews/+page.svelte`
- Форма публичного отзыва: `src/routes/reviews/public/[token]/+page.svelte`
- Форма отзыва пользователя по мероприятию: `src/routes/events/[id]/review/+page.svelte`
- Модерация: `src/routes/admin/reviews/+page.svelte`
- Рейтинг: `src/lib/components/ui/StarRating.svelte`

## Тесты

- `tests/unit/db-reviews.test.ts`

