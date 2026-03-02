<script lang="ts">
	/**
	 * Cloudflare Turnstile Widget Component
	 *
	 * Интегрирует Turnstile виджет для защиты форм от ботов.
	 * Автоматически загружает Turnstile SDK и рендерит виджет.
	 *
	 * @see https://developers.cloudflare.com/turnstile/
	 */

	import { onMount } from 'svelte';

	/** Публичный Site Key от Cloudflare Turnstile */
	export let siteKey: string;

	/** Тема виджета: light, dark или auto (определяется системой) */
	export let theme: 'light' | 'dark' | 'auto' = 'auto';

	/** Размер виджета: normal, compact, flexible */
	export let size: 'normal' | 'compact' | 'flexible' = 'normal';

	/** Опциональный action для дополнительной идентификации (например, 'login', 'register') */
	export let action: string | undefined = undefined;

	/** Опциональный внешний вид: always (всегда видим), execute (невидимый, запускается программно), interaction-only */
	export let appearance: 'always' | 'execute' | 'interaction-only' = 'always';

	/** ID контейнера для виджета */
	let containerId = `turnstile-${Math.random().toString(36).substring(2, 9)}`;

	/** Флаг загрузки скрипта */
	let scriptLoaded = false;

	/** ID виджета Turnstile (для программного управления) */
	let widgetId: string | undefined;

	/**
	 * Экспортируем функцию сброса виджета для родительского компонента
	 */
	export function reset() {
		if (widgetId !== undefined && window.turnstile) {
			try {
				window.turnstile.reset(widgetId);
			} catch (error) {
				console.error('Error resetting Turnstile widget:', error);
			}
		}
	}

	/**
	 * Загружает Turnstile SDK скрипт
	 */
	function loadTurnstileScript(): Promise<void> {
		return new Promise((resolve, reject) => {
			// Проверяем, не загружен ли скрипт уже
			if (window.turnstile) {
				scriptLoaded = true;
				resolve();
				return;
			}

			// Проверяем, нет ли уже загружающегося скрипта
			const existingScript = document.querySelector(
				'script[src*="challenges.cloudflare.com/turnstile"]'
			);

			if (existingScript) {
				// Скрипт уже загружается, ждём его
				existingScript.addEventListener('load', () => {
					scriptLoaded = true;
					resolve();
				});
				existingScript.addEventListener('error', reject);
				return;
			}

			// Создаём новый script элемент
			const script = document.createElement('script');
			script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
			script.async = true;
			script.defer = true;

			script.addEventListener('load', () => {
				scriptLoaded = true;
				resolve();
			});

			script.addEventListener('error', () => {
				reject(new Error('Failed to load Turnstile script'));
			});

			document.head.appendChild(script);
		});
	}

	/**
	 * Рендерит Turnstile виджет
	 */
	function renderWidget() {
		if (!scriptLoaded || !window.turnstile) {
			console.error('Turnstile script not loaded');
			return;
		}

		const container = document.getElementById(containerId);
		if (!container) {
			console.error('Turnstile container not found');
			return;
		}

		// Параметры виджета
		const options: any = {
			sitekey: siteKey,
			theme,
			size,
			appearance,
		};
		options['expired-callback'] = () => {
			if (widgetId !== undefined && window.turnstile) {
				window.turnstile.reset(widgetId);
			}
		};
		options['error-callback'] = () => {
			if (widgetId !== undefined && window.turnstile) {
				window.turnstile.reset(widgetId);
			}
		};

		// Добавляем action если указан
		if (action) {
			options.action = action;
		}

		try {
			// Рендерим виджет
			widgetId = window.turnstile.render(`#${containerId}`, options);
		} catch (error) {
			console.error('Error rendering Turnstile widget:', error);
		}
	}

	/**
	 * Инициализация при монтировании компонента
	 */
	onMount(async () => {
		try {
			await loadTurnstileScript();
			renderWidget();
		} catch (error) {
			console.error('Error initializing Turnstile:', error);
		}
	});
</script>

<!--
	Контейнер для Turnstile виджета.
	Виджет автоматически добавит скрытое поле cf-turnstile-response в родительскую форму.
-->
<div id={containerId} class="turnstile-container"></div>

<style>
	.turnstile-container {
		/* Центрируем виджет */
		display: flex;
		justify-content: center;
		align-items: center;
		margin: 1rem 0;
	}

	/* Для мобильных устройств уменьшаем отступы */
	@media (max-width: 640px) {
		.turnstile-container {
			margin: 0.75rem 0;
		}
	}
</style>
