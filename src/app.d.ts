// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces

import type { R2Bucket, D1Database } from '@cloudflare/workers-types';

// Типы для Cloudflare Workers platform
declare global {
	namespace App {
		interface Error {
			message: string;
			code?: string;
		}

		interface Locals {
			user?: {
				id: number;
				email: string;
				firstName: string;
				lastName: string;
				isAdmin: boolean;
			};
			csrfToken?: string;
		}

		// Данные из root layout
		interface PageData {
			user?: {
				id: number;
				email: string;
				isAdmin: boolean;
			} | null;
			locale?: string;
		}

		// Cloudflare Workers bindings
		interface Platform {
			env: {
				DB: D1Database;
				R2_BUCKET: R2Bucket;
				JWT_SECRET: string;
				EMAIL_PROVIDER: string;
				EMAIL_NOOP_LOG_BODY?: string;
				EMAIL_FROM: string;
				EMAIL_REPLY_TO: string;
				EMAIL_BULK_CHUNK: string;
				EMAIL_BULK_PAUSE_MS: string;
				DKIM_DOMAIN?: string;
				DKIM_SELECTOR?: string;
				DKIM_PRIVATE_KEY?: string;
				RESEND_API_KEY?: string; // API-ключ Resend для отправки почты (альтернатива MailChannels)
				R2_PUBLIC_URL: string;
				SETUP_TOKEN?: string;
				CRON_SECRET?: string;
				TURNSTILE_SITE_KEY: string;
				TURNSTILE_SECRET_KEY: string;
			};
			context: ExecutionContext;
			caches: CacheStorage & { default: Cache };
		}
	}
}

export {};
