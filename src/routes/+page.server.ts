/**
 * Server-side загрузка данных для главной страницы
 *
 * Загружает активные мероприятия с подсчётом статистики:
 * - Количество записей
 * - Оставшиеся места
 * - Истёк ли дедлайн
 * - Записан ли текущий пользователь (если авторизован)
 */

import { getActiveEvents } from '$lib/server/db/events';
import { getRegistrationCount, isUserRegistered } from '$lib/server/db/registrations';
import { getLatestApprovedReviews } from '$lib/server/db/reviews';
import { DB } from '$lib/server/db';
import { extractTokenFromRequest, verifyToken } from '$lib/server/auth';
import type { Event } from '$lib/types/event';
import type { PublicEventMedia } from '$lib/types/eventMedia';
import type { PublicReview } from '$lib/types/review';

/**
 * Расширенная информация о мероприятии для главной страницы
 */
export interface EventWithStats extends Event {
	/** Количество зарегистрированных участников */
	registeredCount: number;
	/** Оставшиеся места */
	spotsLeft: number;
	/** Истёк ли дедлайн регистрации */
	isDeadlinePassed: boolean;
	/** Записан ли текущий пользователь (только для авторизованных) */
	isUserRegistered?: boolean;
}

export const load = async ({ platform, request }: { platform: any; request: Request }) => {
	try {
		// Получаем D1 базу данных и JWT secret из platform
		const db = platform?.env?.DB;
		const jwtSecret = platform?.env?.JWT_SECRET;

		if (!db) {
			throw new Error('Database not available');
		}

		// Получаем активные мероприятия
		const activeEvents = await getActiveEvents(db);

		// Получаем ID пользователя через JWT токен из cookies
		let userId: number | undefined;

		if (jwtSecret) {
			const token = extractTokenFromRequest(request);
			if (token) {
				const payload = await verifyToken(token, jwtSecret);
				if (payload) {
					userId = payload.userId;
				}
			}
		}

		// Текущее время для проверки дедлайна
		const now = new Date();

		// Обогащаем каждое мероприятие статистикой
		const eventsWithStats: EventWithStats[] = await Promise.all(
			activeEvents.map(async (event) => {
				// Получаем количество записей
				const registeredCount = await getRegistrationCount(db, event.id);

				// Вычисляем оставшиеся места (null = безлимит)
				const spotsLeft =
					event.max_participants !== null
						? event.max_participants - registeredCount
						: Infinity;

				// Проверяем истёк ли дедлайн
				const deadline = new Date(event.registration_deadline);
				const isDeadlinePassed = now > deadline;

				// Базовый объект со статистикой
				const eventWithStats: EventWithStats = {
					...event,
					registeredCount,
					spotsLeft,
					isDeadlinePassed,
				};

				// Если пользователь авторизован - проверяем записан ли он
				if (userId) {
					const isRegistered = await isUserRegistered(db, userId, event.id);
					eventWithStats.isUserRegistered = isRegistered;
				}

				return eventWithStats;
			})
		);

		// Загружаем последние одобренные отзывы (до 5)
		let latestReviews: PublicReview[] = [];
		try {
			latestReviews = await getLatestApprovedReviews(db, 5);
		} catch (reviewsError) {
			console.error('Error loading latest reviews:', reviewsError);
			// Продолжаем работу даже если отзывы не загрузились
		}

		let homepageMedia: PublicEventMedia[] = [];
		if (eventsWithStats.length === 0) {
			try {
				homepageMedia = await DB.eventMedia.getHomepageMedia(db);
			} catch (mediaError) {
				console.error('Error loading homepage media:', mediaError);
				// Продолжаем работу: UI сможет показать fallback-сообщение
			}
		}

		return {
			events: eventsWithStats,
			homepageMedia,
			latestReviews,
		};
	} catch (error) {
		console.error('Error loading homepage data:', error);

		// Возвращаем пустой массив в случае ошибки
		// SvelteKit автоматически обработает это в +page.svelte
		return {
			events: [],
			homepageMedia: [],
			latestReviews: [],
		};
	}
};
