/**
 * Zod Validation Schemas
 * Схемы валидации для всех входных данных приложения
 *
 * Все схемы используют Zod для runtime валидации и автоматической генерации TypeScript типов.
 * Включены кастомные сообщения об ошибках с поддержкой мультиязычности.
 */

import { z } from 'zod';

// ==========================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ==========================================

/**
 * Вычисляет возраст на основе даты рождения
 */
function calculateAge(birthDate: string): number {
	const birth = new Date(birthDate);
	const today = new Date();
	let age = today.getFullYear() - birth.getFullYear();
	const monthDiff = today.getMonth() - birth.getMonth();

	if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
		age--;
	}

	return age;
}

/**
 * Проверяет, является ли строка валидным URL
 */
function isValidUrl(url: string): boolean {
	try {
		new URL(url);
		return true;
	} catch {
		return false;
	}
}

/**
 * Проверяет формат телефонного номера (немецкий и международный формат)
 * Разрешены форматы:
 * - Немецкие: +49... или 0... (минимум 7 цифр после кода)
 * - Международные: +<код страны><номер> (от 8 до 15 цифр всего, E.164)
 * Пробелы и дефисы игнорируются
 */
function isValidPhone(phone: string): boolean {
	// Удаляем пробелы и дефисы для проверки
	const cleaned = phone.replace(/[\s\-]/g, '');

	// Немецкий формат: +49... или 0... (минимум 7 цифр после кода для разумной длины)
	if (/^(\+49|0)\d{7,}$/.test(cleaned)) {
		return true;
	}

	// Общий международный формат E.164: +<код><номер>, от 8 до 15 цифр всего
	// Это покрывает все страны мира (например: +380675594122, +48..., +371..., +7...)
	if (/^\+\d{8,15}$/.test(cleaned)) {
		return true;
	}

	return false;
}

/**
 * Проверяет формат немецкого почтового индекса
 */
function isValidGermanZip(zip: string): boolean {
	return /^\d{5}$/.test(zip);
}

/**
 * Проверяет, содержит ли строка только буквы (с учетом умлаутов и кириллицы)
 */
function isOnlyLetters(str: string): boolean {
	return /^[a-zA-ZäöüßÄÖÜа-яА-ЯіїєґІЇЄҐ\s\-']+$/.test(str);
}

/**
 * Проверяет snake_case формат
 */
function isSnakeCase(str: string): boolean {
	return /^[a-z][a-z0-9_]*$/.test(str);
}

// ==========================================
// БАЗОВЫЕ СХЕМЫ (ПЕРЕИСПОЛЬЗУЕМЫЕ)
// ==========================================

/**
 * Схема для email адреса
 */
const emailSchema = z
	.string()
	.min(1, { message: 'Email is required' })
	.email({ message: 'Invalid email format' })
	.toLowerCase()
	.trim();

/**
 * Схема для пароля
 */
const passwordSchema = z
	.string()
	.min(8, { message: 'Password must be at least 8 characters long' });

/**
 * Схема для имени/фамилии
 */
const nameSchema = z
	.string()
	.min(1, { message: 'This field is required' })
	.max(100, { message: 'Name is too long (max 100 characters)' })
	.trim()
	.refine(isOnlyLetters, {
		message: 'Name must contain only letters',
	});

/**
 * Схема для даты рождения
 */
const birthDateSchema = z
	.string()
	.regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date must be in YYYY-MM-DD format' })
	.refine(
		(date) => {
			const parsed = new Date(date);
			return !isNaN(parsed.getTime());
		},
		{ message: 'Invalid date' }
	)
	.refine(
		(date) => {
			const parsed = new Date(date);
			return parsed < new Date();
		},
		{ message: 'Birth date cannot be in the future' }
	)
	.refine(
		(date) => {
			const age = calculateAge(date);
			return age >= 10 && age <= 100;
		},
		{ message: 'Age must be between 10 and 100 years' }
	);

/**
 * Схема для телефона
 */
const phoneSchema = z
	.string()
	.min(1, { message: 'Phone number is required' })
	.trim()
	.refine(isValidPhone, {
		message:
			'Invalid phone number format. Use an international format like +49..., +380..., or 0... for local.',
	});

/**
 * Схема для опционального телефона (WhatsApp, Telegram)
 */
const optionalPhoneSchema = z
	.string()
	.trim()
	.refine((val) => val === '' || isValidPhone(val), {
		message: 'Invalid phone number format',
	})
	.optional()
	.or(z.literal(''));

/**
 * Схема для почтового индекса
 */
const zipSchema = z.string().min(1, { message: 'ZIP code is required' }).refine(isValidGermanZip, {
	message: 'ZIP code must be 5 digits',
});

/**
 * Схема для URL
 */
const urlSchema = z
	.string()
	.trim()
	.refine((val) => val === '' || isValidUrl(val), {
		message: 'Invalid URL format',
	})
	.optional()
	.or(z.literal(''));

/**
 * Схема для даты в будущем
 */
const futureDateSchema = z
	.string()
	.regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/, { message: 'Invalid date-time format' })
	.refine(
		(date) => {
			const parsed = new Date(date);
			return !isNaN(parsed.getTime());
		},
		{ message: 'Invalid date' }
	)
	.refine(
		(date) => {
			const parsed = new Date(date);
			return parsed > new Date();
		},
		{ message: 'Date must be in the future' }
	);

// ==========================================
// СХЕМЫ ДЛЯ ПОЛЬЗОВАТЕЛЕЙ
// ==========================================

/**
 * Схема регистрации пользователя
 */
export const userRegistrationSchema = z
	.object({
		// Аутентификация
		email: emailSchema,
		password: passwordSchema,
		password_confirm: z.string().min(1, { message: 'Password confirmation is required' }),

		// Личные данные
		first_name: nameSchema,
		last_name: nameSchema,
		birth_date: birthDateSchema,

		// Адрес
		address_street: z.string().min(1, { message: 'Street is required' }).trim(),
		address_number: z.string().min(1, { message: 'House number is required' }).trim(),
		address_zip: zipSchema,
		address_city: z.string().min(1, { message: 'City is required' }).trim(),

		// Контакты
		phone: phoneSchema,
		whatsapp: optionalPhoneSchema,
		telegram: z.string().trim().optional(),

		// Согласия
		photo_video_consent: z.boolean(),
		parental_consent: z.boolean(),
		gdpr_consent: z.boolean(),

		// Предпочтения
		preferred_language: z.enum(['de', 'en', 'ru', 'uk']).default('de'),
	})
	.refine((data) => data.password === data.password_confirm, {
		message: 'Passwords do not match',
		path: ['password_confirm'],
	})
	.refine(
		(data) => {
			const age = calculateAge(data.birth_date);
			// Если возраст < 18, то parental_consent должен быть true
			if (age < 18) {
				return data.parental_consent === true;
			}
			return true;
		},
		{
			message: 'Parental consent is required for users under 18',
			path: ['parental_consent'],
		}
	)
	.refine((data) => data.gdpr_consent === true, {
		message: 'GDPR consent is required',
		path: ['gdpr_consent'],
	});

/**
 * Схема входа в систему
 */
export const userLoginSchema = z.object({
	email: emailSchema,
	password: z.string().min(1, { message: 'Password is required' }),
});

/**
 * Схема запроса на восстановление пароля
 */
export const forgotPasswordRequestSchema = z.object({
	email: emailSchema,
});

/**
 * Схема сброса пароля по токену
 */
export const passwordResetSchema = z
	.object({
		token: z.string().min(1, { message: 'Token is required' }),
		new_password: passwordSchema,
		new_password_confirm: z.string().min(1, { message: 'Password confirmation is required' }),
	})
	.refine((data) => data.new_password === data.new_password_confirm, {
		message: 'New passwords do not match',
		path: ['new_password_confirm'],
	});

/**
 * Схема обновления профиля пользователя
 * Все поля опциональны, валидация применяется только к заполненным
 */
export const userUpdateSchema = z
	.object({
		// Аутентификация
		email: emailSchema.optional(),

		// Личные данные
		first_name: nameSchema.optional(),
		last_name: nameSchema.optional(),
		birth_date: birthDateSchema.optional(),

		// Адрес
		address_street: z.string().min(1).trim().optional(),
		address_number: z.string().min(1).trim().optional(),
		address_zip: zipSchema.optional(),
		address_city: z.string().min(1).trim().optional(),

		// Контакты
		phone: phoneSchema.optional(),
		whatsapp: optionalPhoneSchema,
		telegram: z.string().trim().optional(),

		// Согласия (с preprocessing для конвертации строк из формы в boolean)
		photo_video_consent: z.preprocess(
			(v) => v === 'on' || v === 'true' || v === true,
			z.boolean().optional()
		),
		parental_consent: z.preprocess(
			(v) => v === 'on' || v === 'true' || v === true,
			z.boolean().optional()
		),

		// Предпочтения
		preferred_language: z.enum(['de', 'en', 'ru', 'uk']).optional(),

		// Смена пароля
		current_password: z.string().optional(),
		new_password: passwordSchema.optional(),
		new_password_confirm: z.string().optional(),
	})
	.refine(
		(data) => {
			// Если указан new_password, то current_password обязателен
			if (data.new_password && !data.current_password) {
				return false;
			}
			return true;
		},
		{
			message: 'Current password is required to set a new password',
			path: ['current_password'],
		}
	)
	.refine(
		(data) => {
			// Если указан new_password, то new_password_confirm должен совпадать
			if (data.new_password && data.new_password !== data.new_password_confirm) {
				return false;
			}
			return true;
		},
		{
			message: 'New passwords do not match',
			path: ['new_password_confirm'],
		}
	);

// ==========================================
// СХЕМЫ ДЛЯ МЕРОПРИЯТИЙ
// ==========================================

/**
 * Схема мультиязычных переводов для мероприятия
 */
const eventTranslationsSchema = z.object({
	// Заголовок (немецкий обязателен)
	title_de: z.string().min(1, { message: 'German title is required' }).trim(),
	title_en: z.string().trim().optional().nullable(),
	title_ru: z.string().trim().optional().nullable(),
	title_uk: z.string().trim().optional().nullable(),

	// Описание (все опциональны)
	description_de: z.string().trim().optional().nullable(),
	description_en: z.string().trim().optional().nullable(),
	description_ru: z.string().trim().optional().nullable(),
	description_uk: z.string().trim().optional().nullable(),

	// Требования (все опциональны)
	requirements_de: z.string().trim().optional().nullable(),
	requirements_en: z.string().trim().optional().nullable(),
	requirements_ru: z.string().trim().optional().nullable(),
	requirements_uk: z.string().trim().optional().nullable(),

	// Место проведения (все опциональны)
	location_de: z.string().trim().optional().nullable(),
	location_en: z.string().trim().optional().nullable(),
	location_ru: z.string().trim().optional().nullable(),
	location_uk: z.string().trim().optional().nullable(),
});

/**
 * Схема создания мероприятия
 */
export const eventCreateSchema = eventTranslationsSchema
	.extend({
		// Даты
		date: futureDateSchema,
		end_date: futureDateSchema.optional().nullable(),
		registration_deadline: futureDateSchema,

		// Ограничения
		max_participants: z
			.number()
			.int({ message: 'Must be an integer' })
			.positive({ message: 'Must be greater than 0' })
			.min(1, { message: 'At least 1 participant is required' })
			.max(1000, { message: 'Maximum 1000 participants allowed' }),

		// Ссылки на мессенджеры
		telegram_link: urlSchema,
		whatsapp_link: urlSchema,

		// Статус (по умолчанию draft)
		status: z.enum(['draft', 'active']).default('draft').optional(),
	})
	.refine(
		(data) => {
			// Дедлайн регистрации должен быть раньше даты мероприятия
			const deadline = new Date(data.registration_deadline);
			const eventDate = new Date(data.date);
			return deadline < eventDate;
		},
		{
			message: 'Registration deadline must be before the event date',
			path: ['registration_deadline'],
		}
	)
	.refine(
		(data) => {
			// Если end_date задан, он должен быть после date
			if (data.end_date) {
				const startDate = new Date(data.date);
				const endDate = new Date(data.end_date);
				return endDate > startDate;
			}
			return true;
		},
		{
			message: 'End date must be after start date',
			path: ['end_date'],
		}
	);

/**
 * Схема обновления мероприятия
 * Все поля опциональны, кроме id
 */
export const eventUpdateSchema = z
	.object({
		id: z.number().int().positive(),

		// Переводы (все опциональны)
		title_de: z.string().min(1).trim().optional(),
		title_en: z.string().trim().optional().nullable(),
		title_ru: z.string().trim().optional().nullable(),
		title_uk: z.string().trim().optional().nullable(),

		description_de: z.string().min(1).trim().optional(),
		description_en: z.string().trim().optional().nullable(),
		description_ru: z.string().trim().optional().nullable(),
		description_uk: z.string().trim().optional().nullable(),

		requirements_de: z.string().trim().optional().nullable(),
		requirements_en: z.string().trim().optional().nullable(),
		requirements_ru: z.string().trim().optional().nullable(),
		requirements_uk: z.string().trim().optional().nullable(),

		location_de: z.string().min(1).trim().optional(),
		location_en: z.string().trim().optional().nullable(),
		location_ru: z.string().trim().optional().nullable(),
		location_uk: z.string().trim().optional().nullable(),

		// Даты
		date: futureDateSchema.optional(),
		end_date: futureDateSchema.optional().nullable(),
		registration_deadline: futureDateSchema.optional(),

		// Ограничения
		max_participants: z.number().int().positive().min(1).max(1000).optional(),

		// Ссылки
		telegram_link: urlSchema,
		whatsapp_link: urlSchema,

		// Статус
		status: z.enum(['draft', 'active', 'cancelled']).optional(),
	})
	.refine(
		(data) => {
			// Если указаны обе даты, проверяем их корректность
			if (data.date && data.registration_deadline) {
				const deadline = new Date(data.registration_deadline);
				const eventDate = new Date(data.date);
				return deadline < eventDate;
			}
			return true;
		},
		{
			message: 'Registration deadline must be before the event date',
			path: ['registration_deadline'],
		}
	)
	.refine(
		(data) => {
			// Если указаны date и end_date, проверяем что end_date > date
			if (data.date && data.end_date) {
				const startDate = new Date(data.date);
				const endDate = new Date(data.end_date);
				return endDate > startDate;
			}
			return true;
		},
		{
			message: 'End date must be after start date',
			path: ['end_date'],
		}
	);

/**
 * Схема дополнительного поля для мероприятия
 */
export const additionalFieldSchema = z
	.object({
		// Ключ поля (snake_case)
		field_key: z.string().min(1, { message: 'Field key is required' }).refine(isSnakeCase, {
			message: 'Field key must be in snake_case format',
		}),

		// Тип поля (только разрешенные типы согласно спецификации)
		field_type: z.enum(['text', 'select', 'checkbox', 'date', 'number']),

		// Опции для select (обязательно для этого типа)
		field_options: z
			.array(z.string().min(1))
			.min(1, { message: 'At least one option is required for select fields' })
			.optional()
			.nullable(),

		// Обязательность
		required: z.boolean().default(false),

		// Метки на разных языках (немецкая обязательна)
		label_de: z.string().min(1, { message: 'German label is required' }).trim(),
		label_en: z.string().trim().optional().nullable(),
		label_ru: z.string().trim().optional().nullable(),
		label_uk: z.string().trim().optional().nullable(),

		// Placeholders (все опциональны)
		placeholder_de: z.string().trim().optional().nullable(),
		placeholder_en: z.string().trim().optional().nullable(),
		placeholder_ru: z.string().trim().optional().nullable(),
		placeholder_uk: z.string().trim().optional().nullable(),
	})
	.refine(
		(data) => {
			// Для select field_options обязателен
			if (
				data.field_type === 'select' &&
				(!data.field_options || data.field_options.length === 0)
			) {
				return false;
			}
			return true;
		},
		{
			message: 'Options are required for select fields',
			path: ['field_options'],
		}
	); /**
 * Схема создания мероприятия с дополнительными полями
 */
export const eventCreateWithFieldsSchema = z
	.object({
		// Переводы
		title_de: z.string().min(1, { message: 'German title is required' }).trim(),
		title_en: z.string().trim().optional().nullable(),
		title_ru: z.string().trim().optional().nullable(),
		title_uk: z.string().trim().optional().nullable(),

		description_de: z.string().trim().optional().nullable(),
		description_en: z.string().trim().optional().nullable(),
		description_ru: z.string().trim().optional().nullable(),
		description_uk: z.string().trim().optional().nullable(),

		requirements_de: z.string().trim().optional().nullable(),
		requirements_en: z.string().trim().optional().nullable(),
		requirements_ru: z.string().trim().optional().nullable(),
		requirements_uk: z.string().trim().optional().nullable(),

		location_de: z.string().trim().optional().nullable(),
		location_en: z.string().trim().optional().nullable(),
		location_ru: z.string().trim().optional().nullable(),
		location_uk: z.string().trim().optional().nullable(),

		// Даты
		date: futureDateSchema,
		end_date: futureDateSchema.optional().nullable(),
		registration_deadline: futureDateSchema,

		// Ограничения
		// max_participants может быть null (безлимит) или положительным числом
		max_participants: z
			.number()
			.int({ message: 'Must be an integer' })
			.positive({ message: 'Must be greater than 0' })
			.min(1, { message: 'At least 1 participant is required' })
			.max(1000, { message: 'Maximum 1000 participants allowed' })
			.optional()
			.nullable(),

		// Ссылки на мессенджеры
		telegram_link: urlSchema,
		whatsapp_link: urlSchema,

		// Статус (по умолчанию draft)
		status: z.enum(['draft', 'active']).default('draft').optional(),

		// Дополнительные поля
		additional_fields: z.array(additionalFieldSchema).optional(),
	})
	.refine(
		(data) => {
			// Дедлайн регистрации должен быть раньше даты мероприятия
			const deadline = new Date(data.registration_deadline);
			const eventDate = new Date(data.date);
			return deadline < eventDate;
		},
		{
			message: 'Registration deadline must be before the event date',
			path: ['registration_deadline'],
		}
	)
	.refine(
		(data) => {
			// Если end_date задан, он должен быть после date
			if (data.end_date) {
				const startDate = new Date(data.date);
				const endDate = new Date(data.end_date);
				return endDate > startDate;
			}
			return true;
		},
		{
			message: 'End date must be after start date',
			path: ['end_date'],
		}
	);

/**
 * Схема обновления мероприятия с дополнительными полями
 */
export const eventUpdateWithFieldsSchema = z
	.object({
		id: z.number().int().positive(),

		// Переводы (все опциональны)
		title_de: z.string().min(1).trim().optional(),
		title_en: z.string().trim().optional().nullable(),
		title_ru: z.string().trim().optional().nullable(),
		title_uk: z.string().trim().optional().nullable(),

		description_de: z.string().trim().optional().nullable(),
		description_en: z.string().trim().optional().nullable(),
		description_ru: z.string().trim().optional().nullable(),
		description_uk: z.string().trim().optional().nullable(),

		requirements_de: z.string().trim().optional().nullable(),
		requirements_en: z.string().trim().optional().nullable(),
		requirements_ru: z.string().trim().optional().nullable(),
		requirements_uk: z.string().trim().optional().nullable(),

		location_de: z.string().trim().optional().nullable(),
		location_en: z.string().trim().optional().nullable(),
		location_ru: z.string().trim().optional().nullable(),
		location_uk: z.string().trim().optional().nullable(),

		// Даты
		date: futureDateSchema.optional(),
		end_date: futureDateSchema.optional().nullable(),
		registration_deadline: futureDateSchema.optional(),

		// Ограничения
		// max_participants может быть null (безлимит) или положительным числом
		max_participants: z.number().int().positive().min(1).max(1000).optional().nullable(),

		// Ссылки
		telegram_link: urlSchema,
		whatsapp_link: urlSchema,

		// Статус
		status: z.enum(['draft', 'active', 'cancelled']).optional(),

		// Дополнительные поля
		additional_fields: z.array(additionalFieldSchema).optional(),
	})
	.refine(
		(data) => {
			// Если указаны обе даты, проверяем их корректность
			if (data.date && data.registration_deadline) {
				const deadline = new Date(data.registration_deadline);
				const eventDate = new Date(data.date);
				return deadline < eventDate;
			}
			return true;
		},
		{
			message: 'Registration deadline must be before the event date',
			path: ['registration_deadline'],
		}
	)
	.refine(
		(data) => {
			// Если указаны date и end_date, проверяем что end_date > date
			if (data.date && data.end_date) {
				const startDate = new Date(data.date);
				const endDate = new Date(data.end_date);
				return endDate > startDate;
			}
			return true;
		},
		{
			message: 'End date must be after start date',
			path: ['end_date'],
		}
	);

// ==========================================
// СХЕМЫ ДЛЯ РЕГИСТРАЦИЙ
// ==========================================

/**
 * Схема создания регистрации на мероприятие
 */
export const registrationCreateSchema = z.object({
	// ID мероприятия
	event_id: z.number().int().positive({ message: 'Invalid event ID' }),

	// Дополнительные данные (ответы на дополнительные поля)
	// Валидация конкретных полей происходит отдельно на основе event_additional_fields
	additional_data: z.record(z.string(), z.unknown()).optional(),

	// Подтверждение актуальности данных профиля
	profile_confirmed: z.boolean().refine((val) => val === true, {
		message: 'You must confirm that your profile data is up to date',
	}),
});

/**
 * Схема отмены регистрации
 */
export const registrationCancelSchema = z.object({
	registration_id: z.number().int().positive({ message: 'Invalid registration ID' }),
	cancellation_reason: z.string().trim().optional(),
});

// ==========================================
// СХЕМЫ ДЛЯ АДМИНСКИХ ОПЕРАЦИЙ
// ==========================================

/**
 * Схема отмены мероприятия администратором
 */
export const eventCancelSchema = z.object({
	event_id: z.number().int().positive({ message: 'Invalid event ID' }),
	cancellation_reason: z
		.string()
		.min(10, { message: 'Cancellation reason must be at least 10 characters' })
		.trim(),
});

/**
 * Схема массовой рассылки
 */
export const bulkEmailSchema = z
	.object({
		// ID получателей (пользователи или участники мероприятия)
		recipient_ids: z
			.array(z.number().int().positive())
			.min(1, { message: 'At least one recipient is required' }),

		// Или отправка всем зарегистрированным пользователям
		send_to_all: z.boolean().default(false),

		// Тема письма (на всех языках)
		subject_de: z.string().min(1, { message: 'German subject is required' }).trim(),
		subject_en: z.string().trim().optional(),
		subject_ru: z.string().trim().optional(),
		subject_uk: z.string().trim().optional(),

		// Текст письма (на всех языках)
		body_de: z
			.string()
			.min(10, { message: 'German message body must be at least 10 characters' })
			.trim(),
		body_en: z.string().trim().optional(),
		body_ru: z.string().trim().optional(),
		body_uk: z.string().trim().optional(),
	})
	.refine(
		(data) => {
			// Либо указаны конкретные получатели, либо отправка всем
			return data.recipient_ids.length > 0 || data.send_to_all === true;
		},
		{
			message: 'Either specify recipients or enable send_to_all',
			path: ['recipient_ids'],
		}
	);

// ==========================================
// СХЕМЫ ДЛЯ ОТЗЫВОВ
// ==========================================

/**
 * Схема создания отзыва авторизованным пользователем
 */
export const reviewCreateSchema = z.object({
	// ID мероприятия
	event_id: z.number().int().positive({ message: 'Invalid event ID' }),

	// Оценка от 1 до 10
	rating: z
		.number()
		.int()
		.min(1, { message: 'Rating must be at least 1' })
		.max(10, { message: 'Rating must be at most 10' }),

	// Текст отзыва (10-2000 символов)
	comment: z
		.string()
		.min(10, { message: 'Comment must be at least 10 characters' })
		.max(2000, { message: 'Comment must be at most 2000 characters' })
		.trim(),

	// Флаг анонимности
	is_anonymous: z.boolean().default(false),
});

/**
 * Схема создания отзыва через публичную ссылку
 */
export const publicReviewCreateSchema = z.object({
	// Токен публичной ссылки
	token: z.string().min(1, { message: 'Token is required' }),

	// Оценка от 1 до 10
	rating: z
		.number()
		.int()
		.min(1, { message: 'Rating must be at least 1' })
		.max(10, { message: 'Rating must be at most 10' }),

	// Текст отзыва (10-2000 символов)
	comment: z
		.string()
		.min(10, { message: 'Comment must be at least 10 characters' })
		.max(2000, { message: 'Comment must be at most 2000 characters' })
		.trim(),

	// Флаг анонимности
	is_anonymous: z.boolean().default(false),

	// Отображаемое имя (опционально, максимум 80 символов)
	public_display_name: z
		.string()
		.max(80, { message: 'Display name must be at most 80 characters' })
		.trim()
		.optional()
		.nullable(),
});

/**
 * Схема модерации отзывов
 */
export const reviewModerationSchema = z
	.object({
		// ID отзывов для модерации (если не all_pending)
		review_ids: z.array(z.number().int().positive()).optional(),

		// Модерировать все pending отзывы
		all_pending: z.boolean().optional(),

		// Новый статус
		status: z.enum(['approved', 'rejected'], {
			message: 'Status must be approved or rejected',
		}),
	})
	.refine(
		(data) => {
			// Либо указаны конкретные review_ids, либо all_pending = true
			return (data.review_ids && data.review_ids.length > 0) || data.all_pending === true;
		},
		{
			message: 'Either specify review_ids or set all_pending to true',
			path: ['review_ids'],
		}
	);

/**
 * Схема создания публичной ссылки для отзывов
 */
export const reviewPublicLinkCreateSchema = z.object({
	// ID мероприятия
	event_id: z.number().int().positive({ message: 'Invalid event ID' }),

	// Дата истечения срока действия
	expires_at: z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/, { message: 'Invalid date-time format' })
		.refine(
			(date) => {
				const parsed = new Date(date);
				return !isNaN(parsed.getTime());
			},
			{ message: 'Invalid date' }
		)
		.refine(
			(date) => {
				const parsed = new Date(date);
				return parsed > new Date();
			},
			{ message: 'Expiration date must be in the future' }
		),
});

// ==========================================
// ТИПЫ, ВЫВЕДЕННЫЕ ИЗ СХЕМ
// ==========================================

export type UserRegistrationInput = z.infer<typeof userRegistrationSchema>;
export type UserLoginInput = z.infer<typeof userLoginSchema>;
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;
export type ForgotPasswordRequestInput = z.infer<typeof forgotPasswordRequestSchema>;
export type PasswordResetInput = z.infer<typeof passwordResetSchema>;

export type EventCreateInput = z.infer<typeof eventCreateSchema>;
export type EventUpdateInput = z.infer<typeof eventUpdateSchema>;
export type EventCreateWithFieldsInput = z.infer<typeof eventCreateWithFieldsSchema>;
export type EventUpdateWithFieldsInput = z.infer<typeof eventUpdateWithFieldsSchema>;
export type AdditionalFieldInput = z.infer<typeof additionalFieldSchema>;

export type RegistrationCreateInput = z.infer<typeof registrationCreateSchema>;
export type RegistrationCancelInput = z.infer<typeof registrationCancelSchema>;

export type EventCancelInput = z.infer<typeof eventCancelSchema>;
export type BulkEmailInput = z.infer<typeof bulkEmailSchema>;

export type ReviewCreateInput = z.infer<typeof reviewCreateSchema>;
export type PublicReviewCreateInput = z.infer<typeof publicReviewCreateSchema>;
export type ReviewModerationInput = z.infer<typeof reviewModerationSchema>;
export type ReviewPublicLinkCreateInput = z.infer<typeof reviewPublicLinkCreateSchema>;

// ==========================================
// HELPER ФУНКЦИИ ДЛЯ ЛОКАЛИЗАЦИИ ОШИБОК
// ==========================================

/**
 * Интерфейс для ошибки валидации с локализацией
 */
export interface LocalizedValidationError {
	field: string;
	message: {
		de: string;
		en: string;
		ru: string;
		uk: string;
	};
}

/**
 * Карта переводов ошибок валидации
 */
const errorTranslations: Record<string, { de: string; en: string; ru: string; uk: string }> = {
	'Email is required': {
		de: 'E-Mail ist erforderlich',
		en: 'Email is required',
		ru: 'Email обязателен',
		uk: "Email обов'язковий",
	},
	'Invalid email format': {
		de: 'Ungültiges E-Mail-Format',
		en: 'Invalid email format',
		ru: 'Неверный формат email',
		uk: 'Невірний формат email',
	},
	'Password must be at least 8 characters long': {
		de: 'Das Passwort muss mindestens 8 Zeichen lang sein',
		en: 'Password must be at least 8 characters long',
		ru: 'Пароль должен содержать минимум 8 символов',
		uk: 'Пароль повинен містити мінімум 8 символів',
	},
	'Password must contain both letters and numbers': {
		de: 'Das Passwort muss Buchstaben und Zahlen enthalten',
		en: 'Password must contain both letters and numbers',
		ru: 'Пароль должен содержать буквы и цифры',
		uk: 'Пароль повинен містити літери та цифри',
	},
	'Passwords do not match': {
		de: 'Passwörter stimmen nicht überein',
		en: 'Passwords do not match',
		ru: 'Пароли не совпадают',
		uk: 'Паролі не збігаються',
	},
	'New passwords do not match': {
		de: 'Neue Passwörter stimmen nicht überein',
		en: 'New passwords do not match',
		ru: 'Новые пароли не совпадают',
		uk: 'Нові паролі не збігаються',
	},
	'Token is required': {
		de: 'Token ist erforderlich',
		en: 'Token is required',
		ru: 'Токен обязателен',
		uk: "Токен обов'язковий",
	},
	'This field is required': {
		de: 'Dieses Feld ist erforderlich',
		en: 'This field is required',
		ru: 'Это поле обязательно',
		uk: "Це поле обов'язкове",
	},
	'Name must contain only letters': {
		de: 'Der Name darf nur Buchstaben enthalten',
		en: 'Name must contain only letters',
		ru: 'Имя должно содержать только буквы',
		uk: "Ім'я повинно містити лише літери",
	},
	'Invalid phone number format. Use an international format like +49..., +380..., or 0... for local.':
		{
			de: 'Ungültiges Telefonnummernformat. Verwenden Sie ein internationales Format wie +49..., +380... oder 0... für lokale Nummern.',
			en: 'Invalid phone number format. Use an international format like +49..., +380..., or 0... for local.',
			ru: 'Неверный формат телефона. Используйте международный формат, например +49..., +380... или 0... для местных номеров.',
			uk: 'Невірний формат телефону. Використовуйте міжнародний формат, наприклад +49..., +380... або 0... для місцевих номерів.',
		},
	'ZIP code must be 5 digits': {
		de: 'Die Postleitzahl muss 5 Ziffern haben',
		en: 'ZIP code must be 5 digits',
		ru: 'Индекс должен содержать 5 цифр',
		uk: 'Індекс повинен містити 5 цифр',
	},
	'Parental consent is required for users under 18': {
		de: 'Für Benutzer unter 18 Jahren ist die Zustimmung der Eltern erforderlich',
		en: 'Parental consent is required for users under 18',
		ru: 'Для пользователей младше 18 лет требуется согласие родителей',
		uk: 'Для користувачів молодше 18 років потрібна згода батьків',
	},
	'GDPR consent is required': {
		de: 'DSGVO-Zustimmung ist erforderlich',
		en: 'GDPR consent is required',
		ru: 'Требуется согласие на обработку данных (GDPR)',
		uk: 'Потрібна згода на обробку даних (GDPR)',
	},
	'Birth date cannot be in the future': {
		de: 'Das Geburtsdatum kann nicht in der Zukunft liegen',
		en: 'Birth date cannot be in the future',
		ru: 'Дата рождения не может быть в будущем',
		uk: 'Дата народження не може бути в майбутньому',
	},
	'Date must be in the future': {
		de: 'Das Datum muss in der Zukunft liegen',
		en: 'Date must be in the future',
		ru: 'Дата должна быть в будущем',
		uk: 'Дата повинна бути в майбутньому',
	},
	'Registration deadline must be before the event date': {
		de: 'Die Anmeldefrist muss vor dem Veranstaltungsdatum liegen',
		en: 'Registration deadline must be before the event date',
		ru: 'Срок регистрации должен быть до даты мероприятия',
		uk: 'Термін реєстрації повинен бути до дати заходу',
	},
	'You must confirm that your profile data is up to date': {
		de: 'Sie müssen bestätigen, dass Ihre Profildaten aktuell sind',
		en: 'You must confirm that your profile data is up to date',
		ru: 'Вы должны подтвердить, что данные вашего профиля актуальны',
		uk: 'Ви повинні підтвердити, що дані вашого профілю актуальні',
	},
	'German title is required': {
		de: 'Deutscher Titel ist erforderlich',
		en: 'German title is required',
		ru: 'Требуется название на немецком',
		uk: 'Потрібна назва німецькою',
	},
	'Field key is required': {
		de: 'Feldschlüssel ist erforderlich',
		en: 'Field key is required',
		ru: 'Требуется ключ поля',
		uk: 'Потрібен ключ поля',
	},
	'Field key must be in snake_case format': {
		de: 'Feldschlüssel muss im snake_case-Format sein',
		en: 'Field key must be in snake_case format',
		ru: 'Ключ поля должен быть в формате snake_case',
		uk: 'Ключ поля повинен бути у форматі snake_case',
	},
	'At least one option is required for select fields': {
		de: 'Mindestens eine Option ist für Auswahlfelder erforderlich',
		en: 'At least one option is required for select fields',
		ru: 'Требуется хотя бы один вариант для полей выбора',
		uk: 'Потрібен хоча б один варіант для полів вибору',
	},
	'Options are required for select fields': {
		de: 'Optionen sind für Auswahlfelder erforderlich',
		en: 'Options are required for select fields',
		ru: 'Для полей выбора требуются варианты',
		uk: 'Для полів вибору потрібні варіанти',
	},
	'German label is required': {
		de: 'Deutsche Bezeichnung ist erforderlich',
		en: 'German label is required',
		ru: 'Требуется метка на немецком',
		uk: 'Потрібна мітка німецькою',
	},
	'Invalid event ID': {
		de: 'Ungültige Veranstaltungs-ID',
		en: 'Invalid event ID',
		ru: 'Неверный ID мероприятия',
		uk: 'Невірний ID заходу',
	},
	'Invalid registration ID': {
		de: 'Ungültige Registrierungs-ID',
		en: 'Invalid registration ID',
		ru: 'Неверный ID регистрации',
		uk: 'Невірний ID реєстрації',
	},
	'Must be an integer': {
		de: 'Muss eine Ganzzahl sein',
		en: 'Must be an integer',
		ru: 'Должно быть целым числом',
		uk: 'Повинно бути цілим числом',
	},
	'Must be greater than 0': {
		de: 'Muss größer als 0 sein',
		en: 'Must be greater than 0',
		ru: 'Должно быть больше 0',
		uk: 'Повинно бути більше 0',
	},
	'At least 1 participant is required': {
		de: 'Mindestens 1 Teilnehmer ist erforderlich',
		en: 'At least 1 participant is required',
		ru: 'Требуется минимум 1 участник',
		uk: 'Потрібен мінімум 1 учасник',
	},
	'Maximum 1000 participants allowed': {
		de: 'Maximal 1000 Teilnehmer erlaubt',
		en: 'Maximum 1000 participants allowed',
		ru: 'Максимум 1000 участников',
		uk: 'Максимум 1000 учасників',
	},
	// Review validation messages
	'Rating must be at least 1': {
		de: 'Die Bewertung muss mindestens 1 sein',
		en: 'Rating must be at least 1',
		ru: 'Оценка должна быть не менее 1',
		uk: 'Оцінка повинна бути не менше 1',
	},
	'Rating must be at most 10': {
		de: 'Die Bewertung darf maximal 10 sein',
		en: 'Rating must be at most 10',
		ru: 'Оценка должна быть не более 10',
		uk: 'Оцінка повинна бути не більше 10',
	},
	'Comment must be at least 10 characters': {
		de: 'Der Kommentar muss mindestens 10 Zeichen lang sein',
		en: 'Comment must be at least 10 characters',
		ru: 'Комментарий должен содержать минимум 10 символов',
		uk: 'Коментар повинен містити мінімум 10 символів',
	},
	'Comment must be at most 2000 characters': {
		de: 'Der Kommentar darf maximal 2000 Zeichen lang sein',
		en: 'Comment must be at most 2000 characters',
		ru: 'Комментарий должен содержать максимум 2000 символов',
		uk: 'Коментар повинен містити максимум 2000 символів',
	},
	'Display name must be at most 80 characters': {
		de: 'Der Anzeigename darf maximal 80 Zeichen lang sein',
		en: 'Display name must be at most 80 characters',
		ru: 'Отображаемое имя должно содержать максимум 80 символов',
		uk: "Відображуване ім'я повинно містити максимум 80 символів",
	},
	'Status must be approved or rejected': {
		de: 'Status muss genehmigt oder abgelehnt sein',
		en: 'Status must be approved or rejected',
		ru: 'Статус должен быть одобрен или отклонен',
		uk: 'Статус повинен бути схвалено або відхилено',
	},
	'Either specify review_ids or set all_pending to true': {
		de: 'Geben Sie entweder review_ids an oder setzen Sie all_pending auf true',
		en: 'Either specify review_ids or set all_pending to true',
		ru: 'Укажите review_ids или установите all_pending в true',
		uk: 'Вкажіть review_ids або встановіть all_pending в true',
	},
	'Expiration date must be in the future': {
		de: 'Das Ablaufdatum muss in der Zukunft liegen',
		en: 'Expiration date must be in the future',
		ru: 'Дата истечения должна быть в будущем',
		uk: 'Дата закінчення повинна бути в майбутньому',
	},
};

/**
 * Переводит ошибку валидации на все поддерживаемые языки
 */
export function translateValidationError(error: string): {
	de: string;
	en: string;
	ru: string;
	uk: string;
} {
	return (
		errorTranslations[error] || {
			de: error,
			en: error,
			ru: error,
			uk: error,
		}
	);
}

/**
 * Форматирует ошибки Zod в локализованный формат
 */
export function formatZodErrors(errors: z.ZodError): LocalizedValidationError[] {
	return errors.issues.map((err) => ({
		field: err.path.join('.'),
		message: translateValidationError(err.message),
	}));
}

/**
 * Валидирует данные с помощью Zod схемы и возвращает локализованные ошибки
 */
export function validateWithLocalization<T>(
	schema: z.ZodSchema<T>,
	data: unknown
): { success: true; data: T } | { success: false; errors: LocalizedValidationError[] } {
	const result = schema.safeParse(data);

	if (result.success) {
		return { success: true, data: result.data };
	}

	return {
		success: false,
		errors: formatZodErrors(result.error),
	};
}
