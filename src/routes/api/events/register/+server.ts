/**
 * API Endpoint: POST /api/events/register
 * Регистрация пользователя на мероприятие
 *
 * Требует авторизации
 *
 * Логика:
 * 1. Проверка авторизации (requireAuth)
 * 2. Валидация входных данных через registrationCreateSchema
 * 3. Проверки бизнес-правил:
 *    - Мероприятие существует
 *    - Регистрация открыта (проверка через DB.events.isRegistrationOpen):
 *      * Мероприятие активно (status='active')
 *      * Дедлайн не истёк (registration_deadline > сейчас)
 *      * Есть свободные места (registeredCount < max_participants)
 *    - Пользователь ещё не записан
 * 4. Создание записи через registerUserForEvent
 * 5. Логирование действия через logActivity
 * 6. Отправка email подтверждения (не блокирует при ошибке)
 * 7. Возврат данных регистрации + ссылки на мессенджеры + QR-коды
 *
 * Обработка ошибок:
 * - 400: валидация failed
 * - 403: регистрация закрыта / уже записан
 * - 404: мероприятие не найдено
 * - 500: server error
 */

import { json, type RequestEvent } from '@sveltejs/kit';
import { requireAuth, getClientIP } from '$lib/server/middleware/auth';
import { handleApiError, createError } from '$lib/server/middleware/errorHandler';
import { registrationCreateSchema } from '$lib/server/validation/schemas';
import { DB as dbUtils } from '$lib/server/db';
import { sendEmail } from '$lib/server/email';
import { getEventRegistrationEmail } from '$lib/server/email/templates';
import type { LanguageCode } from '$lib/types/common';

/**
 * POST /api/events/register
 * Регистрация пользователя на мероприятие
 */
export async function POST({ request, platform }: RequestEvent) {
	// Проверка доступности platform.env
	if (!platform?.env) {
		return handleApiError(createError(500, 'Platform environment not available'));
	}

	const { DB, JWT_SECRET } = platform.env;

	try {
		// ============================================
		// 1. ПРОВЕРКА АВТОРИЗАЦИИ
		// ============================================
		const user = await requireAuth(request, DB, JWT_SECRET);

		// ============================================
		// 2. ПАРСИНГ И ВАЛИДАЦИЯ ВХОДНЫХ ДАННЫХ
		// ============================================
		let body;
		try {
			body = await request.json();
		} catch {
			throw createError(400, 'Invalid JSON body', 'INVALID_JSON');
		}

		// Валидация через Zod схему registrationCreateSchema
		const validationResult = registrationCreateSchema.safeParse(body);

		if (!validationResult.success) {
			throw createError(
				400,
				'Validation failed',
				'VALIDATION_ERROR',
				validationResult.error.issues
			);
		}

		const { event_id, additional_data } = validationResult.data;

		// ============================================
		// 3. ПРОВЕРКА БИЗНЕС-ПРАВИЛ
		// ============================================

		// 3.1. Получаем мероприятие
		const event = await dbUtils.events.getEventById(DB, event_id);

		if (!event) {
			throw createError(404, 'Event not found', 'EVENT_NOT_FOUND');
		}

		// 3.2. Проверяем доступность регистрации (централизованная проверка)
		// Проверяет: статус active, дедлайн не истёк, есть свободные места, не прошедшее
		const currentCount = event.current_participants ?? 0;
		const isOpen = dbUtils.events.isRegistrationOpen(event, currentCount);

		if (!isOpen) {
			// Определяем причину закрытия для более детального сообщения
			// Проверка на прошедшее мероприятие
			const now = new Date();
			const eventEndDate = event.end_date ? new Date(event.end_date) : new Date(event.date);
			if (eventEndDate <= now) {
				throw createError(403, 'Event has already ended', 'EVENT_PAST', {
					end_date: event.end_date || event.date,
					now: now.toISOString(),
				});
			}

			if (event.status !== 'active') {
				throw createError(
					403,
					'Event is not available for registration',
					'EVENT_NOT_ACTIVE',
					{
						status: event.status,
					}
				);
			}

			const deadline = new Date(event.registration_deadline);
			if (deadline <= now) {
				throw createError(
					403,
					'Registration deadline has passed',
					'REGISTRATION_DEADLINE_PASSED',
					{
						deadline: event.registration_deadline,
						now: now.toISOString(),
					}
				);
			}

			if (event.max_participants !== null && currentCount >= event.max_participants) {
				throw createError(403, 'Event is full. No more spots available', 'EVENT_FULL', {
					max_participants: event.max_participants,
					registered_count: currentCount,
				});
			}

			// Fallback на случай неизвестной причины
			throw createError(403, 'Registration is closed', 'REGISTRATION_CLOSED');
		}

		// 3.3. Проверяем, что пользователь ещё не записан (активная запись)
		const alreadyRegistered = await dbUtils.registrations.isUserRegistered(
			DB,
			user.id,
			event_id
		);

		if (alreadyRegistered) {
			throw createError(
				403,
				'You are already registered for this event',
				'ALREADY_REGISTERED'
			);
		}

		// ============================================
		// 4. СОЗДАНИЕ ЗАПИСИ В БД
		// ============================================

		// registerUserForEvent выполняет все необходимые проверки и создаёт запись
		const registration = await dbUtils.registrations.registerUserForEvent(
			DB,
			user.id,
			event_id,
			additional_data || undefined
		);

		// ============================================
		// 5. ЛОГИРОВАНИЕ ДЕЙСТВИЯ
		// ============================================
		const clientIP = getClientIP(request);

		await dbUtils.activityLog.logActivity(
			DB,
			user.id,
			'registration_create',
			JSON.stringify({
				event_id: event_id,
				registration_id: registration.id,
				event_title: event.title_de,
			}),
			clientIP || undefined
		);

		// ============================================
		// 6. ОТПРАВКА EMAIL ПОДТВЕРЖДЕНИЯ
		// ============================================

		// Определяем язык пользователя (из профиля, default 'de')
		const userLanguage: LanguageCode = (user.preferred_language as LanguageCode) || 'de';

		// Генерируем email шаблон
		const { subject, text } = getEventRegistrationEmail(
			user,
			event,
			userLanguage,
			event.telegram_link || undefined,
			event.whatsapp_link || undefined
		);

		// Отправляем email (не блокируем если failed)
		try {
			await sendEmail(user.email, subject, text, platform.env);

			console.log(`[Registration] Confirmation email sent to ${user.email}`);
		} catch (emailError) {
			// Логируем ошибку, но не прерываем процесс регистрации
			console.error('[Registration] Failed to send confirmation email:', emailError);

			// НЕ логируем email_failed - это не стандартный action_type
			// Просто выводим в консоль для отладки
		}

		// ============================================
		// 7. ВОЗВРАТ УСПЕШНОГО ОТВЕТА
		// ============================================

		return json(
			{
				success: true,
				registration: {
					id: registration.id,
					event_id: registration.event_id,
					registered_at: registration.registered_at,
					additional_data: registration.additional_data,
				},
				event: {
					id: event.id,
					title_de: event.title_de,
					title_en: event.title_en,
					title_ru: event.title_ru,
					title_uk: event.title_uk,
					date: event.date,
					location_de: event.location_de,
					location_en: event.location_en,
					location_ru: event.location_ru,
					location_uk: event.location_uk,
				},
				telegramLink: event.telegram_link || null,
				whatsappLink: event.whatsapp_link || null,
				qrTelegram: event.qr_telegram_url || null,
				qrWhatsapp: event.qr_whatsapp_url || null,
			},
			{
				status: 201, // Created
			}
		);
	} catch (error) {
		// Все ошибки обрабатываются через централизованный обработчик
		return handleApiError(error);
	}
}
