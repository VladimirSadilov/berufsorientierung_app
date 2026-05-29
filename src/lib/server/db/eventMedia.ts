/**
 * Database utilities - Event media
 * Read helpers for homepage media, Rueckblick media, and event media cleanup.
 */

import type { D1Database } from '@cloudflare/workers-types';
import type {
	MediaSettings,
	PublicEventMedia,
	RueckblickMediaFilters,
	RueckblickSort,
} from '$lib/types/eventMedia';

const DEFAULT_HOMEPAGE_MAX_IMAGES = 300;
const DEFAULT_HOMEPAGE_MAX_VIDEOS = 30;
const MAX_HOMEPAGE_IMAGES = 300;
const MAX_HOMEPAGE_VIDEOS = 30;
const DEFAULT_RUECKBLICK_LIMIT = 24;
const MAX_RUECKBLICK_LIMIT = 60;

const PUBLIC_MEDIA_SELECT = `
	em.id,
	em.event_id,
	em.media_scope,
	em.media_type,
	em.public_url,
	em.thumbnail_url,
	em.mime_type,
	em.duration_seconds,
	em.width,
	em.height,
	em.alt_text,
	em.captured_at
`;

const RUECKBLICK_EFFECTIVE_DATE_SQL = `COALESCE(
	datetime(NULLIF(em.captured_at, '')),
	datetime(e.date),
	datetime(em.created_at)
)`;

const HOMEPAGE_EFFECTIVE_DATE_SQL = `COALESCE(
	datetime(NULLIF(captured_at, '')),
	datetime(created_at)
)`;

type QueryParam = string | number;

interface HomepageMediaRow extends PublicEventMedia {
	created_at: string;
}

export interface RueckblickEvent {
	id: number;
	title_de: string;
	title_en: string | null;
	title_ru: string | null;
	title_uk: string | null;
	date: string;
}

function clampSetting(value: unknown, defaultValue: number, max: number): number {
	const numeric = Number(value);
	if (!Number.isFinite(numeric)) {
		return defaultValue;
	}

	return Math.min(max, Math.max(0, Math.trunc(numeric)));
}

function normalizeLimit(value: unknown): number {
	const numeric = Number(value);
	if (!Number.isFinite(numeric) || numeric <= 0) {
		return DEFAULT_RUECKBLICK_LIMIT;
	}

	return Math.min(MAX_RUECKBLICK_LIMIT, Math.trunc(numeric));
}

function normalizeOffset(value: unknown): number {
	const numeric = Number(value);
	if (!Number.isFinite(numeric) || numeric < 0) {
		return 0;
	}

	return Math.trunc(numeric);
}

function publicMediaConstraintsSql(alias = ''): string {
	const prefix = alias ? `${alias}.` : '';

	return `
		(
			(${prefix}media_type = 'image'
				AND ${prefix}mime_type IN ('image/jpeg', 'image/png', 'image/webp')
				AND ${prefix}size_bytes <= 3145728
				AND ${prefix}duration_seconds IS NULL)
			OR
			(${prefix}media_type = 'video'
				AND ${prefix}mime_type IN ('video/mp4', 'video/webm')
				AND ${prefix}size_bytes <= 31457280
				AND ${prefix}duration_seconds IS NOT NULL
				AND ${prefix}duration_seconds > 0
				AND ${prefix}duration_seconds <= 10)
		)
	`;
}

function normalizeEventId(value: unknown): number | undefined {
	const numeric = Number(value);
	if (!Number.isInteger(numeric) || numeric <= 0) {
		return undefined;
	}

	return numeric;
}

function isValidDateOnly(value: unknown): value is string {
	if (typeof value !== 'string') {
		return false;
	}

	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
	if (!match) {
		return false;
	}

	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);
	const date = new Date(Date.UTC(year, month - 1, day));

	return (
		date.getUTCFullYear() === year &&
		date.getUTCMonth() === month - 1 &&
		date.getUTCDate() === day
	);
}

function normalizeSort(value: unknown): RueckblickSort {
	return value === 'oldest' ? 'oldest' : 'newest';
}

function normalizeRueckblickFilters(
	filters: Partial<RueckblickMediaFilters>
): RueckblickMediaFilters {
	return {
		eventId: normalizeEventId(filters.eventId),
		dateFrom: isValidDateOnly(filters.dateFrom) ? filters.dateFrom : undefined,
		dateTo: isValidDateOnly(filters.dateTo) ? filters.dateTo : undefined,
		sort: normalizeSort(filters.sort),
		limit: normalizeLimit(filters.limit),
		offset: normalizeOffset(filters.offset),
	};
}

function compareCreatedAtDesc(a: HomepageMediaRow, b: HomepageMediaRow): number {
	const aTime = Date.parse(a.created_at);
	const bTime = Date.parse(b.created_at);
	const safeATime = Number.isFinite(aTime) ? aTime : 0;
	const safeBTime = Number.isFinite(bTime) ? bTime : 0;

	return safeBTime - safeATime || b.id - a.id;
}

function stripHomepagePrivateFields(row: HomepageMediaRow): PublicEventMedia {
	const { created_at: _createdAt, ...publicMedia } = row;
	return publicMedia;
}

/**
 * Returns homepage media settings with server-side hard caps.
 */
export async function getMediaSettings(db: D1Database): Promise<MediaSettings> {
	const fallback: MediaSettings = {
		homepage_max_images: DEFAULT_HOMEPAGE_MAX_IMAGES,
		homepage_max_videos: DEFAULT_HOMEPAGE_MAX_VIDEOS,
	};

	const row = await db
		.prepare(
			`
			SELECT homepage_max_images, homepage_max_videos
			FROM media_settings
			WHERE id = 1
		`
		)
		.first<MediaSettings>();

	if (!row) {
		return fallback;
	}

	return {
		homepage_max_images: clampSetting(
			row.homepage_max_images,
			DEFAULT_HOMEPAGE_MAX_IMAGES,
			MAX_HOMEPAGE_IMAGES
		),
		homepage_max_videos: clampSetting(
			row.homepage_max_videos,
			DEFAULT_HOMEPAGE_MAX_VIDEOS,
			MAX_HOMEPAGE_VIDEOS
		),
	};
}

async function getHomepageImages(db: D1Database, limit: number): Promise<HomepageMediaRow[]> {
	if (limit <= 0) {
		return [];
	}

	const result = await db
		.prepare(
			`
			SELECT
				id,
				event_id,
				media_scope,
				media_type,
				public_url,
				thumbnail_url,
				mime_type,
				duration_seconds,
				width,
				height,
				alt_text,
				captured_at,
				${HOMEPAGE_EFFECTIVE_DATE_SQL} AS effective_date,
				created_at
			FROM event_media
			WHERE show_on_homepage = 1
			  AND status = 'uploaded'
			  AND publication_approved_at IS NOT NULL
			  AND media_type = 'image'
			  AND mime_type IN ('image/jpeg', 'image/png', 'image/webp')
			  AND size_bytes <= 3145728
			  AND duration_seconds IS NULL
			ORDER BY datetime(created_at) DESC, id DESC
			LIMIT ?
		`
		)
		.bind(limit)
		.all<HomepageMediaRow>();

	return result.results || [];
}

async function getHomepageVideos(db: D1Database, limit: number): Promise<HomepageMediaRow[]> {
	if (limit <= 0) {
		return [];
	}

	const result = await db
		.prepare(
			`
			SELECT
				id,
				event_id,
				media_scope,
				media_type,
				public_url,
				thumbnail_url,
				mime_type,
				duration_seconds,
				width,
				height,
				alt_text,
				captured_at,
				${HOMEPAGE_EFFECTIVE_DATE_SQL} AS effective_date,
				created_at
			FROM event_media
			WHERE show_on_homepage = 1
			  AND status = 'uploaded'
			  AND publication_approved_at IS NOT NULL
			  AND media_type = 'video'
			  AND mime_type IN ('video/mp4', 'video/webm')
			  AND size_bytes <= 31457280
			  AND duration_seconds IS NOT NULL
			  AND duration_seconds > 0
			  AND duration_seconds <= 10
			ORDER BY datetime(created_at) DESC, id DESC
			LIMIT ?
		`
		)
		.bind(limit)
		.all<HomepageMediaRow>();

	return result.results || [];
}

/**
 * Returns public media for the homepage collage.
 */
export async function getHomepageMedia(db: D1Database): Promise<PublicEventMedia[]> {
	const settings = await getMediaSettings(db);

	const [images, videos] = await Promise.all([
		getHomepageImages(db, settings.homepage_max_images),
		getHomepageVideos(db, settings.homepage_max_videos),
	]);

	return [...images, ...videos]
		.sort(compareCreatedAtDesc)
		.slice(0, settings.homepage_max_images + settings.homepage_max_videos)
		.map(stripHomepagePrivateFields);
}

function buildRueckblickWhere(filters: RueckblickMediaFilters): {
	whereClause: string;
	params: QueryParam[];
} {
	const conditions = [
		'em.show_on_rueckblick = 1',
		"em.status = 'uploaded'",
		'em.publication_approved_at IS NOT NULL',
		publicMediaConstraintsSql('em'),
	];
	const params: QueryParam[] = [];

	if (filters.eventId !== undefined) {
		conditions.push("em.media_scope = 'event'");
		conditions.push('em.event_id = ?');
		params.push(filters.eventId);
	}

	if (filters.dateFrom !== undefined) {
		conditions.push(`date(${RUECKBLICK_EFFECTIVE_DATE_SQL}) >= date(?)`);
		params.push(filters.dateFrom);
	}

	if (filters.dateTo !== undefined) {
		conditions.push(`date(${RUECKBLICK_EFFECTIVE_DATE_SQL}) <= date(?)`);
		params.push(filters.dateTo);
	}

	return {
		whereClause: conditions.join(' AND '),
		params,
	};
}

/**
 * Returns paginated public Rueckblick media.
 */
export async function getRueckblickMedia(
	db: D1Database,
	filters: Partial<RueckblickMediaFilters> = {}
): Promise<{ items: PublicEventMedia[]; total: number }> {
	const normalizedFilters = normalizeRueckblickFilters(filters);
	const { whereClause, params } = buildRueckblickWhere(normalizedFilters);
	const sortDirection = normalizedFilters.sort === 'oldest' ? 'ASC' : 'DESC';
	const idDirection = normalizedFilters.sort === 'oldest' ? 'ASC' : 'DESC';

	const totalResult = await db
		.prepare(
			`
			SELECT COUNT(*) as total
			FROM event_media em
			LEFT JOIN events e ON e.id = em.event_id
			WHERE ${whereClause}
		`
		)
		.bind(...params)
		.first<{ total: number }>();

	const result = await db
		.prepare(
			`
			SELECT
				${PUBLIC_MEDIA_SELECT},
				${RUECKBLICK_EFFECTIVE_DATE_SQL} AS effective_date,
				e.title_de AS event_title_de,
				e.title_en AS event_title_en,
				e.title_ru AS event_title_ru,
				e.title_uk AS event_title_uk,
				e.date AS event_date
			FROM event_media em
			LEFT JOIN events e ON e.id = em.event_id
			WHERE ${whereClause}
			ORDER BY ${RUECKBLICK_EFFECTIVE_DATE_SQL} ${sortDirection}, em.id ${idDirection}
			LIMIT ? OFFSET ?
		`
		)
		.bind(...params, normalizedFilters.limit, normalizedFilters.offset)
		.all<PublicEventMedia>();

	return {
		items: result.results || [],
		total: Number(totalResult?.total || 0),
	};
}

/**
 * Returns events that have at least one public Rueckblick media item.
 */
export async function getRueckblickEvents(db: D1Database): Promise<RueckblickEvent[]> {
	const result = await db
		.prepare(
			`
			SELECT DISTINCT
				e.id,
				e.title_de,
				e.title_en,
				e.title_ru,
				e.title_uk,
				e.date
			FROM events e
			JOIN event_media em ON em.event_id = e.id
			WHERE em.show_on_rueckblick = 1
			  AND em.status = 'uploaded'
			  AND em.publication_approved_at IS NOT NULL
			  AND em.media_scope = 'event'
			  AND ${publicMediaConstraintsSql('em')}
			ORDER BY datetime(e.date) DESC
		`
		)
		.all<RueckblickEvent>();

	return result.results || [];
}

/**
 * Returns R2 object keys for event media before event cascade-delete.
 */
export async function getEventMediaObjectKeys(
	db: D1Database,
	eventId: number
): Promise<string[]> {
	const result = await db
		.prepare(
			`
			SELECT object_key, thumbnail_object_key
			FROM event_media
			WHERE event_id = ?
		`
		)
		.bind(eventId)
		.all<{ object_key: string; thumbnail_object_key: string | null }>();

	const keys = new Set<string>();

	for (const row of result.results || []) {
		keys.add(row.object_key);

		if (row.thumbnail_object_key) {
			keys.add(row.thumbnail_object_key);
		}
	}

	return [...keys];
}
