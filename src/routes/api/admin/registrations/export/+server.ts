import { error } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { requireAdmin } from '$lib/server/middleware/admin';
import { getDB } from '$lib/server/db';

/**
 * Calculate age in full years at a given reference date.
 * Both dates should be in YYYY-MM-DD format.
 * Returns null if either date is invalid or missing.
 */
function calculateAgeAtDate(
	birthDateStr: string | null | undefined,
	refDateStr: string | null | undefined
): number | null {
	if (!birthDateStr || !refDateStr) return null;

	// Parse YYYY-MM-DD (take only first 10 chars in case of datetime)
	const birthPart = birthDateStr.slice(0, 10);
	const refPart = refDateStr.slice(0, 10);

	const birthMatch = birthPart.match(/^(\d{4})-(\d{2})-(\d{2})$/);
	const refMatch = refPart.match(/^(\d{4})-(\d{2})-(\d{2})$/);

	if (!birthMatch || !refMatch) return null;

	const birthYear = parseInt(birthMatch[1], 10);
	const birthMonth = parseInt(birthMatch[2], 10);
	const birthDay = parseInt(birthMatch[3], 10);

	const refYear = parseInt(refMatch[1], 10);
	const refMonth = parseInt(refMatch[2], 10);
	const refDay = parseInt(refMatch[3], 10);

	let age = refYear - birthYear;

	// Check if birthday has not occurred yet in the reference year
	if (refMonth < birthMonth || (refMonth === birthMonth && refDay < birthDay)) {
		age--;
	}

	return age >= 0 ? age : null;
}

export const GET: RequestHandler = async ({ url, platform, locals }) => {
	// Проверка прав администратора
	const adminCheck = await requireAdmin(platform, locals);
	if (!adminCheck.success) {
		throw error(403, adminCheck.error || 'Access denied');
	}

	const db = getDB(platform);

	// Получение параметров фильтрации из URL (те же что и на странице)
	const eventId = url.searchParams.get('eventId');
	const status = url.searchParams.get('status');
	const dateFrom = url.searchParams.get('dateFrom');
	const dateTo = url.searchParams.get('dateTo');
	const language = (url.searchParams.get('language') || 'de') as 'de' | 'en' | 'ru' | 'uk';

	// Мультиязычные статусы
	const statusTranslations = {
		active: {
			de: 'Aktiv',
			en: 'Active',
			ru: 'Активна',
			uk: 'Активна',
		},
		cancelled: {
			de: 'Storniert',
			en: 'Cancelled',
			ru: 'Отменена',
			uk: 'Скасована',
		},
	};

	// Построение WHERE условий
	const conditions: string[] = [];
	const params: any[] = [];

	if (eventId && eventId !== 'all') {
		conditions.push('r.event_id = ?');
		params.push(parseInt(eventId, 10));
	}

	if (status === 'active') {
		conditions.push('r.cancelled_at IS NULL');
	} else if (status === 'cancelled') {
		conditions.push('r.cancelled_at IS NOT NULL');
	}

	if (dateFrom) {
		conditions.push('DATE(r.registered_at) >= ?');
		params.push(dateFrom);
	}

	if (dateTo) {
		conditions.push('DATE(r.registered_at) <= ?');
		params.push(dateTo);
	}

	const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

	// Получение всех регистраций (без пагинации для экспорта)
	const query = `
		SELECT 
			r.id,
			u.first_name,
			u.last_name,
			u.email,
			u.phone,
			u.address_street,
			u.address_number,
			u.address_zip,
			u.address_city,
			u.birth_date,
			e.title_de,
			e.date as event_date,
			r.registered_at,
			r.cancelled_at,
			r.cancellation_reason,
			r.additional_data
		FROM registrations r
		INNER JOIN users u ON r.user_id = u.id
		INNER JOIN events e ON r.event_id = e.id
		${whereClause}
		ORDER BY r.registered_at DESC
	`;

	const result = await db
		.prepare(query)
		.bind(...params)
		.all<any>();
	const registrations = result.results || [];

	// Формирование CSV
	const headers = [
		'ID',
		'First Name',
		'Last Name',
		'Email',
		'Phone',
		'Address Street',
		'Address Number',
		'Address ZIP',
		'Address City',
		'Age',
		'Event',
		'Event Date',
		'Registered At',
		'Status',
		'Cancelled At',
		'Cancellation Reason',
		'Additional Data',
	];

	const csvRows = [headers.join(',')];

	for (const reg of registrations) {
		const statusText = reg.cancelled_at
			? statusTranslations.cancelled[language]
			: statusTranslations.active[language];

		const age = calculateAgeAtDate(reg.birth_date, reg.event_date);

		const row = [
			reg.id,
			escapeCsvValue(reg.first_name),
			escapeCsvValue(reg.last_name),
			escapeCsvValue(reg.email),
			escapeCsvValue(reg.phone || ''),
			escapeCsvValue(reg.address_street || ''),
			escapeCsvValue(reg.address_number || ''),
			escapeCsvValue(reg.address_zip || ''),
			escapeCsvValue(reg.address_city || ''),
			age !== null ? age : '',
			escapeCsvValue(reg.title_de),
			reg.event_date,
			reg.registered_at,
			statusText,
			reg.cancelled_at || '',
			escapeCsvValue(reg.cancellation_reason || ''),
			escapeCsvValue(reg.additional_data || ''),
		];
		csvRows.push(row.join(','));
	}

	const csvContent = csvRows.join('\n');

	// Возврат CSV файла
	return new Response(csvContent, {
		headers: {
			'Content-Type': 'text/csv; charset=utf-8',
			'Content-Disposition': `attachment; filename="registrations_export_${new Date().toISOString().split('T')[0]}.csv"`,
		},
	});
};

// Функция для экранирования значений CSV
function escapeCsvValue(value: string | null | undefined): string {
	if (!value) return '';
	const str = String(value);
	// Если содержит запятую, кавычки или перенос строки - оборачиваем в кавычки
	if (str.includes(',') || str.includes('"') || str.includes('\n')) {
		return `"${str.replace(/"/g, '""')}"`;
	}
	return str;
}
