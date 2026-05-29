import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	getRueckblickMedia: vi.fn(),
	getRueckblickEvents: vi.fn(),
}));

vi.mock('$lib/server/db', () => ({
	DB: {
		eventMedia: {
			getRueckblickMedia: mocks.getRueckblickMedia,
			getRueckblickEvents: mocks.getRueckblickEvents,
		},
	},
}));

import { load, type RueckblickPageData } from '../../src/routes/rueckblick/+page.server';

const db = { name: 'test-db' };

async function request(
	url: string,
	platform: unknown = { env: { DB: db } }
): Promise<RueckblickPageData> {
	return (await load({ platform, url: new URL(url) } as any)) as RueckblickPageData;
}

describe('Rueckblick server load', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.getRueckblickMedia.mockResolvedValue({ items: [], total: 0 });
		mocks.getRueckblickEvents.mockResolvedValue([]);
	});

	it('normalizes invalid query params without failing the public page', async () => {
		const result = await request(
			'https://example.test/rueckblick?eventId=-1&dateFrom=2026-99-99&dateTo=2026-02-30&sort=random&page=0'
		);

		expect(result.filters).toEqual({
			eventId: null,
			dateFrom: '',
			dateTo: '',
			sort: 'newest',
		});
		expect(result.page).toBe(1);
		expect(result.limit).toBe(24);
		expect(mocks.getRueckblickMedia).toHaveBeenCalledWith(db, {
			sort: 'newest',
			limit: 24,
			offset: 0,
		});
	});

	it('accepts valid filters, swaps inverted dates, and computes pagination', async () => {
		mocks.getRueckblickMedia.mockResolvedValue({
			items: [{ id: 1, public_url: '/media.jpg' }],
			total: 80,
		});
		mocks.getRueckblickEvents.mockResolvedValue([{ id: 7, title_de: 'Event' }]);

		const result = await request(
			'https://example.test/rueckblick?eventId=42&dateFrom=2026-12-31&dateTo=2026-01-01&sort=oldest&page=3'
		);

		expect(result.filters).toEqual({
			eventId: 42,
			dateFrom: '2026-01-01',
			dateTo: '2026-12-31',
			sort: 'oldest',
		});
		expect(result.page).toBe(3);
		expect(result.total).toBe(80);
		expect(result.totalPages).toBe(4);
		expect(result.hasMore).toBe(true);
		expect(mocks.getRueckblickMedia).toHaveBeenCalledWith(db, {
			eventId: 42,
			dateFrom: '2026-01-01',
			dateTo: '2026-12-31',
			sort: 'oldest',
			limit: 24,
			offset: 48,
		});
	});

	it('returns a safe empty result when the database is unavailable', async () => {
		const result = await request(
			'https://example.test/rueckblick?eventId=2&page=5',
			{ env: {} }
		);

		expect(result).toEqual({
			items: [],
			events: [],
			filters: {
				eventId: 2,
				dateFrom: '',
				dateTo: '',
				sort: 'newest',
			},
			total: 0,
			page: 5,
			limit: 24,
			totalPages: 0,
			hasMore: false,
		});
		expect(mocks.getRueckblickMedia).not.toHaveBeenCalled();
		expect(mocks.getRueckblickEvents).not.toHaveBeenCalled();
	});

	it('returns safe data when the Rueckblick query fails', async () => {
		mocks.getRueckblickMedia.mockRejectedValue(new Error('media failed'));

		const result = await request(
			'https://example.test/rueckblick?dateFrom=2026-01-01&sort=oldest'
		);

		expect(result.items).toEqual([]);
		expect(result.events).toEqual([]);
		expect(result.filters).toEqual({
			eventId: null,
			dateFrom: '2026-01-01',
			dateTo: '',
			sort: 'oldest',
		});
		expect(result.page).toBe(1);
		expect(result.limit).toBe(24);
	});
});
