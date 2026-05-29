import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	getActiveEvents: vi.fn(),
	getRegistrationCount: vi.fn(),
	isUserRegistered: vi.fn(),
	getLatestApprovedReviews: vi.fn(),
	getHomepageMedia: vi.fn(),
	extractTokenFromRequest: vi.fn(),
	verifyToken: vi.fn(),
}));

vi.mock('$lib/server/db/events', () => ({
	getActiveEvents: mocks.getActiveEvents,
}));

vi.mock('$lib/server/db/registrations', () => ({
	getRegistrationCount: mocks.getRegistrationCount,
	isUserRegistered: mocks.isUserRegistered,
}));

vi.mock('$lib/server/db/reviews', () => ({
	getLatestApprovedReviews: mocks.getLatestApprovedReviews,
}));

vi.mock('$lib/server/db', () => ({
	DB: {
		eventMedia: {
			getHomepageMedia: mocks.getHomepageMedia,
		},
	},
}));

vi.mock('$lib/server/auth', () => ({
	extractTokenFromRequest: mocks.extractTokenFromRequest,
	verifyToken: mocks.verifyToken,
}));

import { load } from '../../src/routes/+page.server';

const db = { name: 'test-db' };
const request = new Request('https://example.test/');

function createEvent(overrides: Record<string, unknown> = {}) {
	return {
		id: 1,
		title_de: 'Active Event',
		registration_deadline: new Date(Date.now() + 60_000).toISOString(),
		max_participants: 20,
		...overrides,
	};
}

describe('homepage server load', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.extractTokenFromRequest.mockReturnValue(null);
		mocks.getRegistrationCount.mockResolvedValue(3);
		mocks.getLatestApprovedReviews.mockResolvedValue([]);
		mocks.getHomepageMedia.mockResolvedValue([]);
	});

	it('returns homepageMedia and loads it only when there are no active events', async () => {
		mocks.getActiveEvents.mockResolvedValue([]);
		mocks.getHomepageMedia.mockResolvedValue([{ id: 10, public_url: '/media.jpg' }]);

		const result = await load({
			platform: { env: { DB: db, JWT_SECRET: 'secret' } },
			request,
		} as any);

		expect(result.events).toEqual([]);
		expect(result.homepageMedia).toEqual([{ id: 10, public_url: '/media.jpg' }]);
		expect(mocks.getHomepageMedia).toHaveBeenCalledWith(db);
	});

	it('does not load homepage media when active events exist', async () => {
		mocks.getActiveEvents.mockResolvedValue([createEvent()]);

		const result = await load({
			platform: { env: { DB: db, JWT_SECRET: 'secret' } },
			request,
		} as any);

		expect(result.events).toHaveLength(1);
		expect(result.homepageMedia).toEqual([]);
		expect(mocks.getHomepageMedia).not.toHaveBeenCalled();
	});

	it('turns homepage media errors into an empty array', async () => {
		mocks.getActiveEvents.mockResolvedValue([]);
		mocks.getHomepageMedia.mockRejectedValue(new Error('media failed'));

		const result = await load({
			platform: { env: { DB: db, JWT_SECRET: 'secret' } },
			request,
		} as any);

		expect(result.events).toEqual([]);
		expect(result.homepageMedia).toEqual([]);
		expect(mocks.getLatestApprovedReviews).toHaveBeenCalledWith(db, 5);
	});

	it('keeps reviews best-effort and returns homepageMedia when reviews fail', async () => {
		mocks.getActiveEvents.mockResolvedValue([]);
		mocks.getHomepageMedia.mockResolvedValue([{ id: 10, public_url: '/media.jpg' }]);
		mocks.getLatestApprovedReviews.mockRejectedValue(new Error('reviews failed'));

		const result = await load({
			platform: { env: { DB: db, JWT_SECRET: 'secret' } },
			request,
		} as any);

		expect(result.latestReviews).toEqual([]);
		expect(result.homepageMedia).toEqual([{ id: 10, public_url: '/media.jpg' }]);
	});

	it('returns all required arrays when database is unavailable', async () => {
		const result = await load({
			platform: { env: {} },
			request,
		} as any);

		expect(result).toEqual({
			events: [],
			homepageMedia: [],
			latestReviews: [],
		});
	});
});
