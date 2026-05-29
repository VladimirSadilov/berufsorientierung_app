/**
 * API Endpoint: DELETE /api/admin/events/delete
 *
 * Удаление мероприятия (только для администраторов)
 *
 * Функциональность:
 * - Проверка существования мероприятия
 * - Проверка на наличие любых регистраций
 * - Удаление QR-кодов, постера и event-media файлов из R2 Storage
 * - Удаление мероприятия из БД (каскадное удаление event_additional_fields и event_media)
 * - Логирование действия
 *
 * Требует: Admin права
 */

import { json, type RequestEvent } from '@sveltejs/kit';
import { requireAdmin, getClientIP } from '$lib/server/middleware/auth';
import { getEventById, deleteEvent } from '$lib/server/db/events';
import { logActivity } from '$lib/server/db/activityLog';
import { z } from 'zod';

// Схема валидации запроса
const deleteEventSchema = z.object({
	eventId: z.number().int().positive(),
});

export async function DELETE({ request, platform }: RequestEvent) {
	try {
		// Шаг 1: Проверка прав администратора
		const admin = await requireAdmin(request, platform!.env.DB, platform!.env.JWT_SECRET);

		// Шаг 2: Парсинг и валидация входных данных
		const body = await request.json();
		const validation = deleteEventSchema.safeParse(body);

		if (!validation.success) {
			return json(
				{
					error: 'Validation failed',
					details: validation.error.issues.map((issue) => ({
						field: issue.path.join('.'),
						message: issue.message,
					})),
				},
				{ status: 400 }
			);
		}

		const { eventId } = validation.data;

		// Шаг 3: Проверка существования мероприятия
		const event = await getEventById(platform!.env.DB, eventId);
		if (!event) {
			return json({ error: 'Event not found' }, { status: 404 });
		}

		// Шаг 4: Проверка на любые регистрации.
		// Hard-delete запрещен даже при отмененных registrations, чтобы не ломать историю.
		const registrationsResult = await platform!.env.DB.prepare(
			`SELECT COUNT(*) as count FROM registrations WHERE event_id = ?`
		)
			.bind(eventId)
			.first<{ count: number }>();

		const registrationsCount = registrationsResult?.count || 0;

		if (registrationsCount > 0) {
			return json(
				{
					error: 'Cannot delete event with registrations',
					message: `This event has ${registrationsCount} registration(s). Hard-delete is blocked to preserve registration history. Cancel or hide the event instead.`,
					registrationsCount,
				},
				{ status: 400 }
			);
		}

		// Шаг 5: Удаление мероприятия.
		// deleteEvent собирает QR/poster и event-media R2 keys до cascade-delete.
		await deleteEvent(platform!.env.DB, eventId, platform!.env.R2_BUCKET);

		// Шаг 6: Логирование действия
		const ip = getClientIP(request);
		const logDetails = JSON.stringify({
			event_id: eventId,
			event_title: event.title_de,
			ip,
		});
		await logActivity(platform!.env.DB, admin.id, 'event_delete', logDetails, ip || undefined);

		// Шаг 7: Возврат успешного результата
		return json({
			success: true,
			message: 'Event deleted successfully',
		});
	} catch (error: any) {
		console.error('[DELETE /api/admin/events/delete] Error:', error);

		// Обработка ошибок авторизации
		if (error.status === 401 || error.status === 403) {
			return json({ error: error.message }, { status: error.status });
		}

		// Обработка других ошибок
		return json(
			{
				error: 'Failed to delete event',
				message: error.message || 'Internal server error',
			},
			{ status: 500 }
		);
	}
}
