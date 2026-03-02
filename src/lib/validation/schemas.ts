/**
 * Client-side Validation Schemas
 * Общие схемы валидации для клиента и сервера
 *
 * Этот модуль доступен как для браузерного кода, так и для серверных эндпоинтов.
 * Не содержит серверной логики, только Zod схемы.
 */

import { z } from 'zod';

// ==========================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ==========================================

/**
 * Вычисляет возраст на основе даты рождения
 */
export function calculateAge(birthDate: string): number {
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
 * Проверяет формат телефонного номера для опекуна (расширенная валидация)
 * Разрешены форматы: +49... (Германия), +38... (Украина), +7... (Россия), 0... (локальный немецкий)
 * Также разрешены номера стран ЕС
 */
function isValidGuardianPhone(phone: string): boolean {
	// Удаляем пробелы и дефисы для проверки
	const cleaned = phone.replace(/[\s\-]/g, '');

	// Разрешаем немецкие номера (локальные и международные)
	if (/^(\+49|0)\d{9,}$/.test(cleaned)) {
		return true;
	}

	// Разрешаем украинские номера (+380...)
	if (/^\+380\d{9}$/.test(cleaned)) {
		return true;
	}

	// Разрешаем российские номера (+7...)
	if (/^\+7\d{10}$/.test(cleaned)) {
		return true;
	}

	// Разрешаем номера других стран ЕС (упрощенная проверка: +XX где XX = 2-3 цифры, затем минимум 9 цифр)
	if (/^\+\d{2,3}\d{9,}$/.test(cleaned)) {
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

// ==========================================
// БАЗОВЫЕ СХЕМЫ (ПЕРЕИСПОЛЬЗУЕМЫЕ)
// ==========================================

/**
 * Схема для email адреса
 */
const emailSchema = z
	.string()
	.min(1, { message: 'validation.emailRequired' })
	.email({ message: 'validation.emailInvalid' })
	.toLowerCase()
	.trim();

/**
 * Схема для пароля
 */
const passwordSchema = z
	.string()
	.min(8, { message: 'validation.passwordMinLength' });

/**
 * Схема для имени/фамилии
 */
const nameSchema = z
	.string()
	.min(1, { message: 'validation.fieldRequired' })
	.max(100, { message: 'validation.nameMaxLength' })
	.trim()
	.refine(isOnlyLetters, {
		message: 'validation.nameOnlyLetters',
	});

/**
 * Схема для даты рождения
 */
const birthDateSchema = z
	.string()
	.regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'validation.dateFormat' })
	.refine(
		(date) => {
			const parsed = new Date(date);
			return !isNaN(parsed.getTime());
		},
		{ message: 'validation.dateInvalid' }
	)
	.refine(
		(date) => {
			const parsed = new Date(date);
			return parsed < new Date();
		},
		{ message: 'validation.dateFuture' }
	)
	.refine(
		(date) => {
			const age = calculateAge(date);
			return age >= 10 && age <= 100;
		},
		{ message: 'validation.ageRange' }
	);

/**
 * Схема для телефона
 */
const phoneSchema = z
	.string()
	.min(1, { message: 'validation.phoneRequired' })
	.trim()
	.refine(isValidPhone, {
		message: 'validation.phoneInvalid',
	});

/**
 * Схема для опционального телефона (WhatsApp, Telegram)
 */
const optionalPhoneSchema = z
	.string()
	.trim()
	.refine((val) => val === '' || isValidPhone(val), {
		message: 'validation.phoneInvalid',
	})
	.optional()
	.or(z.literal(''));

/**
 * Схема для почтового индекса
 */
const zipSchema = z
	.string()
	.min(1, { message: 'validation.zipRequired' })
	.refine(isValidGermanZip, {
		message: 'validation.zipInvalid',
	});

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
		password_confirm: z.string().min(1, { message: 'validation.passwordConfirmRequired' }),

		// Личные данные
		first_name: nameSchema,
		last_name: nameSchema,
		birth_date: birthDateSchema,

		// Адрес
		address_street: z.string().min(1, { message: 'validation.streetRequired' }).trim(),
		address_number: z.string().min(1, { message: 'validation.houseNumberRequired' }).trim(),
		address_zip: zipSchema,
		address_city: z.string().min(1, { message: 'validation.cityRequired' }).trim(),

		// Контакты
		phone: phoneSchema,
		whatsapp: optionalPhoneSchema,
		telegram: z.string().trim().optional(),

		// Данные опекуна (для несовершеннолетних)
		guardian_first_name: z.string().trim().optional(),
		guardian_last_name: z.string().trim().optional(),
		guardian_phone: z.string().trim().optional(),
		guardian_consent: z.boolean().optional(),

		// Согласия
		photo_video_consent: z.boolean(),
		parental_consent: z.boolean(),
		gdpr_consent: z.boolean(),

		// Предпочтения
		preferred_language: z.enum(['de', 'en', 'ru', 'uk']).default('de'),
	})
	.refine((data) => data.password === data.password_confirm, {
		message: 'validation.passwordMismatch',
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
			message: 'validation.parentalConsentRequired',
			path: ['parental_consent'],
		}
	)
	.refine(
		(data) => {
			const age = calculateAge(data.birth_date);
			// Если возраст < 18, то все поля опекуна должны быть заполнены
			if (age < 18) {
				return (
					data.guardian_first_name &&
					data.guardian_first_name.trim().length > 0 &&
					data.guardian_last_name &&
					data.guardian_last_name.trim().length > 0 &&
					data.guardian_phone &&
					data.guardian_phone.trim().length > 0
				);
			}
			return true;
		},
		{
			message: 'validation.guardianDataRequired',
			path: ['guardian_first_name'],
		}
	)
	.refine(
		(data) => {
			const age = calculateAge(data.birth_date);
			// Если возраст < 18 и указан телефон опекуна, проверяем формат
			if (age < 18 && data.guardian_phone && data.guardian_phone.trim().length > 0) {
				return isValidGuardianPhone(data.guardian_phone);
			}
			return true;
		},
		{
			message: 'validation.guardianPhoneInvalid',
			path: ['guardian_phone'],
		}
	)
	.refine(
		(data) => {
			const age = calculateAge(data.birth_date);
			// Если возраст < 18, то guardian_consent должно быть true
			if (age < 18) {
				return data.guardian_consent === true;
			}
			return true;
		},
		{
			message: 'validation.guardianConsentRequired',
			path: ['guardian_consent'],
		}
	)
	.refine((data) => data.gdpr_consent === true, {
		message: 'validation.gdprConsentRequired',
		path: ['gdpr_consent'],
	});

/**
 * Схема входа в систему
 */
export const userLoginSchema = z.object({
	email: emailSchema,
	password: z.string().min(1, { message: 'validation.passwordRequired' }),
});

/**
 * Схема запроса на восстановление пароля
 */
export const forgotPasswordRequestSchema = z.object({
	email: emailSchema,
});

/**
 * Схема обновления профиля пользователя
 * Все поля опциональны, валидация применяется только к заполненным
 */
export const userUpdateSchema = z
	.object({
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

		// Согласия
		photo_video_consent: z.boolean().optional(),

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
			message: 'validation.currentPasswordRequired',
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
			message: 'validation.newPasswordMismatch',
			path: ['new_password_confirm'],
		}
	);

// ==========================================
// ТИПЫ, ВЫВЕДЕННЫЕ ИЗ СХЕМ
// ==========================================

export type UserRegistrationInput = z.infer<typeof userRegistrationSchema>;
export type UserLoginInput = z.infer<typeof userLoginSchema>;
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;
export type ForgotPasswordRequestInput = z.infer<typeof forgotPasswordRequestSchema>;
