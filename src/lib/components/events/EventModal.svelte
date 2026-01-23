<script lang="ts">
	/**
	 * EventModal - модальное окно с полной информацией о мероприятии
	 *
	 * Отображает:
	 * - Название (на текущем языке с fallback на немецкий)
	 * - Дата и время
	 * - Место проведения (на текущем языке)
	 * - Описание (полное, на текущем языке)
	 * - Требования (если есть)
	 * - Информацию о местах и дедлайне
	 * - Кнопки действия (такие же как в EventCard)
	 */

	import { _ } from 'svelte-i18n';
	import { currentLanguage } from '$lib/stores/language';
	import type { EventWithStats } from '../../../routes/+page.server';
	import Modal from '../ui/Modal.svelte';
	import Button from '../ui/Button.svelte';

	// Props
	export let event: EventWithStats;
	export let isOpen: boolean = false;
	export let onClose: () => void;

	// Получение переведённых полей с fallback на немецкий
	$: title = getTranslatedField('title');
	$: description = getTranslatedField('description');
	$: requirements = getTranslatedField('requirements');
	$: location = getTranslatedField('location');

	// Определение прошедшего мероприятия (end_date <= now или date <= now)
	$: isPastEvent = (() => {
		const now = new Date();
		const eventEndDate = event.end_date ? new Date(event.end_date) : new Date(event.date);
		const endMs = eventEndDate.getTime();
		// Если дата невалидна - fail-closed (лучше показать "Прошедшее" и скрыть CTA)
		if (Number.isNaN(endMs)) {
			return true;
		}
		return eventEndDate <= now;
	})();

	// Определение можно ли записаться
	$: canRegister =
		!isPastEvent && !event.isDeadlinePassed && event.spotsLeft > 0 && !event.isUserRegistered;

	/**
	 * Получает переведённое поле с fallback на немецкий
	 */
	function getTranslatedField(
		fieldName: 'title' | 'description' | 'requirements' | 'location'
	): string {
		const lang = $currentLanguage;
		const fieldKey = `${fieldName}_${lang}` as keyof typeof event;
		const fallbackKey = `${fieldName}_de` as keyof typeof event;

		const translated = event[fieldKey];
		const fallback = event[fallbackKey];

		// Возвращаем переведённое значение если оно не пустое, иначе fallback
		if (translated && typeof translated === 'string' && translated.trim()) {
			return translated;
		}

		return (fallback as string) || '';
	}

	/**
	 * Форматирует дату для отображения (полный формат)
	 */
	function formatDate(dateString: string): string {
		try {
			const date = new Date(dateString);
			const lang = $currentLanguage;

			return date.toLocaleDateString(lang, {
				weekday: 'long',
				year: 'numeric',
				month: 'long',
				day: 'numeric',
			});
		} catch (error) {
			console.error('Error formatting date:', error);
			return dateString;
		}
	}

	/**
	 * Форматирует время для отображения
	 */
	function formatTime(dateString: string): string {
		try {
			const date = new Date(dateString);
			const lang = $currentLanguage;

			return date.toLocaleTimeString(lang, {
				hour: '2-digit',
				minute: '2-digit',
			});
		} catch (error) {
			console.error('Error formatting time:', error);
			return '';
		}
	}

	/**
	 * Форматирует дедлайн регистрации
	 */
	function formatDeadline(dateString: string): string {
		try {
			const date = new Date(dateString);
			const lang = $currentLanguage;

			return date.toLocaleDateString(lang, {
				year: 'numeric',
				month: 'long',
				day: 'numeric',
				hour: '2-digit',
				minute: '2-digit',
			});
		} catch (error) {
			console.error('Error formatting deadline:', error);
			return dateString;
		}
	}

	/**
	 * Обработчик клика по кнопке регистрации
	 */
	function handleRegisterClick() {
		window.location.href = `/events/${event.id}/register`;
	}

	/**
	 * Обработчик клика по кнопке входа
	 */
	function handleLoginClick() {
		window.location.href = `/login?redirectTo=${encodeURIComponent(`/events/${event.id}/register`)}`;
	}
</script>

<Modal {isOpen} {onClose} {title}>
	<!-- Содержимое модального окна -->
	<div class="space-y-6">
		<!-- Постер мероприятия (если есть) -->
		{#if event.poster_url}
			<div
				class="w-full aspect-[4/3] sm:aspect-video overflow-hidden rounded-lg bg-gray-50 border border-gray-200"
			>
				<img
					src={event.poster_url}
					alt={title}
					class="w-full h-full object-contain"
					loading="lazy"
					decoding="async"
				/>
			</div>
		{/if}

		<!-- Дата и время -->
		<div class="flex items-start space-x-3">
			<svg
				class="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
				></path>
			</svg>
			<div>
				<p class="text-sm text-gray-600">{$_('events.date')}</p>
				<p class="text-base font-medium text-gray-900">
					{formatDate(event.date)}
				</p>
				<p class="text-sm text-gray-700">
					{$_('events.time')}: <span class="font-medium">{formatTime(event.date)}</span>
				</p>
			</div>
		</div>

		<!-- Место проведения -->
		{#if location}
			<div class="flex items-start space-x-3">
				<svg
					class="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
					></path>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
					></path>
				</svg>
				<div>
					<p class="text-sm text-gray-600">{$_('events.location')}</p>
					<p class="text-base font-medium text-gray-900">{location}</p>
				</div>
			</div>
		{/if}

		<!-- Описание -->
		{#if description}
			<div>
				<h3 class="text-base font-semibold text-gray-900 mb-2">
					{$_('events.description')}
				</h3>
				<p class="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
					{description}
				</p>
			</div>
		{/if}

		<!-- Требования -->
		{#if requirements}
			<div>
				<h3 class="text-base font-semibold text-gray-900 mb-2">
					{$_('events.requirements')}
				</h3>
				<p class="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
					{requirements}
				</p>
			</div>
		{/if}

		<!-- Информация о местах -->
		<div class="bg-gray-50 rounded-lg p-4 space-y-3">
			<!-- Участники -->
			<div class="flex justify-between items-center">
				<span class="text-sm text-gray-600">{$_('events.participants')}</span>
				<span class="text-sm font-semibold text-gray-900">
					{event.registeredCount} / {event.max_participants}
				</span>
			</div>

			<!-- Оставшиеся места -->
			<div class="flex justify-between items-center">
				<span class="text-sm text-gray-600">{$_('events.spotsLeft')}</span>
				<span
					class="text-sm font-semibold"
					class:text-red-600={event.spotsLeft === 0}
					class:text-green-600={event.spotsLeft > 0}
				>
					{event.spotsLeft}
				</span>
			</div>

			<!-- Прогресс-бар -->
			<div class="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
				{#if event.max_participants}
					<div
						class="h-full transition-all duration-500 rounded-full"
						class:bg-red-500={event.registeredCount >= event.max_participants}
						class:bg-orange-500={event.registeredCount >=
							event.max_participants * 0.8 &&
							event.registeredCount < event.max_participants}
						class:bg-yellow-500={event.registeredCount >=
							event.max_participants * 0.5 &&
							event.registeredCount < event.max_participants * 0.8}
						class:bg-green-500={event.registeredCount < event.max_participants * 0.5}
						style="width: {Math.min(
							(event.registeredCount / event.max_participants) * 100,
							100
						)}%"
					></div>
				{:else}
					<!-- Безлимитные события - показываем зелёный индикатор -->
					<div class="h-full bg-green-500 rounded-full" style="width: 100%"></div>
				{/if}
			</div>

			<!-- Дедлайн регистрации -->
			<div class="flex justify-between items-center pt-2 border-t border-gray-200">
				<span class="text-sm text-gray-600">{$_('events.registrationDeadline')}</span>
				<span class="text-sm font-medium text-gray-900">
					{formatDeadline(event.registration_deadline)}
				</span>
			</div>

			<!-- Статус дедлайна или прошедшего мероприятия -->
			{#if isPastEvent}
				<div
					class="bg-gray-100 text-gray-800 px-3 py-2 rounded-md text-sm text-center font-medium"
				>
					{$_('events.status.past')}
				</div>
			{:else if event.isDeadlinePassed}
				<div
					class="bg-red-100 text-red-800 px-3 py-2 rounded-md text-sm text-center font-medium"
				>
					{$_('events.status.deadlinePassed')}
				</div>
			{/if}
		</div>

		<!-- Статус пользователя -->
		{#if event.isUserRegistered}
			<div class="bg-green-50 border border-green-200 rounded-lg p-4">
				<div class="flex items-center space-x-2">
					<svg class="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
						<path
							fill-rule="evenodd"
							d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
							clip-rule="evenodd"
						></path>
					</svg>
					<span class="text-sm font-medium text-green-800">
						{$_('events.status.registered')}
					</span>
				</div>
			</div>
		{/if}

		<!-- Кнопки действия -->
		<div class="flex flex-col sm:flex-row gap-3 pt-4">
			{#if event.isUserRegistered}
				<!-- Пользователь уже записан -->
				<Button variant="secondary" type="button" fullWidth on:click={onClose}>
					{$_('ui.modal.close')}
				</Button>
			{:else if !event.isUserRegistered && typeof event.isUserRegistered === 'boolean'}
				<!-- Пользователь авторизован, но не записан -->
				{#if canRegister}
					<Button
						variant="primary"
						type="button"
						fullWidth
						on:click={handleRegisterClick}
					>
						{$_('events.register')}
					</Button>
					<Button variant="secondary" type="button" fullWidth on:click={onClose}>
						{$_('ui.modal.close')}
					</Button>
				{:else}
					<Button variant="secondary" type="button" fullWidth disabled>
						{#if isPastEvent}
							{$_('events.status.past')}
						{:else if event.isDeadlinePassed}
							{$_('events.status.deadlinePassed')}
						{:else}
							{$_('events.status.full')}
						{/if}
					</Button>
					<Button variant="secondary" type="button" fullWidth on:click={onClose}>
						{$_('ui.modal.close')}
					</Button>
				{/if}
			{:else}
				<!-- Пользователь не авторизован -->
				{#if canRegister}
					<Button variant="primary" type="button" fullWidth on:click={handleLoginClick}>
						{$_('events.loginToRegister')}
					</Button>
				{:else}
					<Button variant="secondary" type="button" fullWidth disabled>
						{#if isPastEvent}
							{$_('events.status.past')}
						{:else if event.isDeadlinePassed}
							{$_('events.status.deadlinePassed')}
						{:else}
							{$_('events.status.full')}
						{/if}
					</Button>
				{/if}
				<Button variant="secondary" type="button" fullWidth on:click={onClose}>
					{$_('ui.modal.close')}
				</Button>
			{/if}
		</div>
	</div>
</Modal>

<style>
	/* Форматирование whitespace для сохранения переносов строк */
	.whitespace-pre-wrap {
		white-space: pre-wrap;
		word-wrap: break-word;
	}
</style>
