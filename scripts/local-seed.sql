-- Local development seed data.
-- Login: admin.local@example.test
-- Password: LocalDev123!

INSERT OR IGNORE INTO users (
	email,
	password_hash,
	first_name,
	last_name,
	birth_date,
	address_street,
	address_number,
	address_zip,
	address_city,
	phone,
	whatsapp,
	telegram,
	photo_video_consent,
	parental_consent,
	preferred_language,
	is_blocked,
	created_at,
	updated_at
) VALUES (
	'admin.local@example.test',
	'$2b$10$8abB9lRAeFlxt4WAYA9RR..tC0CXGgzsXDFIoVk.82YKr1o0kA83K',
	'Local',
	'Admin',
	'1990-01-01',
	'Dev Street',
	'1',
	'01067',
	'Dresden',
	'+4911111111111',
	NULL,
	NULL,
	1,
	0,
	'de',
	0,
	datetime('now'),
	datetime('now')
);

INSERT OR IGNORE INTO admins (user_id, created_by, created_at)
SELECT id, NULL, datetime('now')
FROM users
WHERE email = 'admin.local@example.test';

INSERT INTO events (
	title_de,
	title_en,
	title_ru,
	title_uk,
	description_de,
	description_en,
	description_ru,
	description_uk,
	requirements_de,
	requirements_en,
	requirements_ru,
	requirements_uk,
	location_de,
	location_en,
	location_ru,
	location_uk,
	date,
	end_date,
	max_participants,
	registration_deadline,
	telegram_link,
	whatsapp_link,
	status,
	created_by,
	is_listed,
	created_at,
	updated_at
)
SELECT
	'Lokales Testevent',
	'Local test event',
	'Local test event RU',
	'Local test event UK',
	'Dieses Event wurde lokal per Seed angelegt.',
	'This event was created by the local seed.',
	'This event was created by the local seed.',
	'This event was created by the local seed.',
	'Keine',
	'None',
	'None',
	'None',
	'Dresden',
	'Dresden',
	'Dresden',
	'Dresden',
	'2030-06-15T15:00',
	'2030-06-15T17:00',
	20,
	'2030-06-01T23:59',
	'https://t.me/example',
	NULL,
	'active',
	(SELECT id FROM users WHERE email = 'admin.local@example.test'),
	1,
	datetime('now'),
	datetime('now')
WHERE NOT EXISTS (
	SELECT 1 FROM events WHERE title_de = 'Lokales Testevent'
);
