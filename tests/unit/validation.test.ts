/**
 * Validation Schemas Unit Tests
 * Тесты для Zod схем валидации
 */

import { describe, it, expect } from 'vitest';
import {
	userRegistrationSchema,
	userLoginSchema,
	userUpdateSchema,
	eventCreateSchema,
	eventUpdateSchema,
	additionalFieldSchema,
	registrationCreateSchema,
	validateWithLocalization,
} from '$lib/server/validation/schemas';

describe('User Validation Schemas', () => {
	describe('userRegistrationSchema', () => {
		it('should validate correct registration data', () => {
			const validData = {
				email: 'test@example.com',
				password: 'Pass1234',
				password_confirm: 'Pass1234',
				first_name: 'John',
				last_name: 'Doe',
				birth_date: '1995-05-15',
				address_street: 'Hauptstraße',
				address_number: '123',
				address_zip: '01234',
				address_city: 'Dresden',
				phone: '+491234567890',
				photo_video_consent: true,
				parental_consent: false,
				gdpr_consent: true,
				preferred_language: 'de' as const,
			};

			const result = userRegistrationSchema.safeParse(validData);
			expect(result.success).toBe(true);
		});

		it('should require parental consent for users under 18', () => {
			const underageData = {
				email: 'teen@example.com',
				password: 'Pass1234',
				password_confirm: 'Pass1234',
				first_name: 'Jane',
				last_name: 'Young',
				birth_date: '2010-01-01', // 15 years old
				address_street: 'Straße',
				address_number: '1',
				address_zip: '01234',
				address_city: 'Dresden',
				phone: '+491234567890',
				photo_video_consent: false,
				parental_consent: false, // Should fail
				gdpr_consent: true,
				preferred_language: 'de' as const,
			};

			const result = userRegistrationSchema.safeParse(underageData);
			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.issues.some((e) => e.path.includes('parental_consent'))).toBe(
					true
				);
			}
		});

		it('should reject mismatched passwords', () => {
			const mismatchData = {
				email: 'test@example.com',
				password: 'Pass1234',
				password_confirm: 'Different123',
				first_name: 'John',
				last_name: 'Doe',
				birth_date: '1990-01-01',
				address_street: 'Straße',
				address_number: '1',
				address_zip: '01234',
				address_city: 'Dresden',
				phone: '+491234567890',
				photo_video_consent: true,
				parental_consent: false,
				gdpr_consent: true,
				preferred_language: 'de' as const,
			};

			const result = userRegistrationSchema.safeParse(mismatchData);
			expect(result.success).toBe(false);
		});

		it('should reject weak passwords', () => {
			const weakPassword = {
				email: 'test@example.com',
				password: 'short', // Too short
				password_confirm: 'short',
				first_name: 'John',
				last_name: 'Doe',
				birth_date: '1990-01-01',
				address_street: 'Straße',
				address_number: '1',
				address_zip: '01234',
				address_city: 'Dresden',
				phone: '+491234567890',
				photo_video_consent: true,
				parental_consent: false,
				gdpr_consent: true,
				preferred_language: 'de' as const,
			};

			const result = userRegistrationSchema.safeParse(weakPassword);
			expect(result.success).toBe(false);
		});

		it('should accept password without numbers', () => {
			const lettersOnlyPassword = {
				email: 'test@example.com',
				password: 'OnlyLetters',
				password_confirm: 'OnlyLetters',
				first_name: 'John',
				last_name: 'Doe',
				birth_date: '1990-01-01',
				address_street: 'Straße',
				address_number: '1',
				address_zip: '01234',
				address_city: 'Dresden',
				phone: '+491234567890',
				photo_video_consent: true,
				parental_consent: false,
				gdpr_consent: true,
				preferred_language: 'de' as const,
			};

			const result = userRegistrationSchema.safeParse(lettersOnlyPassword);
			expect(result.success).toBe(true);
		});

		it('should reject invalid email', () => {
			const invalidEmail = {
				email: 'not-an-email',
				password: 'Pass1234',
				password_confirm: 'Pass1234',
				first_name: 'John',
				last_name: 'Doe',
				birth_date: '1990-01-01',
				address_street: 'Straße',
				address_number: '1',
				address_zip: '01234',
				address_city: 'Dresden',
				phone: '+491234567890',
				photo_video_consent: true,
				parental_consent: false,
				gdpr_consent: true,
				preferred_language: 'de' as const,
			};

			const result = userRegistrationSchema.safeParse(invalidEmail);
			expect(result.success).toBe(false);
		});

		it('should reject invalid German ZIP code', () => {
			const invalidZip = {
				email: 'test@example.com',
				password: 'Pass1234',
				password_confirm: 'Pass1234',
				first_name: 'John',
				last_name: 'Doe',
				birth_date: '1990-01-01',
				address_street: 'Straße',
				address_number: '1',
				address_zip: '123', // Not 5 digits
				address_city: 'Dresden',
				phone: '+491234567890',
				photo_video_consent: true,
				parental_consent: false,
				gdpr_consent: true,
				preferred_language: 'de' as const,
			};

			const result = userRegistrationSchema.safeParse(invalidZip);
			expect(result.success).toBe(false);
		});
	});

	describe('userLoginSchema', () => {
		it('should validate correct login data', () => {
			const validData = {
				email: 'test@example.com',
				password: 'anypassword',
			};

			const result = userLoginSchema.safeParse(validData);
			expect(result.success).toBe(true);
		});

		it('should reject empty credentials', () => {
			const emptyData = {
				email: '',
				password: '',
			};

			const result = userLoginSchema.safeParse(emptyData);
			expect(result.success).toBe(false);
		});
	});

	describe('userUpdateSchema', () => {
		it('should allow partial updates', () => {
			const partialData = {
				first_name: 'NewName',
			};

			const result = userUpdateSchema.safeParse(partialData);
			expect(result.success).toBe(true);
		});

		it('should require current password when changing password', () => {
			const newPasswordOnly = {
				new_password: 'NewPass123',
				// Missing current_password
			};

			const result = userUpdateSchema.safeParse(newPasswordOnly);
			expect(result.success).toBe(false);
		});

		it('should validate password confirmation', () => {
			const mismatchPasswords = {
				current_password: 'OldPass123',
				new_password: 'NewPass123',
				new_password_confirm: 'Different123',
			};

			const result = userUpdateSchema.safeParse(mismatchPasswords);
			expect(result.success).toBe(false);
		});
	});
});

describe('Event Validation Schemas', () => {
	describe('eventCreateSchema', () => {
		it('should validate correct event data', () => {
			const futureDate = new Date();
			futureDate.setDate(futureDate.getDate() + 30);
			const deadline = new Date();
			deadline.setDate(deadline.getDate() + 20);

			const validData = {
				title_de: 'Test Event',
				date: futureDate.toISOString(),
				registration_deadline: deadline.toISOString(),
				max_participants: 20,
			};

			const result = eventCreateSchema.safeParse(validData);
			expect(result.success).toBe(true);
		});

		it('should validate event with optional description and location', () => {
			const futureDate = new Date();
			futureDate.setDate(futureDate.getDate() + 30);
			const deadline = new Date();
			deadline.setDate(deadline.getDate() + 20);

			const validData = {
				title_de: 'Test Event',
				description_de: 'Optional description',
				location_de: 'Dresden',
				date: futureDate.toISOString(),
				registration_deadline: deadline.toISOString(),
				max_participants: 20,
			};

			const result = eventCreateSchema.safeParse(validData);
			expect(result.success).toBe(true);
		});

		it('should reject deadline after event date', () => {
			const eventDate = new Date();
			eventDate.setDate(eventDate.getDate() + 10);
			const deadline = new Date();
			deadline.setDate(deadline.getDate() + 20); // After event

			const invalidData = {
				title_de: 'Test Event',
				date: eventDate.toISOString(),
				registration_deadline: deadline.toISOString(),
				max_participants: 20,
			};

			const result = eventCreateSchema.safeParse(invalidData);
			expect(result.success).toBe(false);
		});

		it('should reject zero or negative max_participants', () => {
			const futureDate = new Date();
			futureDate.setDate(futureDate.getDate() + 30);
			const deadline = new Date();
			deadline.setDate(deadline.getDate() + 20);

			const invalidData = {
				title_de: 'Test Event',
				date: futureDate.toISOString(),
				registration_deadline: deadline.toISOString(),
				max_participants: 0,
			};

			const result = eventCreateSchema.safeParse(invalidData);
			expect(result.success).toBe(false);
		});

		it('should accept valid event with end_date after start date', () => {
			const startDate = new Date();
			startDate.setDate(startDate.getDate() + 30);
			const endDate = new Date();
			endDate.setDate(endDate.getDate() + 30);
			endDate.setHours(endDate.getHours() + 3); // 3 hours after start
			const deadline = new Date();
			deadline.setDate(deadline.getDate() + 20);

			const validData = {
				title_de: 'Test Event',
				date: startDate.toISOString(),
				end_date: endDate.toISOString(),
				registration_deadline: deadline.toISOString(),
				max_participants: 20,
			};

			const result = eventCreateSchema.safeParse(validData);
			expect(result.success).toBe(true);
		});

		it('should reject event with end_date before start date', () => {
			const startDate = new Date();
			startDate.setDate(startDate.getDate() + 30);
			const endDate = new Date();
			endDate.setDate(endDate.getDate() + 29); // Before start
			const deadline = new Date();
			deadline.setDate(deadline.getDate() + 20);

			const invalidData = {
				title_de: 'Test Event',
				date: startDate.toISOString(),
				end_date: endDate.toISOString(),
				registration_deadline: deadline.toISOString(),
				max_participants: 20,
			};

			const result = eventCreateSchema.safeParse(invalidData);
			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.issues.some((e) => e.path.includes('end_date'))).toBe(true);
			}
		});

		it('should allow event without end_date (nullable)', () => {
			const futureDate = new Date();
			futureDate.setDate(futureDate.getDate() + 30);
			const deadline = new Date();
			deadline.setDate(deadline.getDate() + 20);

			const validData = {
				title_de: 'Test Event',
				date: futureDate.toISOString(),
				end_date: null,
				registration_deadline: deadline.toISOString(),
				max_participants: 20,
			};

			const result = eventCreateSchema.safeParse(validData);
			expect(result.success).toBe(true);
		});
	});

	describe('eventUpdateSchema - end_date validation', () => {
		it('should accept valid update with end_date after start date', () => {
			const startDate = new Date();
			startDate.setDate(startDate.getDate() + 30);
			const endDate = new Date();
			endDate.setDate(endDate.getDate() + 30);
			endDate.setHours(endDate.getHours() + 3);

			const validData = {
				id: 1,
				date: startDate.toISOString(),
				end_date: endDate.toISOString(),
			};

			const result = eventUpdateSchema.safeParse(validData);
			expect(result.success).toBe(true);
		});

		it('should reject update with end_date before start date', () => {
			const startDate = new Date();
			startDate.setDate(startDate.getDate() + 30);
			const endDate = new Date();
			endDate.setDate(endDate.getDate() + 29); // Before start

			const invalidData = {
				id: 1,
				date: startDate.toISOString(),
				end_date: endDate.toISOString(),
			};

			const result = eventUpdateSchema.safeParse(invalidData);
			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.issues.some((e) => e.path.includes('end_date'))).toBe(true);
			}
		});

		it('should allow update with null end_date', () => {
			const validData = {
				id: 1,
				end_date: null,
			};

			const result = eventUpdateSchema.safeParse(validData);
			expect(result.success).toBe(true);
		});
	});

	describe('additionalFieldSchema', () => {
		it('should validate text field', () => {
			const validField = {
				field_key: 'emergency_contact',
				field_type: 'text' as const,
				required: true,
				label_de: 'Notfallkontakt',
			};

			const result = additionalFieldSchema.safeParse(validField);
			expect(result.success).toBe(true);
		});

		it('should require options for select field', () => {
			const selectWithoutOptions = {
				field_key: 'shirt_size',
				field_type: 'select' as const,
				required: true,
				label_de: 'T-Shirt Größe',
				// Missing field_options
			};

			const result = additionalFieldSchema.safeParse(selectWithoutOptions);
			expect(result.success).toBe(false);
		});

		it('should validate select field with options', () => {
			const validSelect = {
				field_key: 'shirt_size',
				field_type: 'select' as const,
				field_options: ['S', 'M', 'L', 'XL'],
				required: true,
				label_de: 'T-Shirt Größe',
			};

			const result = additionalFieldSchema.safeParse(validSelect);
			expect(result.success).toBe(true);
		});

		it('should reject non-snake_case field_key', () => {
			const invalidKey = {
				field_key: 'InvalidKey', // Should be invalid_key
				field_type: 'text' as const,
				required: false,
				label_de: 'Test',
			};

			const result = additionalFieldSchema.safeParse(invalidKey);
			expect(result.success).toBe(false);
		});

		it('should validate all allowed field types', () => {
			const allowedTypes: Array<'text' | 'select' | 'checkbox' | 'date' | 'number'> = [
				'text',
				'select',
				'checkbox',
				'date',
				'number',
			];

			allowedTypes.forEach((type) => {
				const field = {
					field_key: 'test_field',
					field_type: type,
					required: false,
					label_de: 'Test Label',
					// select требует field_options
					...(type === 'select' ? { field_options: ['Option 1', 'Option 2'] } : {}),
				};

				const result = additionalFieldSchema.safeParse(field);
				expect(result.success).toBe(true);
			});
		});
	});
});

describe('Registration Validation Schemas', () => {
	describe('registrationCreateSchema', () => {
		it('should validate correct registration', () => {
			const validData = {
				event_id: 1,
				profile_confirmed: true,
				additional_data: {
					emergency_contact: '+491234567890',
				},
			};

			const result = registrationCreateSchema.safeParse(validData);
			expect(result.success).toBe(true);
		});

		it('should require profile confirmation', () => {
			const noConfirmation = {
				event_id: 1,
				profile_confirmed: false,
			};

			const result = registrationCreateSchema.safeParse(noConfirmation);
			expect(result.success).toBe(false);
		});
	});
});

describe('Localization Helpers', () => {
	describe('validateWithLocalization', () => {
		it('should return localized errors', () => {
			const invalidData = {
				email: 'invalid',
				password: '',
			};

			const result = validateWithLocalization(userLoginSchema, invalidData);

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.errors.length).toBeGreaterThan(0);
				expect(result.errors[0]).toHaveProperty('field');
				expect(result.errors[0]).toHaveProperty('message');
				expect(result.errors[0].message).toHaveProperty('de');
				expect(result.errors[0].message).toHaveProperty('en');
				expect(result.errors[0].message).toHaveProperty('ru');
				expect(result.errors[0].message).toHaveProperty('uk');
			}
		});

		it('should return typed data on success', () => {
			const validData = {
				email: 'test@example.com',
				password: 'password',
			};

			const result = validateWithLocalization(userLoginSchema, validData);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.email).toBe('test@example.com');
				expect(result.data.password).toBe('password');
			}
		});
	});
});
