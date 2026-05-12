/**
 * Admin Dashboard - Server Load
 * Загрузка статистики для главной страницы админ-панели
 */

import { getDB, DB } from '$lib/server/db';
import type { ActivityLogWithUser } from '$lib/types';

export interface DashboardStats {
	/** Общее количество пользователей в системе */
	totalUsers: number;

	/** Количество активных мероприятий (статус = 'active') */
	activeEvents: number;

	/** Количество предстоящих регистраций (мероприятия в будущем, не отменены) */
	upcomingRegistrations: number;

	/** Количество запланированных удалений аккаунтов */
	scheduledDeletions: number;
}

export interface DashboardData {
	/** Статистика для карточек */
	stats: DashboardStats;

	/** Последние 10 действий в системе */
	recentActivity: ActivityLogWithUser[];
}

export async function load({ platform }: any): Promise<DashboardData> {
	try {
		const db = getDB(platform);

		// Получаем все данные параллельно для оптимизации
		const [
			usersResult,
			activeEventsResult,
			upcomingRegsResult,
			scheduledDeletionsResult,
			recentActivity,
		] = await Promise.all([
			// 1. Всего пользователей (включая заблокированных, согласно ТЗ)
			db.prepare('SELECT COUNT(*) as count FROM users').first<{ count: number }>(),

			// 2. Активные мероприятия
			db
				.prepare(
					`SELECT COUNT(*) as count
					 FROM events
					 WHERE status = 'active'
					 AND datetime(replace(COALESCE(end_date, date), 'T', ' ')) > datetime('now')`
				)
				.first<{ count: number }>(),

			// 3. Предстоящие регистрации (мероприятия в будущем, регистрации не отменены)
			db
				.prepare(
					`SELECT COUNT(*) as count
						FROM registrations r
						JOIN events e ON r.event_id = e.id
						WHERE e.date > datetime('now')
						AND r.cancelled_at IS NULL
						AND e.status = 'active'`
				)
				.first<{ count: number }>(),

			// 4. Запланированные удаления
			DB.gdpr.getScheduledDeletions(db).then((deletions) => deletions.length),

			// 5. Последние 10 действий
			DB.activityLog.getRecentActivity(db, 10),
		]);

		const stats: DashboardStats = {
			totalUsers: usersResult?.count || 0,
			activeEvents: activeEventsResult?.count || 0,
			upcomingRegistrations: upcomingRegsResult?.count || 0,
			scheduledDeletions: scheduledDeletionsResult,
		};

		return {
			stats,
			recentActivity,
		};
	} catch (error) {
		console.error('[Admin Dashboard] Ошибка при загрузке данных:', error);

		// Возвращаем пустые данные в случае ошибки
		return {
			stats: {
				totalUsers: 0,
				activeEvents: 0,
				upcomingRegistrations: 0,
				scheduledDeletions: 0,
			},
			recentActivity: [],
		};
	}
}
