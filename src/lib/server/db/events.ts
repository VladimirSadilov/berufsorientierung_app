/**
 * Database utilities - Events
 * Утилиты для работы с мероприятиями
 */

import type { D1Database, R2Bucket } from '@cloudflare/workers-types';
import type {
	Event,
	EventCreateData,
	EventUpdateData,
	EventStatus,
	EventAdditionalField,
	EventWithFields,
} from '$lib/types/event';
import { setEventFields, getEventFields } from './eventFields';

/**
 * Создаёт новое мероприятие
 * По умолчанию создаётся со статусом 'draft'
 *
 * @param db - D1 Database instance
 * @param data - Данные мероприятия
 * @param createdBy - ID администратора, создающего мероприятие
 * @returns Созданное мероприятие
 * @throws Error если произошла ошибка создания
 */
export async function createEvent(
	db: D1Database,
	data: EventCreateData,
	createdBy: number
): Promise<Event> {
	try {
		const status = data.status || 'draft';
		const now = new Date().toISOString();

		// Создаём основную запись мероприятия
		const result = await db
			.prepare(
				`INSERT INTO events (
					title_de, title_en, title_ru, title_uk,
					description_de, description_en, description_ru, description_uk,
					requirements_de, requirements_en, requirements_ru, requirements_uk,
					location_de, location_en, location_ru, location_uk,
					date, end_date, registration_deadline, max_participants,
					telegram_link, whatsapp_link,
					status, created_by, created_at, updated_at
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
			)
			.bind(
				data.title_de,
				data.title_en || null,
				data.title_ru || null,
				data.title_uk || null,
				data.description_de || null,
				data.description_en || null,
				data.description_ru || null,
				data.description_uk || null,
				data.requirements_de || null,
				data.requirements_en || null,
				data.requirements_ru || null,
				data.requirements_uk || null,
				data.location_de || null,
				data.location_en || null,
				data.location_ru || null,
				data.location_uk || null,
				data.date,
				data.end_date ?? null,
				data.registration_deadline,
				data.max_participants,
				data.telegram_link || null,
				data.whatsapp_link || null,
				status,
				createdBy,
				now,
				now
			)
			.run();

		if (!result.success) {
			throw new Error('Failed to create event');
		}

		const eventId = result.meta.last_row_id;

		// Создаём дополнительные поля, если они указаны
		if (data.additional_fields && data.additional_fields.length > 0) {
			await setEventFields(db, eventId, data.additional_fields);
		}

		// Получаем созданное мероприятие
		const event = await getEventById(db, eventId);
		if (!event) {
			throw new Error('Event created but not found');
		}

		return event;
	} catch (error) {
		console.error('Error creating event:', error);
		throw new Error(
			`Failed to create event: ${error instanceof Error ? error.message : 'Unknown error'}`
		);
	}
}

/**
 * Обновляет существующее мероприятие
 * Автоматически обновляет updated_at
 *
 * @param db - D1 Database instance
 * @param id - ID мероприятия
 * @param data - Данные для обновления (частичные)
 * @returns Обновлённое мероприятие
 * @throws Error если мероприятие не найдено или произошла ошибка
 */
export async function updateEvent(
	db: D1Database,
	id: number,
	data: Partial<EventUpdateData>
): Promise<Event> {
	try {
		// Проверяем существование мероприятия
		const existingEvent = await getEventById(db, id);
		if (!existingEvent) {
			throw new Error(`Event with id ${id} not found`);
		}

		// Формируем SQL запрос динамически на основе переданных полей
		const updateFields: string[] = [];
		const values: any[] = [];

		// Мультиязычные поля
		const translationFields = [
			'title_de',
			'title_en',
			'title_ru',
			'title_uk',
			'description_de',
			'description_en',
			'description_ru',
			'description_uk',
			'requirements_de',
			'requirements_en',
			'requirements_ru',
			'requirements_uk',
			'location_de',
			'location_en',
			'location_ru',
			'location_uk',
		];

		translationFields.forEach((field) => {
			if (field in data) {
				updateFields.push(`${field} = ?`);
				values.push((data as any)[field] || null);
			}
		});

		// Основные поля
		if ('date' in data) {
			updateFields.push('date = ?');
			values.push(data.date);
		}
		if ('end_date' in data) {
			updateFields.push('end_date = ?');
			values.push(data.end_date ?? null);
		}
		if ('registration_deadline' in data) {
			updateFields.push('registration_deadline = ?');
			values.push(data.registration_deadline);
		}
		if ('max_participants' in data) {
			updateFields.push('max_participants = ?');
			values.push(data.max_participants);
		}
		if ('telegram_link' in data) {
			updateFields.push('telegram_link = ?');
			values.push(data.telegram_link || null);
		}
		if ('whatsapp_link' in data) {
			updateFields.push('whatsapp_link = ?');
			values.push(data.whatsapp_link || null);
		}
		if ('status' in data) {
			updateFields.push('status = ?');
			values.push(data.status);
		}

		// Всегда обновляем updated_at
		updateFields.push('updated_at = ?');
		values.push(new Date().toISOString());

		// Добавляем ID в конец для WHERE clause
		values.push(id);

		// Выполняем обновление (всегда, даже если только updated_at)
		const sql = `UPDATE events SET ${updateFields.join(', ')} WHERE id = ?`;
		const result = await db
			.prepare(sql)
			.bind(...values)
			.run();

		if (!result.success) {
			throw new Error('Failed to update event');
		}

		// Обновляем дополнительные поля, если они переданы
		if (data.additional_fields) {
			await setEventFields(db, id, data.additional_fields);
		}

		// Возвращаем обновлённое мероприятие
		const updatedEvent = await getEventById(db, id);
		if (!updatedEvent) {
			throw new Error('Event updated but not found');
		}

		return updatedEvent;
	} catch (error) {
		console.error('Error updating event:', error);
		throw new Error(
			`Failed to update event: ${error instanceof Error ? error.message : 'Unknown error'}`
		);
	}
}

/**
 * Удаляет мероприятие
 * Автоматически удаляет связанные QR-коды из R2
 * Дополнительные поля удаляются автоматически (ON DELETE CASCADE)
 *
 * @param db - D1 Database instance
 * @param id - ID мероприятия
 * @param r2Bucket - R2 Bucket instance (опционально, для удаления QR-кодов)
 * @throws Error если мероприятие не найдено или произошла ошибка
 */
export async function deleteEvent(db: D1Database, id: number, r2Bucket?: R2Bucket): Promise<void> {
	try {
		// Проверяем существование мероприятия и получаем URL QR-кодов
		const event = await getEventById(db, id);
		if (!event) {
			throw new Error(`Event with id ${id} not found`);
		}

		// Удаляем QR-коды и постер из R2, если bucket предоставлен
		if (r2Bucket) {
			const urlsToDelete = [
				event.qr_telegram_url,
				event.qr_whatsapp_url,
				event.poster_url,
			].filter((url): url is string => url !== null);

			if (urlsToDelete.length > 0) {
				const { deleteFilesByUrls } = await import('$lib/server/storage/r2');
				const deletedCount = await deleteFilesByUrls(r2Bucket, urlsToDelete);
				console.log(
					`Deleted ${deletedCount} files (QR codes/poster) from R2 for event ${id}`
				);
			}
		}

		// Удаляем мероприятие из БД (дополнительные поля удалятся автоматически через CASCADE)
		const result = await db.prepare('DELETE FROM events WHERE id = ?').bind(id).run();

		if (!result.success) {
			throw new Error('Failed to delete event');
		}
	} catch (error) {
		console.error('Error deleting event:', error);
		throw new Error(
			`Failed to delete event: ${error instanceof Error ? error.message : 'Unknown error'}`
		);
	}
}

/**
 * Получает мероприятие по ID
 *
 * @param db - D1 Database instance
 * @param id - ID мероприятия
 * @returns Мероприятие или null если не найдено
 */
export async function getEventById(db: D1Database, id: number): Promise<Event | null> {
	try {
		const result = await db
			.prepare(
				`SELECT 
					e.*,
					COUNT(DISTINCT CASE WHEN r.cancelled_at IS NULL THEN r.id END) as current_participants
				FROM events e
				LEFT JOIN registrations r ON e.id = r.event_id
				WHERE e.id = ?
				GROUP BY e.id`
			)
			.bind(id)
			.first<Event & { current_participants: number }>();

		return result || null;
	} catch (error) {
		console.error('Error getting event by id:', error);
		throw new Error(
			`Failed to get event: ${error instanceof Error ? error.message : 'Unknown error'}`
		);
	}
}

/**
 * Получает все мероприятия с возможностью фильтрации и пагинации
 *
 * @param db - D1 Database instance
 * @param filters - Опциональные фильтры
 * @returns Список мероприятий и общее количество
 */
export async function getAllEvents(
	db: D1Database,
	filters?: {
		status?: EventStatus;
		dateFrom?: string;
		dateTo?: string;
		limit?: number;
		offset?: number;
	}
): Promise<{ events: Event[]; total: number }> {
	try {
		const whereConditions: string[] = [];
		const values: any[] = [];

		// Добавляем фильтры
		if (filters?.status) {
			whereConditions.push('e.status = ?');
			values.push(filters.status);
		}
		if (filters?.dateFrom) {
			whereConditions.push('e.date >= ?');
			values.push(filters.dateFrom);
		}
		if (filters?.dateTo) {
			whereConditions.push('e.date <= ?');
			values.push(filters.dateTo);
		}

		const whereClause =
			whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

		// Получаем общее количество
		const countSql = `SELECT COUNT(*) as total FROM events e ${whereClause}`;
		const countResult = await db
			.prepare(countSql)
			.bind(...values)
			.first<{ total: number }>();
		const total = countResult?.total || 0;

		// Получаем список мероприятий с пагинацией
		const limit = filters?.limit || 50;
		const offset = filters?.offset || 0;

		const eventsSql = `
			SELECT 
				e.*,
				COUNT(DISTINCT CASE WHEN r.cancelled_at IS NULL THEN r.id END) as current_participants
			FROM events e
			LEFT JOIN registrations r ON e.id = r.event_id
			${whereClause}
			GROUP BY e.id
			ORDER BY e.date DESC
			LIMIT ? OFFSET ?
		`;

		const eventsResult = await db
			.prepare(eventsSql)
			.bind(...values, limit, offset)
			.all<Event & { current_participants: number }>();

		return {
			events: eventsResult.results || [],
			total,
		};
	} catch (error) {
		console.error('Error getting all events:', error);
		throw new Error(
			`Failed to get events: ${error instanceof Error ? error.message : 'Unknown error'}`
		);
	}
}

/**
 * Получает только активные и предстоящие мероприятия
 * Сортировка: ближайшие первыми
 *
 * @param db - D1 Database instance
 * @returns Список активных мероприятий
 */
export async function getActiveEvents(db: D1Database): Promise<Event[]> {
	try {
		const now = new Date().toISOString();

		const result = await db
			.prepare(
				`SELECT 
					e.*,
					COUNT(DISTINCT CASE WHEN r.cancelled_at IS NULL THEN r.id END) as current_participants
				FROM events e
				LEFT JOIN registrations r ON e.id = r.event_id
				WHERE e.status = 'active' AND e.date >= ?
				GROUP BY e.id
				ORDER BY e.date ASC`
			)
			.bind(now)
			.all<Event & { current_participants: number }>();

		return result.results || [];
	} catch (error) {
		console.error('Error getting active events:', error);
		throw new Error(
			`Failed to get active events: ${error instanceof Error ? error.message : 'Unknown error'}`
		);
	}
}

/**
 * Получает прошедшие мероприятия
 * Сортировка: новые первыми
 *
 * @param db - D1 Database instance
 * @returns Список прошедших мероприятий
 */
export async function getPastEvents(db: D1Database): Promise<Event[]> {
	try {
		const now = new Date().toISOString();

		const result = await db
			.prepare(
				`SELECT 
					e.*,
					COUNT(DISTINCT CASE WHEN r.cancelled_at IS NULL THEN r.id END) as current_participants
				FROM events e
				LEFT JOIN registrations r ON e.id = r.event_id
				WHERE e.date < ?
				GROUP BY e.id
				ORDER BY e.date DESC`
			)
			.bind(now)
			.all<Event & { current_participants: number }>();

		return result.results || [];
	} catch (error) {
		console.error('Error getting past events:', error);
		throw new Error(
			`Failed to get past events: ${error instanceof Error ? error.message : 'Unknown error'}`
		);
	}
}

/**
 * Публикует мероприятие (меняет статус с draft на active)
 * Валидирует обязательные поля перед публикацией
 *
 * @param db - D1 Database instance
 * @param id - ID мероприятия
 * @returns Опубликованное мероприятие
 * @throws Error если валидация не прошла или мероприятие не найдено
 */
export async function publishEvent(db: D1Database, id: number): Promise<Event> {
	try {
		const event = await getEventById(db, id);
		if (!event) {
			throw new Error(`Event with id ${id} not found`);
		}

		// Валидация обязательных полей
		if (!event.title_de) {
			throw new Error('Title (German) is required for publishing');
		}
		if (!event.date) {
			throw new Error('Event date is required for publishing');
		}
		if (!event.end_date) {
			throw new Error('Event end date is required for publishing');
		}
		if (!event.registration_deadline) {
			throw new Error('Registration deadline is required for publishing');
		}
		// max_participants = null означает безлимит, проверяем только если задано
		if (event.max_participants !== null && event.max_participants <= 0) {
			throw new Error('Max participants must be greater than 0');
		}

		// Проверяем что мероприятие в статусе draft
		if (event.status !== 'draft') {
			throw new Error(`Event is already ${event.status}, cannot publish`);
		}

		// Обновляем статус
		return await updateEvent(db, id, { status: 'active' });
	} catch (error) {
		console.error('Error publishing event:', error);
		throw new Error(
			`Failed to publish event: ${error instanceof Error ? error.message : 'Unknown error'}`
		);
	}
}

/**
 * Отменяет мероприятие
 * Устанавливает статус cancelled, дату отмены и причину
 * Логирует действие администратора
 *
 * @param db - D1 Database instance
 * @param id - ID мероприятия
 * @param reason - Причина отмены
 * @param cancelledBy - ID администратора, отменяющего мероприятие
 * @returns Отменённое мероприятие
 * @throws Error если мероприятие не найдено или произошла ошибка
 */
export async function cancelEvent(
	db: D1Database,
	id: number,
	reason: string,
	cancelledBy: number
): Promise<Event> {
	try {
		const event = await getEventById(db, id);
		if (!event) {
			throw new Error(`Event with id ${id} not found`);
		}

		// Проверяем что мероприятие не отменено
		if (event.status === 'cancelled') {
			throw new Error('Event is already cancelled');
		}

		const now = new Date().toISOString();

		// Обновляем мероприятие
		const result = await db
			.prepare(
				`UPDATE events 
				SET status = 'cancelled', 
					cancelled_at = ?, 
					cancellation_reason = ?,
					updated_at = ?
				WHERE id = ?`
			)
			.bind(now, reason, now, id)
			.run();

		if (!result.success) {
			throw new Error('Failed to cancel event');
		}

		// Логируем действие администратора для аудита
		await db
			.prepare(
				`INSERT INTO activity_log (user_id, action_type, details, timestamp)
				VALUES (?, ?, ?, ?)`
			)
			.bind(
				cancelledBy,
				'event_cancelled',
				JSON.stringify({
					event_id: id,
					event_title: event.title_de,
					reason: reason,
				}),
				now
			)
			.run();

		// Возвращаем обновлённое мероприятие
		const cancelledEvent = await getEventById(db, id);
		if (!cancelledEvent) {
			throw new Error('Event cancelled but not found');
		}

		return cancelledEvent;
	} catch (error) {
		console.error('Error cancelling event:', error);
		throw new Error(
			`Failed to cancel event: ${error instanceof Error ? error.message : 'Unknown error'}`
		);
	}
}

/**
 * Получает мероприятие вместе с его дополнительными полями
 * Дополнительные поля возвращаются с распарсенными field_options
 *
 * @param db - D1 Database instance
 * @param id - ID мероприятия
 * @returns Мероприятие с дополнительными полями или null если не найдено
 */
export async function getEventWithFields(
	db: D1Database,
	id: number
): Promise<EventWithFields | null> {
	try {
		// Получаем мероприятие
		const event = await getEventById(db, id);
		if (!event) {
			return null;
		}

		// Получаем дополнительные поля с правильным парсингом JSON
		const additionalFields = await getEventFields(db, id);

		return {
			...event,
			additional_fields: additionalFields,
		};
	} catch (error) {
		console.error('Error getting event with fields:', error);
		throw new Error(
			`Failed to get event with fields: ${error instanceof Error ? error.message : 'Unknown error'}`
		);
	}
}

/**
 * Закрывает регистрацию на мероприятия с истёкшим дедлайном
 *
 * Находит все активные мероприятия, у которых registration_deadline < NOW()
 * и возвращает их количество для статистики.
 *
 * ПРИМЕЧАНИЕ: В приложении просто проверяем deadline при отображении кнопки регистрации.
 * Эта функция нужна для:
 * - Статистики (сколько мероприятий с истёкшим дедлайном)
 * - Логирования
 * - Потенциального добавления поля registration_closed в будущем
 *
 * @param db - D1 Database instance
 * @returns Количество мероприятий с истёкшим дедлайном
 * @throws Error если произошла ошибка запроса
 */
export async function closeExpiredRegistrations(db: D1Database): Promise<number> {
	try {
		const now = new Date().toISOString();

		// Находим все активные мероприятия с истёкшим дедлайном
		const result = await db
			.prepare(
				`SELECT COUNT(*) as count 
				 FROM events 
				 WHERE status = 'active' 
				 AND registration_deadline < ?`
			)
			.bind(now)
			.first<{ count: number }>();

		const count = result?.count || 0;

		if (count > 0) {
			console.log(`[CRON] Found ${count} events with expired registration deadline`);
		}

		return count;
	} catch (error) {
		console.error('Error checking expired registrations:', error);
		throw new Error(
			`Failed to check expired registrations: ${error instanceof Error ? error.message : 'Unknown error'}`
		);
	}
}

/**
 * Проверяет, открыта ли регистрация на мероприятие
 *
 * Регистрация считается закрытой если:
 * - Мероприятие уже прошло (end_date <= now или date <= now)
 * - Мероприятие не в статусе 'active'
 * - Дедлайн регистрации истёк
 * - Достигнуто максимальное количество участников (если задано)
 *
 * @param event - Мероприятие для проверки
 * @param currentRegistrations - Текущее количество записавшихся (опционально)
 * @returns true если регистрация открыта, false если закрыта
 */
export function isRegistrationOpen(event: Event, currentRegistrations?: number): boolean {
	// Проверка 0: Мероприятие не должно быть прошедшим
	const now = new Date();
	// Используем end_date если есть, иначе date
	const eventEndDate = event.end_date ? new Date(event.end_date) : new Date(event.date);
	const endMs = eventEndDate.getTime();
	// Если дата не парсится - fail-closed
	if (Number.isNaN(endMs)) {
		return false;
	}
	if (eventEndDate <= now) {
		return false;
	}

	// Проверка 1: Мероприятие должно быть активным
	if (event.status !== 'active') {
		return false;
	}

	// Проверка 2: Дедлайн не должен быть истёкшим (или равным текущему моменту)
	const deadline = new Date(event.registration_deadline);
	if (deadline <= now) {
		return false;
	}

	// Проверка 3: Не достигнут лимит участников (если задан)
	if (event.max_participants !== null && currentRegistrations !== undefined) {
		if (currentRegistrations >= event.max_participants) {
			return false;
		}
	}

	return true;
}
