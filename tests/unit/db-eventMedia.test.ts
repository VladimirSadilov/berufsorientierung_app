import { describe, expect, it } from 'vitest';
import type { D1Database } from '@cloudflare/workers-types';
import { DB } from '$lib/server/db';
import {
	getEventMediaObjectKeys,
	getHomepageMedia,
	getMediaSettings,
	getRueckblickEvents,
	getRueckblickMedia,
} from '$lib/server/db/eventMedia';

type QueryMethod = 'first' | 'all' | 'run';

interface QueryCall {
	query: string;
	params: unknown[];
	method: QueryMethod;
}

function createMockDb(
	responder: (call: QueryCall) => unknown
): { db: D1Database; calls: QueryCall[] } {
	const calls: QueryCall[] = [];

	const makeExecutor = (query: string, params: unknown[]) => ({
		first: async <T = unknown>() => {
			const call = { query, params, method: 'first' as const };
			calls.push(call);
			return responder(call) as T | null;
		},
		all: async <T = unknown>() => {
			const call = { query, params, method: 'all' as const };
			calls.push(call);
			return (responder(call) || { results: [], success: true }) as {
				results: T[];
				success?: boolean;
			};
		},
		run: async () => {
			const call = { query, params, method: 'run' as const };
			calls.push(call);
			return (responder(call) || { success: true, meta: { changes: 0 } }) as {
				success: boolean;
				meta?: Record<string, unknown>;
			};
		},
	});

	const db = {
		prepare: (query: string) => ({
			...makeExecutor(query, []),
			bind: (...params: unknown[]) => makeExecutor(query, params),
		}),
	} as unknown as D1Database;

	return { db, calls };
}

function mediaRow(overrides: Record<string, unknown>) {
	return {
		id: 1,
		event_id: null,
		media_scope: 'general',
		media_type: 'image',
		public_url: 'https://example.com/media.jpg',
		thumbnail_url: null,
		mime_type: 'image/jpeg',
		duration_seconds: null,
		width: 1200,
		height: 800,
		alt_text: null,
		captured_at: null,
		effective_date: '2025-02-01 10:00:00',
		created_at: '2025-02-01T10:00:00Z',
		...overrides,
	};
}

describe('Event media DB utilities', () => {
	it('exports the module via DB.eventMedia', () => {
		expect(DB.eventMedia.getHomepageMedia).toBe(getHomepageMedia);
		expect(DB.eventMedia.getRueckblickMedia).toBe(getRueckblickMedia);
	});

	it('returns default media settings and clamps DB values to hard caps', async () => {
		const { db: fallbackDb } = createMockDb(() => null);
		await expect(getMediaSettings(fallbackDb)).resolves.toEqual({
			homepage_max_images: 300,
			homepage_max_videos: 30,
		});

		const { db: clampedDb } = createMockDb(() => ({
			homepage_max_images: 999,
			homepage_max_videos: -10,
		}));
		await expect(getMediaSettings(clampedDb)).resolves.toEqual({
			homepage_max_images: 300,
			homepage_max_videos: 0,
		});
	});

	it('loads homepage images and videos with public filters and capped limits', async () => {
		const { db, calls } = createMockDb((call) => {
			if (call.query.includes('FROM media_settings')) {
				return {
					homepage_max_images: 999,
					homepage_max_videos: 99,
				};
			}

			if (call.query.includes("media_type = 'image'")) {
				return {
					results: [
						mediaRow({
							id: 1,
							media_type: 'image',
							created_at: '2025-02-01T10:00:00Z',
						}),
					],
					success: true,
				};
			}

			if (call.query.includes("media_type = 'video'")) {
				return {
					results: [
						mediaRow({
							id: 2,
							media_type: 'video',
							mime_type: 'video/mp4',
							duration_seconds: 8,
							created_at: '2025-03-01T10:00:00Z',
						}),
					],
					success: true,
				};
			}

			return { results: [], success: true };
		});

		const media = await getHomepageMedia(db);

		expect(media.map((item) => item.id)).toEqual([2, 1]);
		expect('created_at' in media[0]).toBe(false);

		const imageCall = calls.find(
			(call) => call.method === 'all' && call.query.includes("media_type = 'image'")
		);
		const videoCall = calls.find(
			(call) => call.method === 'all' && call.query.includes("media_type = 'video'")
		);

		expect(imageCall?.params).toEqual([300]);
		expect(videoCall?.params).toEqual([30]);
		expect(imageCall?.query).toContain('publication_approved_at IS NOT NULL');
		expect(videoCall?.query).toContain("status = 'uploaded'");
		expect(`${imageCall?.query} ${videoCall?.query}`).not.toContain("status != 'hidden'");
		expect(imageCall?.query).not.toContain('object_key');
		expect(videoCall?.query).not.toContain('thumbnail_object_key');
	});

	it('normalizes Rueckblick filters, caps limit, and excludes general media by eventId', async () => {
		const { db, calls } = createMockDb((call) => {
			if (call.method === 'first') {
				return { total: 2 };
			}

			return {
				results: [
					mediaRow({
						id: 10,
						event_id: 1,
						media_scope: 'event',
						event_title_de: 'Event A',
						event_title_en: null,
						event_title_ru: null,
						event_title_uk: null,
						event_date: '2025-01-10T10:00:00Z',
					}),
				],
				success: true,
			};
		});

		const result = await getRueckblickMedia(db, {
			eventId: 1,
			dateFrom: '2025-01-01',
			dateTo: 'not-a-date',
			sort: 'oldest',
			limit: 999,
			offset: -20,
		});

		expect(result.total).toBe(2);
		expect(result.items).toHaveLength(1);

		const countCall = calls.find((call) => call.method === 'first');
		const listCall = calls.find((call) => call.method === 'all');

		expect(countCall?.params).toEqual([1, '2025-01-01']);
		expect(listCall?.params).toEqual([1, '2025-01-01', 60, 0]);
		expect(listCall?.query).toContain("em.media_scope = 'event'");
		expect(listCall?.query).toContain('em.event_id = ?');
		expect(listCall?.query).toContain('publication_approved_at IS NOT NULL');
		expect(listCall?.query).toContain('em.id ASC');
		expect(listCall?.query).not.toContain('date(?) AND date(?)');
		expect(listCall?.query).not.toContain('object_key');
		expect(listCall?.query).not.toContain('created_by');
	});

	it('loads Rueckblick events without filtering by event status', async () => {
		const { db, calls } = createMockDb(() => ({
			results: [
				{
					id: 1,
					title_de: 'Past Event',
					title_en: null,
					title_ru: null,
					title_uk: null,
					date: '2025-01-10T10:00:00Z',
				},
			],
			success: true,
		}));

		const events = await getRueckblickEvents(db);

		expect(events).toHaveLength(1);
		expect(calls[0].query).toContain('em.publication_approved_at IS NOT NULL');
		expect(calls[0].query).not.toMatch(/\be\.status\b/);
	});

	it('returns event media object keys and thumbnail keys for R2 cleanup', async () => {
		const { db, calls } = createMockDb(() => ({
			results: [
				{ object_key: 'event-media/1/a.jpg', thumbnail_object_key: 'thumbs/1/a.jpg' },
				{ object_key: 'event-media/1/b.jpg', thumbnail_object_key: null },
				{ object_key: 'event-media/1/a.jpg', thumbnail_object_key: 'thumbs/1/a.jpg' },
			],
			success: true,
		}));

		await expect(getEventMediaObjectKeys(db, 1)).resolves.toEqual([
			'event-media/1/a.jpg',
			'thumbs/1/a.jpg',
			'event-media/1/b.jpg',
		]);

		expect(calls[0].params).toEqual([1]);
		expect(calls[0].query).toContain('SELECT object_key, thumbnail_object_key');
	});
});
