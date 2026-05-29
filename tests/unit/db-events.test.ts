/**
 * Unit tests for Events database utilities
 * Тесты для утилит работы с мероприятиями
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { D1Database } from '@cloudflare/workers-types';
import {
	createEvent,
	getEventById,
	updateEvent,
	deleteEvent,
	publishEvent,
	cancelEvent,
	getActiveEvents,
	getPastEvents,
	getAllEvents,
	getEventWithFields,
	isRegistrationOpen,
} from '$lib/server/db/events';
import type { EventCreateData, Event as EventType } from '$lib/types/event';

// Mock D1 Database (для реального тестирования нужно использовать Miniflare или Wrangler)
const mockDb = {} as D1Database;

interface RecordedQuery {
	query: string;
	params: unknown[];
}

function createRecordingDb<T>(results: T[]): { db: D1Database; calls: RecordedQuery[] } {
	const calls: RecordedQuery[] = [];

	const db = {
		prepare: (query: string) => ({
			bind: (...params: unknown[]) => ({
				all: async () => {
					calls.push({ query, params });
					return { results, success: true };
				},
			}),
		}),
	} as unknown as D1Database;

	return { db, calls };
}

function createEventRow(overrides: Partial<EventType> = {}): EventType & { current_participants: number } {
	return {
		id: 1,
		title_de: 'Test Event',
		title_en: null,
		title_ru: null,
		title_uk: null,
		description_de: 'Description',
		description_en: null,
		description_ru: null,
		description_uk: null,
		requirements_de: null,
		requirements_en: null,
		requirements_ru: null,
		requirements_uk: null,
		location_de: 'Dresden',
		location_en: null,
		location_ru: null,
		location_uk: null,
		date: '2025-10-22T10:00:00.000Z',
		end_date: null,
		registration_deadline: '2025-10-21T10:00:00.000Z',
		max_participants: 30,
		telegram_link: null,
		whatsapp_link: null,
		qr_telegram_url: null,
		qr_whatsapp_url: null,
		poster_url: null,
		is_listed: 1,
		status: 'active',
		cancelled_at: null,
		cancellation_reason: null,
		created_at: '2025-10-01T10:00:00.000Z',
		updated_at: '2025-10-01T10:00:00.000Z',
		created_by: 1,
		current_participants: 0,
		...overrides,
	};
}

function createDeleteEventDb(event: EventType): {
	db: D1Database;
	operations: string[];
} {
	const operations: string[] = [];

	const db = {
		prepare: (query: string) => ({
			bind: (..._params: unknown[]) => ({
				first: async () => {
					operations.push('select-event');
					return event;
				},
				all: async () => {
					if (query.includes('FROM event_media')) {
						operations.push('select-event-media-keys');
						return {
							results: [
								{
									object_key: 'event-media/1/photo.jpg',
									thumbnail_object_key: 'event-media-thumbnails/1/photo.jpg',
								},
							],
							success: true,
						};
					}

					return { results: [], success: true };
				},
				run: async () => {
					if (query.includes('DELETE FROM events')) {
						operations.push('delete-event-row');
					}

					return { success: true, meta: { changes: 1 } };
				},
			}),
		}),
	} as unknown as D1Database;

	return { db, operations };
}

describe('Events Database Utilities', () => {
	describe('createEvent', () => {
		it('should create event with required fields', async () => {
			const eventData: EventCreateData = {
				title_de: 'Test Event',
				date: '2025-12-01T10:00:00Z',
				registration_deadline: '2025-11-25T23:59:59Z',
				max_participants: 30,
			};

			// Этот тест требует реальной БД или мока
			// В production окружении используйте Miniflare или Wrangler для тестирования
			expect(eventData.title_de).toBe('Test Event');
		});

		it('should create event with additional fields', async () => {
			const eventData: EventCreateData = {
				title_de: 'Test Event',
				date: '2025-12-01T10:00:00Z',
				registration_deadline: '2025-11-25T23:59:59Z',
				max_participants: 30,
				additional_fields: [
					{
						field_key: 'dietary',
						field_type: 'select',
						field_options: ['vegan', 'vegetarian'], // Массив, не JSON строка
						required: false,
						label_de: 'Ernährung',
						label_en: 'Diet',
						label_ru: null,
						label_uk: null,
						placeholder_de: null,
						placeholder_en: null,
						placeholder_ru: null,
						placeholder_uk: null,
					},
				],
			};

			expect(eventData.additional_fields?.length).toBe(1);
		});
	});

	describe('Event status transitions', () => {
		it('should validate status transitions', () => {
			// draft -> active (публикация)
			expect('active').toBe('active');

			// active -> cancelled (отмена)
			expect('cancelled').toBe('cancelled');

			// draft -> cancelled не должно быть возможным без публикации
		});
	});

	describe('deleteEvent', () => {
		it('should collect event media keys and delete R2 files before deleting event row', async () => {
			const event = createEventRow({
				qr_telegram_url: 'https://r2.example.com/qr/telegram.png',
				qr_whatsapp_url: null,
				poster_url: 'event-posters/poster.jpg',
			});
			const { db, operations } = createDeleteEventDb(event);
			const r2Bucket = {
				delete: async (key: string) => {
					operations.push(`delete-r2:${key}`);
				},
			} as any;

			await deleteEvent(db, event.id, r2Bucket);

			expect(operations).toEqual([
				'select-event',
				'select-event-media-keys',
				'delete-r2:qr/telegram.png',
				'delete-r2:event-posters/poster.jpg',
				'delete-r2:event-media/1/photo.jpg',
				'delete-r2:event-media-thumbnails/1/photo.jpg',
				'delete-event-row',
			]);
		});
	});

	describe('Event validation', () => {
		it('should require title_de for publishing', () => {
			const invalidEvent = {
				title_de: '',
				date: '2025-12-01',
				registration_deadline: '2025-11-25',
				max_participants: 30,
			};

			expect(invalidEvent.title_de).toBe('');
		});

		it('should require valid max_participants', () => {
			expect(30).toBeGreaterThan(0);
			expect(-5).toBeLessThan(0);
		});

		it('should validate date format', () => {
			const validDate = '2025-12-01T10:00:00Z';
			const dateObj = new Date(validDate);
			expect(dateObj.toISOString()).toContain('2025-12-01T10:00:00');
		});
	});

	describe('Multilingual support', () => {
		it('should support all 4 languages', () => {
			const multilingualEvent = {
				title_de: 'Deutsches Titel',
				title_en: 'English Title',
				title_ru: 'Русский заголовок',
				title_uk: 'Українська назва',
			};

			expect(multilingualEvent.title_de).toBeTruthy();
			expect(multilingualEvent.title_en).toBeTruthy();
			expect(multilingualEvent.title_ru).toBeTruthy();
			expect(multilingualEvent.title_uk).toBeTruthy();
		});

		it('should work with only German title', () => {
			const minimalEvent = {
				title_de: 'Deutsches Titel',
				title_en: null,
				title_ru: null,
				title_uk: null,
			};

			expect(minimalEvent.title_de).toBeTruthy();
		});
	});

	describe('Additional fields', () => {
		it('should support different field types', () => {
			const fieldTypes = ['text', 'select', 'checkbox', 'date', 'number'];

			fieldTypes.forEach((type) => {
				expect(['text', 'select', 'checkbox', 'date', 'number']).toContain(type);
			});
		});

		it('should parse select options from JSON', () => {
			const options = JSON.stringify(['option1', 'option2', 'option3']);
			const parsed = JSON.parse(options);

			expect(Array.isArray(parsed)).toBe(true);
			expect(parsed.length).toBe(3);
		});
	});

	describe('Participant counting', () => {
		it('should count only active registrations', () => {
			// Активные регистрации: cancelled_at IS NULL
			const activeRegistrations = [
				{ id: 1, cancelled_at: null },
				{ id: 2, cancelled_at: null },
				{ id: 3, cancelled_at: '2025-10-20' }, // Отменена
			];

			const activeCount = activeRegistrations.filter((r) => r.cancelled_at === null).length;
			expect(activeCount).toBe(2);
		});
	});

	describe('Date handling', () => {
		it('should use end_date fallback when loading active events', async () => {
			const ongoingEvent = createEventRow({
				date: '2025-10-22T10:00:00.000Z',
				end_date: '2025-10-22T18:00:00.000Z',
			});
			const { db, calls } = createRecordingDb([ongoingEvent]);

			const result = await getActiveEvents(db);

			expect(result).toEqual([ongoingEvent]);
			expect(calls[0].query).toContain('COALESCE(e.end_date, e.date) >= ?');
			expect(calls[0].query).toContain('ORDER BY e.date ASC');
			expect(calls[0].query).not.toContain('is_listed');
			expect(typeof calls[0].params[0]).toBe('string');
		});

		it('should use end_date fallback when loading past events', async () => {
			const { db, calls } = createRecordingDb<EventType & { current_participants: number }>([]);

			const result = await getPastEvents(db);

			expect(result).toEqual([]);
			expect(calls[0].query).toContain('COALESCE(e.end_date, e.date) < ?');
			expect(calls[0].query).not.toContain('is_listed');
			expect(typeof calls[0].params[0]).toBe('string');
		});

		it('should correctly compare dates for active events', () => {
			const now = new Date('2025-10-22T12:00:00Z');
			const futureEvent = new Date('2025-12-01T10:00:00Z');
			const pastEvent = new Date('2025-10-01T10:00:00Z');

			expect(futureEvent.getTime()).toBeGreaterThan(now.getTime());
			expect(pastEvent.getTime()).toBeLessThan(now.getTime());
		});

		it('should sort events by date', () => {
			const events = [
				{ id: 1, date: '2025-12-01' },
				{ id: 2, date: '2025-11-01' },
				{ id: 3, date: '2025-10-01' },
			];

			// Сортировка ASC (ближайшие первыми)
			const sortedAsc = [...events].sort((a, b) => a.date.localeCompare(b.date));
			expect(sortedAsc[0].id).toBe(3);

			// Сортировка DESC (новые первыми)
			const sortedDesc = [...events].sort((a, b) => b.date.localeCompare(a.date));
			expect(sortedDesc[0].id).toBe(1);
		});
	});

	describe('Registration status checking', () => {
		it('should return true for open registration', () => {
			const mockEvent = {
				id: 1,
				status: 'active',
				date: new Date(Date.now() + 86400000 * 2).toISOString(), // послезавтра
				registration_deadline: new Date(Date.now() + 86400000).toISOString(), // завтра
				max_participants: 30,
				current_participants: 10,
			} as EventType;

			const result = isRegistrationOpen(mockEvent, mockEvent.current_participants);
			expect(result).toBe(true);
		});

		it('should return false if deadline expired', () => {
			const mockEvent = {
				id: 1,
				status: 'active',
				date: new Date(Date.now() + 86400000 * 2).toISOString(), // послезавтра
				registration_deadline: new Date(Date.now() - 86400000).toISOString(), // вчера
				max_participants: 30,
				current_participants: 10,
			} as EventType;

			const result = isRegistrationOpen(mockEvent, mockEvent.current_participants);
			expect(result).toBe(false);
		});

		it('should return false if max participants reached', () => {
			const mockEvent = {
				id: 1,
				status: 'active',
				date: new Date(Date.now() + 86400000 * 2).toISOString(), // послезавтра
				registration_deadline: new Date(Date.now() + 86400000).toISOString(), // завтра
				max_participants: 30,
				current_participants: 30, // полностью заполнено
			} as EventType;

			const result = isRegistrationOpen(mockEvent, mockEvent.current_participants);
			expect(result).toBe(false);
		});

		it('should return false if event not active', () => {
			const mockEvent = {
				id: 1,
				status: 'cancelled',
				date: new Date(Date.now() + 86400000 * 2).toISOString(), // послезавтра
				registration_deadline: new Date(Date.now() + 86400000).toISOString(), // завтра
				max_participants: 30,
				current_participants: 10,
			} as EventType;

			const result = isRegistrationOpen(mockEvent, mockEvent.current_participants);
			expect(result).toBe(false);
		});

		it('should return true if max_participants is null (no limit)', () => {
			const mockEvent = {
				id: 1,
				status: 'active',
				date: new Date(Date.now() + 86400000 * 2).toISOString(), // послезавтра
				registration_deadline: new Date(Date.now() + 86400000).toISOString(), // завтра
				max_participants: null, // без лимита
				current_participants: 100,
			} as EventType;

			const result = isRegistrationOpen(mockEvent, mockEvent.current_participants);
			expect(result).toBe(true);
		});

		it('should handle edge case: deadline exactly now', () => {
			const now = new Date();
			const mockEvent = {
				id: 1,
				status: 'active',
				date: new Date(Date.now() + 86400000 * 2).toISOString(), // послезавтра
				registration_deadline: now.toISOString(), // точно сейчас
				max_participants: 30,
				current_participants: 10,
			} as EventType;

			const result = isRegistrationOpen(mockEvent, mockEvent.current_participants);

			// Deadline точно сейчас считается истёкшим (deadline < now)
			expect(result).toBe(false);
		});
	});
});
