import { DB } from '$lib/server/db';
import type {
	PublicEventMedia,
	RueckblickMediaFilters,
	RueckblickSort,
} from '$lib/types/eventMedia';
import type { RueckblickEvent } from '$lib/server/db/eventMedia';
import type { PageServerLoad } from './$types';

const RUECKBLICK_PAGE_LIMIT = 24;

export interface RueckblickFilterState {
	eventId: number | null;
	dateFrom: string;
	dateTo: string;
	sort: RueckblickSort;
}

export interface RueckblickPageData {
	items: PublicEventMedia[];
	events: RueckblickEvent[];
	filters: RueckblickFilterState;
	total: number;
	page: number;
	limit: number;
	totalPages: number;
	hasMore: boolean;
}

function parsePositiveInteger(value: string | null): number | undefined {
	if (!value || !/^\d+$/.test(value)) {
		return undefined;
	}

	const numeric = Number(value);
	if (!Number.isSafeInteger(numeric) || numeric <= 0) {
		return undefined;
	}

	return numeric;
}

function parseDateOnly(value: string | null): string | undefined {
	if (!value) {
		return undefined;
	}

	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
	if (!match) {
		return undefined;
	}

	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);
	const date = new Date(Date.UTC(year, month - 1, day));

	if (
		date.getUTCFullYear() !== year ||
		date.getUTCMonth() !== month - 1 ||
		date.getUTCDate() !== day
	) {
		return undefined;
	}

	return value;
}

function parseSort(value: string | null): RueckblickSort {
	return value === 'oldest' ? 'oldest' : 'newest';
}

function normalizeQuery(url: URL): { filters: RueckblickFilterState; page: number } {
	const eventId = parsePositiveInteger(url.searchParams.get('eventId')) ?? null;
	let dateFrom = parseDateOnly(url.searchParams.get('dateFrom')) ?? '';
	let dateTo = parseDateOnly(url.searchParams.get('dateTo')) ?? '';
	const sort = parseSort(url.searchParams.get('sort'));
	const page = parsePositiveInteger(url.searchParams.get('page')) ?? 1;

	if (dateFrom && dateTo && dateFrom > dateTo) {
		[dateFrom, dateTo] = [dateTo, dateFrom];
	}

	return {
		filters: {
			eventId,
			dateFrom,
			dateTo,
			sort,
		},
		page,
	};
}

function toMediaFilters(
	filters: RueckblickFilterState,
	page: number
): RueckblickMediaFilters {
	const mediaFilters: RueckblickMediaFilters = {
		sort: filters.sort,
		limit: RUECKBLICK_PAGE_LIMIT,
		offset: (page - 1) * RUECKBLICK_PAGE_LIMIT,
	};

	if (filters.eventId !== null) {
		mediaFilters.eventId = filters.eventId;
	}

	if (filters.dateFrom) {
		mediaFilters.dateFrom = filters.dateFrom;
	}

	if (filters.dateTo) {
		mediaFilters.dateTo = filters.dateTo;
	}

	return mediaFilters;
}

function emptyPageData(filters: RueckblickFilterState, page: number): RueckblickPageData {
	return {
		items: [],
		events: [],
		filters,
		total: 0,
		page,
		limit: RUECKBLICK_PAGE_LIMIT,
		totalPages: 0,
		hasMore: false,
	};
}

export const load: PageServerLoad = async ({ platform, url }): Promise<RueckblickPageData> => {
	const { filters, page } = normalizeQuery(url);

	try {
		const db = platform?.env?.DB;

		if (!db) {
			throw new Error('Database not available');
		}

		const mediaFilters = toMediaFilters(filters, page);
		const [{ items, total }, events] = await Promise.all([
			DB.eventMedia.getRueckblickMedia(db, mediaFilters),
			DB.eventMedia.getRueckblickEvents(db),
		]);
		const safeTotal = Math.max(0, Number(total) || 0);
		const totalPages = Math.ceil(safeTotal / RUECKBLICK_PAGE_LIMIT);

		return {
			items,
			events,
			filters,
			total: safeTotal,
			page,
			limit: RUECKBLICK_PAGE_LIMIT,
			totalPages,
			hasMore: page < totalPages,
		};
	} catch (error) {
		console.error('Error loading Rueckblick page:', error);
		return emptyPageData(filters, page);
	}
};
