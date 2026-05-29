/**
 * Database utilities - Main export file
 * Центральный файл для экспорта всех утилит работы с БД
 *
 * Все DB функции сгруппированы по модулям для удобного доступа:
 * - DB.users.* - операции с пользователями
 * - DB.events.* - операции с мероприятиями
 * - DB.eventFields.* - доп. поля мероприятий
 * - DB.registrations.* - регистрации на мероприятия
 * - DB.admin.* - управление администраторами
 * - DB.activityLog.* - логирование действий
 * - DB.gdpr.* - GDPR-операции (удаление данных)
 * - DB.eventMedia.* - медиа главной страницы и Rueckblick
 *
 * ВАЖНО: Используется uppercase DB для агрегатора модулей,
 * чтобы избежать конфликта с локальными переменными db (инстанс D1Database).
 */

import type { D1Database } from '@cloudflare/workers-types';
import * as users from './users';
import * as events from './events';
import * as eventFields from './eventFields';
import * as registrations from './registrations';
import * as admin from './admin';
import * as activityLog from './activityLog';
import * as gdpr from './gdpr';
import * as reviews from './reviews';
import * as eventMedia from './eventMedia';

// Экспорт всех модулей в единый объект DB (uppercase для избежания конфликтов)
export const DB = {
	users,
	events,
	eventFields,
	registrations,
	admin,
	activityLog,
	gdpr,
	reviews,
	eventMedia,
};

/**
 * Helper для получения D1 database из platform
 * @param platform - Platform объект из SvelteKit (содержит env с DB)
 * @returns D1Database инстанс
 * @throws Error если database не доступна
 */
export function getDB(platform: any): D1Database {
	if (!platform?.env?.DB) {
		throw new Error('Database not available');
	}
	return platform.env.DB;
}

// Экспорт типов для использования в других модулях
export type { D1Database } from '@cloudflare/workers-types';

// Экспорт специфичных типов из модулей
export type { ActivityLogFilters, ActivityLogResult } from './activityLog';
export type { CanDeleteUserResult } from './gdpr';
