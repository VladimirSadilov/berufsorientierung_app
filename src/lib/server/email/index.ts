/**
 * Email Transport Module
 *
 * Модуль для отправки email через MailChannels HTTP API
 *
 * Функционал:
 * - Отправка одиночных писем (sendEmail)
 * - Массовая отправка с батчингом (sendBulkEmails)
 * - Поддержка DKIM подписи
 * - Логирование успехов/ошибок
 *
 * Провайдер: MailChannels (https://api.mailchannels.net/tx/v1/send)
 */

/**
 * Структура DKIM конфигурации
 */
interface DKIMConfig {
	domain: string;
	selector: string;
	privateKey: string;
}

/**
 * Структура payload для MailChannels API
 */
interface MailChannelsPayload {
	personalizations: Array<{
		to: Array<{ email: string; name?: string }>;
	}>;
	from: {
		email: string;
		name?: string;
	};
	subject: string;
	content: Array<{
		type: string;
		value: string;
	}>;
	headers?: {
		'Reply-To'?: string;
	};
}

/**
 * Расширенный payload с DKIM
 */
interface MailChannelsPayloadWithDKIM extends MailChannelsPayload {
	personalizations: Array<{
		to: Array<{ email: string; name?: string }>;
		dkim_domain?: string;
		dkim_selector?: string;
		dkim_private_key?: string;
	}>;
}

/**
 * Результат отправки email
 */
interface SendEmailResult {
	success: boolean;
	error?: string;
}

/**
 * Результат массовой отправки
 */
export interface BulkEmailResult {
	success: number;
	failed: number;
	errors: string[];
}

/**
 * Парсинг email адреса формата "Name <email@example.com>" или "email@example.com"
 */
function parseEmailAddress(emailString: string): { email: string; name?: string } {
	const match = emailString.match(/^(.+?)\s*<(.+?)>$/);
	if (match) {
		return {
			name: match[1].trim(),
			email: match[2].trim(),
		};
	}
	return { email: emailString.trim() };
}

/**
 * Получение DKIM конфигурации из environment variables
 * Форматирует приватный ключ для MailChannels API
 */
function getDKIMConfig(env: App.Platform['env']): DKIMConfig | null {
	const domain = env.DKIM_DOMAIN;
	const selector = env.DKIM_SELECTOR;
	let privateKey = env.DKIM_PRIVATE_KEY;

	if (!domain || !selector || !privateKey) {
		console.warn('[Email] DKIM not configured - emails may be marked as spam');
		return null;
	}

	// MailChannels требует ключ БЕЗ заголовков BEGIN/END и в одну строку с \n
	// Удаляем заголовки и лишние пробелы
	privateKey = privateKey
		.replace(/-----BEGIN (RSA )?PRIVATE KEY-----/g, '')
		.replace(/-----END (RSA )?PRIVATE KEY-----/g, '')
		.replace(/\\n/g, '\n') // Заменяем экранированные \n на настоящие
		.trim();

	// Убираем все переносы строк и пробелы, затем разбиваем на строки по 64 символа
	// и склеиваем обратно с \n (стандарт PEM формата)
	const cleanKey = privateKey.replace(/\s+/g, '');
	const formattedKey = cleanKey.match(/.{1,64}/g)?.join('\n') || cleanKey;

	return { domain, selector, privateKey: formattedKey };
}

/**
 * Отправка email через MailChannels API
 * Внутренняя функция для MailChannels провайдера
 */
async function sendEmailViaMailChannels(
	to: string,
	subject: string,
	text: string,
	env: App.Platform['env']
): Promise<void> {
	const MAILCHANNELS_ENDPOINT = 'https://api.mailchannels.net/tx/v1/send';

	// Парсинг FROM адреса
	const from = parseEmailAddress(env.EMAIL_FROM);

	// Парсинг TO адреса
	const toAddress = parseEmailAddress(to);

	// Базовый payload
	const payload: MailChannelsPayloadWithDKIM = {
		personalizations: [
			{
				to: [toAddress],
			},
		],
		from,
		subject,
		content: [
			{
				type: 'text/plain',
				value: text,
			},
		],
	};

	// Добавляем Reply-To если задан
	if (env.EMAIL_REPLY_TO) {
		payload.headers = {
			'Reply-To': env.EMAIL_REPLY_TO,
		};
	}

	// Добавляем DKIM если настроен
	const dkimConfig = getDKIMConfig(env);
	if (dkimConfig) {
		payload.personalizations[0].dkim_domain = dkimConfig.domain;
		payload.personalizations[0].dkim_selector = dkimConfig.selector;
		payload.personalizations[0].dkim_private_key = dkimConfig.privateKey;
	}

	// Отправка через MailChannels
	try {
		const response = await fetch(MAILCHANNELS_ENDPOINT, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(payload),
		});

		if (!response.ok) {
			const errorText = await response.text();
			console.error('[Email] MailChannels error:', {
				status: response.status,
				statusText: response.statusText,
				body: errorText,
				to,
				subject,
			});
			throw new Error(`Failed to send email: ${response.status} ${response.statusText}`);
		}

		console.log('[Email] Successfully sent to:', to);
	} catch (error) {
		console.error('[Email] Failed to send email:', error);
		throw error;
	}
}

/**
 * Отправка email через Resend API
 * Внутренняя функция для Resend провайдера
 */
async function sendEmailViaResend(
	to: string,
	subject: string,
	text: string,
	env: App.Platform['env']
): Promise<void> {
	const RESEND_ENDPOINT = 'https://api.resend.com/emails';

	// Проверка наличия API ключа
	if (!env.RESEND_API_KEY) {
		throw new Error('[Email][Resend] RESEND_API_KEY not configured');
	}

	// Парсинг и валидация email получателя
	const toAddress = parseEmailAddress(to);
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

	if (!emailRegex.test(toAddress.email)) {
		console.warn('[Email][Resend] Invalid email format:', toAddress.email);
		throw new Error(
			`[Email][Resend] Некорректный формат email адреса получателя: ${toAddress.email}`
		);
	}

	// Формирование payload для Resend API
	const payload = {
		from: env.EMAIL_FROM, // Resend принимает строку "Name <email@example.com>"
		to: [toAddress.email], // Массив из одного email без имени
		subject,
		text,
	};

	// Отправка через Resend
	try {
		const response = await fetch(RESEND_ENDPOINT, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${env.RESEND_API_KEY}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(payload),
		});

		if (!response.ok) {
			const errorText = await response.text();
			console.error('[Email][Resend] Resend error:', {
				status: response.status,
				statusText: response.statusText,
				body: errorText,
				to: toAddress.email,
				subject,
			});
			throw new Error(
				`Failed to send email via Resend: ${response.status} ${response.statusText}`
			);
		}

		console.log('[Email][Resend] Successfully sent to:', toAddress.email);
	} catch (error) {
		console.error('[Email][Resend] Failed to send email:', error);
		throw error;
	}
}

/**
 * Local development email provider.
 * It deliberately avoids external API calls and writes the message to the server log.
 */
async function sendEmailViaNoop(
	to: string,
	subject: string,
	text: string,
	env: App.Platform['env']
): Promise<void> {
	console.log('[Email][Noop] Email skipped:', {
		to,
		subject,
	});

	if (env.EMAIL_NOOP_LOG_BODY === 'true') {
		console.log(`[Email][Noop] Body:\n${text}`);
	}
}

/**
 * Отправка одиночного email
 *
 * Универсальная функция отправки, которая автоматически выбирает провайдера
 * на основе переменной окружения EMAIL_PROVIDER.
 *
 * @param to - Email получателя
 * @param subject - Тема письма
 * @param text - Текст письма (plain text)
 * @param env - Environment variables (Cloudflare Workers)
 *
 * ⚠️ ВАЖНО: env параметр обязателен (Cloudflare Workers best practice)
 * В Workers окружении нет глобального process.env, поэтому env передаётся явно
 * через event.platform.env из RequestEvent. Это делает функцию чистой и тестируемой.
 *
 * @returns Promise<void>
 *
 * @throws Error если отправка не удалась
 *
 * Поддерживаемые провайдеры (env.EMAIL_PROVIDER):
 * - mailchannels (по умолчанию) - через Cloudflare Workers
 * - resend - через Resend API
 *
 * @example
 * // В API route (SvelteKit)
 * export async function POST({ platform }: RequestEvent) {
 *   await sendEmail(
 *     'user@example.com',
 *     'Welcome!',
 *     'Hello, welcome to our platform!',
 *     platform!.env
 *   );
 * }
 */
export async function sendEmail(
	to: string,
	subject: string,
	text: string,
	env: App.Platform['env']
): Promise<void> {
	// Переключатель провайдера email на основе настроек окружения
	const provider = (env.EMAIL_PROVIDER || 'mailchannels').toLowerCase();

	if (provider === 'mailchannels') {
		return sendEmailViaMailChannels(to, subject, text, env);
	}

	if (provider === 'resend') {
		return sendEmailViaResend(to, subject, text, env);
	}

	if (provider === 'noop') {
		return sendEmailViaNoop(to, subject, text, env);
	}

	// Неподдерживаемый провайдер
	throw new Error(`[Email] Unsupported EMAIL_PROVIDER: ${provider}`);
}

/**
 * Вспомогательная функция для отправки одного email с обработкой ошибок
 * (не бросает исключение, возвращает результат)
 */
async function sendSingleEmail(
	to: string,
	subject: string,
	text: string,
	env: App.Platform['env']
): Promise<SendEmailResult> {
	try {
		await sendEmail(to, subject, text, env);
		return { success: true };
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		return {
			success: false,
			error: `${to}: ${errorMessage}`,
		};
	}
}

/**
 * Пауза (для батчинга)
 */
function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Массовая отправка email с батчингом
 *
 * Отправляет письма порциями (чанками) с паузами между ними,
 * чтобы не превысить лимиты API и не создать чрезмерную нагрузку.
 *
 * @param recipients - Массив email адресов получателей
 * @param subject - Тема письма
 * @param text - Текст письма (plain text)
 * @param env - Environment variables (Cloudflare Workers)
 *
 * ⚠️ ВАЖНО: env параметр обязателен (Cloudflare Workers best practice)
 * В Workers окружении нет глобального process.env, поэтому env передаётся явно
 * через event.platform.env из RequestEvent.
 *
 * @returns Promise<BulkEmailResult> - Детальная статистика отправки:
 *   - success: количество успешных отправок
 *   - failed: количество неудачных отправок
 *   - errors: массив строк с описанием ошибок
 *
 * Параметры батчинга (из env):
 * - EMAIL_BULK_CHUNK (default: 50) - размер одного чанка
 * - EMAIL_BULK_PAUSE_MS (default: 60000 = 1 минута) - пауза между чанками в мс
 *
 * 💡 Рекомендация: используйте консервативные значения (50 писем с паузой 1 мин)
 * для максимальной надёжности и избежания попадания в blacklist.
 *
 * @example
 * // В API route
 * export async function POST({ platform }: RequestEvent) {
 *   const result = await sendBulkEmails(
 *     ['user1@example.com', 'user2@example.com'],
 *     'Newsletter',
 *     'Hello everyone!',
 *     platform!.env
 *   );
 *   console.log(`Sent: ${result.success}, Failed: ${result.failed}`);
 *   if (result.errors.length > 0) {
 *     console.error('Errors:', result.errors);
 *   }
 * }
 */
export async function sendBulkEmails(
	recipients: string[],
	subject: string,
	text: string,
	env: App.Platform['env']
): Promise<BulkEmailResult> {
	// Параметры батчинга (консервативные дефолты для надёжности)
	const chunkSize = parseInt(env.EMAIL_BULK_CHUNK || '50', 10);
	const pauseMs = parseInt(env.EMAIL_BULK_PAUSE_MS || '60000', 10);

	console.log('[Email Bulk] Starting bulk send:', {
		totalRecipients: recipients.length,
		chunkSize,
		pauseMs,
		subject,
	});

	let successCount = 0;
	let failedCount = 0;
	const errors: string[] = [];

	// Разбиваем на чанки
	for (let i = 0; i < recipients.length; i += chunkSize) {
		const chunk = recipients.slice(i, i + chunkSize);
		const chunkNumber = Math.floor(i / chunkSize) + 1;
		const totalChunks = Math.ceil(recipients.length / chunkSize);

		console.log(
			`[Email Bulk] Processing chunk ${chunkNumber}/${totalChunks} (${chunk.length} emails)`
		);

		// Отправляем все письма в чанке параллельно
		const results = await Promise.all(
			chunk.map((recipient) => sendSingleEmail(recipient, subject, text, env))
		);

		// Подсчёт результатов
		for (const result of results) {
			if (result.success) {
				successCount++;
			} else {
				failedCount++;
				if (result.error) {
					errors.push(result.error);
				}
			}
		}

		console.log(`[Email Bulk] Chunk ${chunkNumber}/${totalChunks} completed:`, {
			success: results.filter((r) => r.success).length,
			failed: results.filter((r) => !r.success).length,
		});

		// Пауза между чанками (кроме последнего)
		if (i + chunkSize < recipients.length) {
			console.log(`[Email Bulk] Pausing for ${pauseMs}ms before next chunk...`);
			await sleep(pauseMs);
		}
	}

	console.log('[Email Bulk] Bulk send completed:', {
		total: recipients.length,
		success: successCount,
		failed: failedCount,
	});

	return {
		success: successCount,
		failed: failedCount,
		errors,
	};
}

/**
 * Безопасная отправка email с логированием ошибок
 *
 * Обёртка для любой email операции, которая:
 * - Перехватывает ошибки и НЕ бросает их дальше
 * - Логирует контекст и детали ошибки
 * - Позволяет продолжить выполнение даже если email failed
 *
 * 💡 Используйте для всех email отправок в критичных операциях
 * (регистрация, запись на мероприятие и т.д.), чтобы ошибка email
 * не блокировала основной функционал.
 *
 * @param fn - Асинхронная функция отправки email
 * @param context - Описание операции для лога (например: "Welcome email after registration")
 *
 * @example
 * await sendEmailSafely(
 *   () => sendWelcomeEmail(user, 'de', platform!.env),
 *   'Welcome email after registration'
 * );
 */
export async function sendEmailSafely(fn: () => Promise<void>, context: string): Promise<void> {
	try {
		await fn();
		console.log(`[Email Safe] Success: ${context}`);
	} catch (error) {
		// Логируем ошибку, но НЕ бросаем её дальше
		console.error(`[Email Safe] Failed: ${context}`, {
			error: error instanceof Error ? error.message : String(error),
			stack: error instanceof Error ? error.stack : undefined,
		});
	}
}

/**
 * Экспорт типов для использования в других модулях
 */
export type { SendEmailResult, DKIMConfig };
