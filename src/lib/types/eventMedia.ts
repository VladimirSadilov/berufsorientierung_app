/**
 * Event media types
 * Типы для медиа мероприятий, главной страницы и Rueckblick
 */

export type EventMediaType = 'image' | 'video';
export type EventMediaStatus = 'uploaded' | 'hidden';
export type EventMediaScope = 'event' | 'general';
export type RueckblickSort = 'newest' | 'oldest';

/**
 * Full event media record from the database.
 */
export interface EventMedia {
	/** Unique media identifier */
	id: number;

	/** Related event ID, required only for media_scope = 'event' */
	event_id: number | null;

	/** Media scope: linked to an event or general-purpose */
	media_scope: EventMediaScope;

	/** Media file type */
	media_type: EventMediaType;

	/** Base storage/moderation status */
	status: EventMediaStatus;

	/** Homepage publication flag (SQLite boolean 0/1) */
	show_on_homepage: 0 | 1;

	/** Rueckblick publication flag (SQLite boolean 0/1) */
	show_on_rueckblick: 0 | 1;

	/** R2 object key */
	object_key: string;

	/** Public media URL */
	public_url: string;

	/** R2 thumbnail object key */
	thumbnail_object_key: string | null;

	/** Public thumbnail URL */
	thumbnail_url: string | null;

	/** Verified MIME type */
	mime_type: string;

	/** File size in bytes */
	size_bytes: number;

	/** Video duration in seconds, null for images */
	duration_seconds: number | null;

	/** Media width in pixels */
	width: number | null;

	/** Media height in pixels */
	height: number | null;

	/** Original uploaded filename */
	original_filename: string | null;

	/** Alternative text for public display */
	alt_text: string | null;

	/** Date the media belongs to, e.g. capture or event date */
	captured_at: string | null;

	/** Publication rights/consent approval timestamp */
	publication_approved_at: string | null;

	/** Admin user who approved publication */
	publication_approved_by: number | null;

	/** Admin user who created the media record */
	created_by: number | null;

	/** Creation timestamp */
	created_at: string;

	/** Last update timestamp */
	updated_at: string;
}

/**
 * Public media shape safe to return to client pages.
 */
export interface PublicEventMedia {
	/** Unique media identifier */
	id: number;

	/** Related event ID, null for general media */
	event_id: number | null;

	/** Media scope: linked to an event or general-purpose */
	media_scope: EventMediaScope;

	/** Media file type */
	media_type: EventMediaType;

	/** Public media URL */
	public_url: string;

	/** Public thumbnail URL */
	thumbnail_url: string | null;

	/** Verified MIME type */
	mime_type: string;

	/** Video duration in seconds, null for images */
	duration_seconds: number | null;

	/** Media width in pixels */
	width: number | null;

	/** Media height in pixels */
	height: number | null;

	/** Alternative text for public display */
	alt_text: string | null;

	/** Date the media belongs to, e.g. capture or event date */
	captured_at: string | null;

	/** Computed date used for sorting and filtering */
	effective_date: string;

	/** Event title in German */
	event_title_de?: string | null;

	/** Event title in English */
	event_title_en?: string | null;

	/** Event title in Russian */
	event_title_ru?: string | null;

	/** Event title in Ukrainian */
	event_title_uk?: string | null;

	/** Related event date */
	event_date?: string | null;
}

/**
 * Normalized filters for public Rueckblick media.
 */
export interface RueckblickMediaFilters {
	/** Filter by event ID */
	eventId?: number;

	/** Inclusive date lower bound, YYYY-MM-DD */
	dateFrom?: string;

	/** Inclusive date upper bound, YYYY-MM-DD */
	dateTo?: string;

	/** Sort direction by effective media date */
	sort: RueckblickSort;

	/** Page size */
	limit: number;

	/** Pagination offset */
	offset: number;
}

/**
 * Homepage media limits.
 */
export interface MediaSettings {
	/** Maximum homepage images, hard-capped at 300 */
	homepage_max_images: number;

	/** Maximum homepage videos, hard-capped at 30 */
	homepage_max_videos: number;
}
