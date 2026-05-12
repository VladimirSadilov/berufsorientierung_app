<script lang="ts">
	import { _, locale } from 'svelte-i18n';
	import { invalidateAll } from '$app/navigation';
	import Button from '$lib/components/ui/Button.svelte';
	import Modal from '$lib/components/ui/Modal.svelte';
	import Toast from '$lib/components/ui/Toast.svelte';
	import EventFormModal from '$lib/components/admin/EventFormModal.svelte';
	import EventViewModal from '$lib/components/admin/EventViewModal.svelte';
	import CancelEventModal from '$lib/components/admin/CancelEventModal.svelte';
	import type { EventWithStats } from './+page.server';
	import type { EventStatus } from '$lib/types';

	export let data;

	type StatusFilter = EventStatus | 'past' | 'all';

	// Состояние фильтров
	let statusFilter: StatusFilter = 'all';
	let dateFromFilter = '';
	let dateToFilter = '';
	let previousFilterKey = `${statusFilter}|${dateFromFilter}|${dateToFilter}`;

	// Пагинация
	const itemsPerPage = 20;
	let currentPage = 1;

	// Модальные окна
	let showCreateModal = false;
	let showViewModal = false;
	let showEditModal = false;
	let showCancelModal = false;
	let showDeleteModal = false;
	let selectedEvent: EventWithStats | null = null;

	// Toast уведомления
	let toastMessage = '';
	let toastType: 'success' | 'error' | 'info' = 'info';
	let showToast = false;

	// Мобильная панель фильтров
	let showMobileFilters = false;

	// Состояние загрузки для is_listed toggle
	let listedLoadingIds: Set<number> = new Set();

	// Фильтрация мероприятий
	$: filteredEvents = data.events.filter((event: EventWithStats) => {
		const isPast = isPastEvent(event);
		// Фильтр по статусу
		if (statusFilter === 'past') {
			if (!(event.status === 'active' && isPast)) return false;
		} else if (statusFilter === 'active') {
			if (event.status !== 'active' || isPast) return false;
		} else if (statusFilter !== 'all' && event.status !== statusFilter) {
			return false;
		}

		// Фильтр по дате от (сравнение Date)
		if (dateFromFilter) {
			const eventDate = new Date(event.date).getTime();
			const filterDate = new Date(dateFromFilter).getTime();
			if (eventDate < filterDate) return false;
		}

		// Фильтр по дате до (сравнение Date)
		if (dateToFilter) {
			const eventDate = new Date(event.date).getTime();
			const filterDate = new Date(dateToFilter).getTime();
			if (eventDate > filterDate) return false;
		}

		return true;
	});

	// Пагинация
	$: totalPages = Math.ceil(filteredEvents.length / itemsPerPage);
	$: paginatedEvents = filteredEvents.slice(
		(currentPage - 1) * itemsPerPage,
		currentPage * itemsPerPage
	);

	// Сброс на первую страницу при изменении фильтров
	$: {
		const filterKey = `${statusFilter}|${dateFromFilter}|${dateToFilter}`;
		if (filterKey !== previousFilterKey) {
			currentPage = 1;
			previousFilterKey = filterKey;
		}
	}

	$: if (currentPage > Math.max(totalPages, 1)) {
		currentPage = Math.max(totalPages, 1);
	}

	/**
	 * Получить локализованное название мероприятия
	 */
	function getEventTitle(event: EventWithStats, lang: string): string {
		const titles: Record<string, string> = {
			de: event.title_de,
			en: event.title_en || event.title_de,
			ru: event.title_ru || event.title_de,
			uk: event.title_uk || event.title_de,
		};
		return titles[lang] || event.title_de;
	}

	/**
	 * Форматирование даты
	 */
	function formatDate(dateString: string): string {
		const date = new Date(dateString);
		return new Intl.DateTimeFormat($locale || 'de', {
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
		}).format(date);
	}

	/**
	 * Проверка прошедшего мероприятия (end_date <= now или date <= now)
	 */
	function isPastEvent(event: EventWithStats): boolean {
		const now = new Date();
		const eventEndDate = event.end_date ? new Date(event.end_date) : new Date(event.date);
		const endMs = eventEndDate.getTime();
		// В админке если дата невалидна - не помечаем как прошедшее (purely display)
		if (Number.isNaN(endMs)) {
			return false;
		}
		return eventEndDate <= now;
	}

	/**
	 * Получить цвет badge для статуса (с учетом прошедшего мероприятия)
	 */
	function getStatusColor(status: EventStatus, event?: EventWithStats): string {
		// Если мероприятие активное, но прошедшее — серый цвет
		if (status === 'active' && event && isPastEvent(event)) {
			return 'bg-gray-100 text-gray-800';
		}
		const colors: Record<EventStatus, string> = {
			draft: 'bg-gray-100 text-gray-800',
			active: 'bg-green-100 text-green-800',
			cancelled: 'bg-red-100 text-red-800',
		};
		return colors[status];
	}

	/**
	 * Получить текст статуса (с учетом прошедшего мероприятия)
	 */
	function getStatusText(event: EventWithStats): string {
		if (event.status === 'active' && isPastEvent(event)) {
			return $_('admin.events.statusPast');
		}
		return $_(
			`admin.events.status${event.status.charAt(0).toUpperCase() + event.status.slice(1)}`
		);
	}

	/**
	 * Сброс фильтров
	 */
	function resetFilters() {
		statusFilter = 'all';
		dateFromFilter = '';
		dateToFilter = '';
		currentPage = 1;
	}

	/**
	 * Открыть модал просмотра
	 */
	function openViewModal(event: EventWithStats) {
		selectedEvent = event;
		showViewModal = true;
	}

	/**
	 * Открыть модал редактирования
	 */
	function openEditModal(event: EventWithStats) {
		selectedEvent = event;
		showEditModal = true;
	}

	/**
	 * Открыть модал отмены
	 */
	function openCancelModal(event: EventWithStats) {
		selectedEvent = event;
		showCancelModal = true;
	}

	/**
	 * Открыть модал удаления
	 */
	function openDeleteModal(event: EventWithStats) {
		selectedEvent = event;
		showDeleteModal = true;
	}

	/**
	 * Опубликовать мероприятие
	 */
	async function publishEvent(eventId: number) {
		try {
			const response = await fetch('/api/admin/events/publish', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ eventId }),
			});

			if (response.ok) {
				showToastMessage($_('admin.events.publishSuccess'), 'success');
				await invalidateAll();
			} else {
				const error = await response.json();
				showToastMessage(error.message || $_('admin.events.publishError'), 'error');
			}
		} catch (error) {
			console.error('Failed to publish event:', error);
			showToastMessage($_('admin.events.publishError'), 'error');
		}
	}

	/**
	 * Создать мероприятие
	 */
	async function handleCreateEvent(eventData: any) {
		const response = await fetch('/api/admin/events/create', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(eventData),
		});

		if (!response.ok) {
			const errorData = await response.json();

			// Если это ошибка валидации с деталями - форматируем читаемо
			if (errorData.error === 'Validation failed' && errorData.details) {
				const detailsMessage = errorData.details
					.map((d: any) => `${d.field}: ${d.message}`)
					.join('; ');
				throw new Error(detailsMessage);
			}

			// Иначе показываем общее сообщение об ошибке
			throw new Error(errorData.message || $_('admin.events.errors.saveFailed'));
		}

		return response.json();
	}

	/**
	 * Обновить мероприятие
	 */
	async function handleUpdateEvent(eventData: any) {
		const response = await fetch('/api/admin/events/update', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(eventData),
		});

		if (!response.ok) {
			const errorData = await response.json();

			// Если это ошибка валидации с деталями - форматируем читаемо
			if (errorData.error === 'Validation failed' && errorData.details) {
				const detailsMessage = errorData.details
					.map((d: any) => `${d.field}: ${d.message}`)
					.join('; ');
				throw new Error(detailsMessage);
			}

			// Иначе показываем общее сообщение об ошибке
			throw new Error(errorData.message || $_('admin.events.errors.saveFailed'));
		}

		return response.json();
	}

	/**
	 * Отменить мероприятие
	 */
	async function handleCancelEvent(reason: string) {
		if (!selectedEvent) return;

		const response = await fetch('/api/admin/events/cancel', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				event_id: selectedEvent.id,
				cancellation_reason: reason,
			}),
		});

		if (!response.ok) {
			const errorData = await response.json();
			throw new Error(errorData.message || $_('admin.events.errors.cancelFailed'));
		}

		return response.json();
	}

	/**
	 * Удалить мероприятие
	 */
	async function deleteEvent() {
		if (!selectedEvent) return;

		try {
			const response = await fetch('/api/admin/events/delete', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ eventId: selectedEvent.id }),
			});

			if (response.ok) {
				showToastMessage($_('admin.events.deleteSuccess'), 'success');
				showDeleteModal = false;
				selectedEvent = null;
				await invalidateAll();
			} else {
				const error = await response.json();
				showToastMessage(error.message || $_('admin.events.deleteError'), 'error');
			}
		} catch (error) {
			console.error('Failed to delete event:', error);
			showToastMessage($_('admin.events.deleteError'), 'error');
		}
	}

	/**
	 * Показать toast уведомление
	 */
	function showToastMessage(message: string, type: 'success' | 'error' | 'info') {
		toastMessage = message;
		toastType = type;
		showToast = true;
	}

	/**
	 * Изменить флаг is_listed для мероприятия
	 */
	async function setListed(event: EventWithStats, checked: boolean) {
		listedLoadingIds = new Set([...listedLoadingIds, event.id]);

		try {
			const response = await fetch('/api/admin/events/set-listed', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ event_id: event.id, is_listed: checked }),
			});

			if (response.ok) {
				// Обновляем локально
				event.is_listed = checked ? 1 : 0;
				// Принудительно обновляем reactive binding
				data.events = data.events;
				showToastMessage(
					checked
						? $_('admin.events.listingEnabled')
						: $_('admin.events.listingDisabled'),
					'success'
				);
			} else {
				const error = await response.json();
				showToastMessage(error.message || $_('admin.events.listingUpdateError'), 'error');
			}
		} catch (error) {
			console.error('Failed to update is_listed:', error);
			showToastMessage($_('admin.events.listingUpdateError'), 'error');
		} finally {
			listedLoadingIds = new Set([...listedLoadingIds].filter((id) => id !== event.id));
		}
	}

	/**
	 * Перейти на страницу
	 */
	function goToPage(page: number) {
		if (page >= 1 && page <= totalPages) {
			currentPage = page;
		}
	}
</script>

<!-- Header -->
<div class="mb-8">
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
		<h1 class="text-3xl font-bold text-gray-900">
			{$_('admin.events.title')}
		</h1>
		<Button on:click={() => (showCreateModal = true)} variant="primary">
			<svg
				class="w-5 h-5 mr-2"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
				xmlns="http://www.w3.org/2000/svg"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M12 4v16m8-8H4"
				/>
			</svg>
			{$_('admin.events.createEvent')}
		</Button>
	</div>
</div>

<!-- Фильтры -->
<div class="bg-white rounded-lg shadow-sm p-4 mb-6">
	<!-- Mobile: Toggle filters -->
	<button
		class="sm:hidden w-full flex items-center justify-between mb-4 text-gray-700 font-medium"
		on:click={() => (showMobileFilters = !showMobileFilters)}
	>
		<span>{$_('admin.events.filters')}</span>
		<svg
			class="w-5 h-5 transform transition-transform {showMobileFilters ? 'rotate-180' : ''}"
			fill="none"
			stroke="currentColor"
			viewBox="0 0 24 24"
		>
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M19 9l-7 7-7-7"
			/>
		</svg>
	</button>

	<!-- Фильтры (скрыты на мобильном если не раскрыты) -->
	<div class="space-y-4 sm:space-y-0 {showMobileFilters ? 'block' : 'hidden sm:block'}">
		<div class="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-4">
			<!-- Статус -->
			<div>
				<label for="status-filter" class="block text-sm font-medium text-gray-700 mb-1">
					{$_('admin.events.statusFilter')}
				</label>
				<select
					id="status-filter"
					bind:value={statusFilter}
					class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
				>
					<option value="all">{$_('admin.events.allStatuses')}</option>
					<option value="draft">{$_('admin.events.statusDraft')}</option>
					<option value="active">{$_('admin.events.statusActive')}</option>
					<option value="past">{$_('admin.events.statusPast')}</option>
					<option value="cancelled">{$_('admin.events.statusCancelled')}</option>
				</select>
			</div>

			<!-- Дата от -->
			<div>
				<label for="date-from" class="block text-sm font-medium text-gray-700 mb-1">
					{$_('admin.events.dateFrom')}
				</label>
				<input
					id="date-from"
					type="datetime-local"
					bind:value={dateFromFilter}
					class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
				/>
			</div>

			<!-- Дата до -->
			<div>
				<label for="date-to" class="block text-sm font-medium text-gray-700 mb-1">
					{$_('admin.events.dateTo')}
				</label>
				<input
					id="date-to"
					type="datetime-local"
					bind:value={dateToFilter}
					class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
				/>
			</div>

			<!-- Сброс -->
			<div class="flex items-end">
				<Button on:click={resetFilters} variant="secondary" fullWidth>
					{$_('admin.events.resetFilters')}
				</Button>
			</div>
		</div>

		<!-- Счетчик результатов -->
		<div class="text-sm text-gray-600 mt-4">
			{$_('admin.events.showingResults', {
				values: { count: filteredEvents.length, total: data.events.length },
			})}
		</div>
	</div>
</div>

<!-- Таблица (Desktop) -->
<div class="hidden lg:block bg-white rounded-lg shadow-sm overflow-hidden">
	<table class="min-w-full divide-y divide-gray-200">
		<thead class="bg-gray-50">
			<tr>
				<th
					class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
				>
					{$_('admin.events.eventName')}
				</th>
				<th
					class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
				>
					{$_('admin.events.date')}
				</th>
				<th
					class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
				>
					{$_('admin.events.status')}
				</th>
				<th
					class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
				>
					{$_('admin.events.registrations')}
				</th>
				<th
					class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
				>
					{$_('admin.events.qrCodes')}
				</th>
				<th
					class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
				>
					{$_('admin.events.listing')}
				</th>
				<th
					class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
				>
					{$_('admin.events.actions')}
				</th>
			</tr>
		</thead>
		<tbody class="bg-white divide-y divide-gray-200">
			{#each paginatedEvents as event (event.id)}
				<tr class="hover:bg-gray-50">
					<!-- Название -->
					<td class="px-6 py-4 whitespace-nowrap">
						<div class="text-sm font-medium text-gray-900">
							{getEventTitle(event, $locale || 'de')}
						</div>
					</td>

					<!-- Дата -->
					<td class="px-6 py-4 whitespace-nowrap">
						<div class="text-sm text-gray-900">{formatDate(event.date)}</div>
					</td>

					<!-- Статус -->
					<td class="px-6 py-4 whitespace-nowrap">
						<span
							class="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full {getStatusColor(
								event.status,
								event
							)}"
						>
							{getStatusText(event)}
						</span>
					</td>

					<!-- Регистрации -->
					<td class="px-6 py-4 whitespace-nowrap">
						<div class="text-sm text-gray-900">
							{event.registeredCount} / {event.max_participants ||
								$_('admin.events.unlimited')}
						</div>
						{#if event.max_participants && event.registeredCount >= event.max_participants}
							<div class="text-xs text-red-600">{$_('admin.events.full')}</div>
						{/if}
					</td>

					<!-- QR-коды -->
					<td class="px-6 py-4 whitespace-nowrap">
						<div class="flex gap-2">
							{#if event.qr_telegram_url}
								<span class="text-blue-500" title="Telegram QR">
									<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
										<path
											d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.161c-.18.717-.962 4.038-1.359 5.356-.168.558-.5.744-.822.762-.698.064-1.229-.461-1.907-.903-1.061-.692-1.659-1.123-2.687-1.799-.188-.124-.332-.243-.437-.379a.963.963 0 01-.096-.806c.064-.21.342-.468.695-.753.925-.745 2.051-1.63 2.876-2.275.153-.119.18-.284.058-.397-.13-.122-.341-.073-.492.013-.946.537-2.492 1.577-3.462 2.194-.313.199-.596.296-.853.296-.227 0-.664-.07-1.311-.266-.852-.257-1.53-.393-1.472-.83.03-.227.347-.458.951-.69 2.51-1.065 4.184-1.767 5.023-2.107 2.392-.999 2.888-1.172 3.211-1.178.071-.001.231.016.334.1a.367.367 0 01.122.265c.002.036-.002.145-.013.21z"
										/>
									</svg>
								</span>
							{/if}
							{#if event.qr_whatsapp_url}
								<span class="text-green-500" title="WhatsApp QR">
									<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
										<path
											d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"
										/>
									</svg>
								</span>
							{/if}
						</div>
					</td>

					<!-- Листинг на /events -->
					<td class="px-6 py-4 whitespace-nowrap">
						<label class="relative inline-flex items-center cursor-pointer">
							<input
								type="checkbox"
								checked={Boolean(event.is_listed)}
								disabled={listedLoadingIds.has(event.id)}
								on:change={(e) => setListed(event, e.currentTarget.checked)}
								class="sr-only peer"
							/>
							<div
								class="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600 peer-disabled:opacity-50"
							></div>
						</label>
					</td>

					<!-- Действия -->
					<td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
						<div class="flex justify-end gap-2">
							<!-- Просмотр -->
							<button
								on:click={() => openViewModal(event)}
								class="text-blue-600 hover:text-blue-900"
								title={$_('admin.events.view')}
							>
								<svg
									class="w-5 h-5"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
									/>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
									/>
								</svg>
							</button>

							<!-- Редактировать -->
							<button
								on:click={() => openEditModal(event)}
								class="text-yellow-600 hover:text-yellow-900"
								title={$_('admin.events.edit')}
							>
								<svg
									class="w-5 h-5"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
									/>
								</svg>
							</button>

							<!-- Опубликовать (только для draft) -->
							{#if event.status === 'draft'}
								<button
									on:click={() => publishEvent(event.id)}
									class="text-green-600 hover:text-green-900"
									title={$_('admin.events.publish')}
								>
									<svg
										class="w-5 h-5"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M5 13l4 4L19 7"
										/>
									</svg>
								</button>
							{/if}

							<!-- Отменить (только для active) -->
							{#if event.status === 'active' && !isPastEvent(event)}
								<button
									on:click={() => openCancelModal(event)}
									class="text-orange-600 hover:text-orange-900"
									title={$_('admin.events.cancel')}
								>
									<svg
										class="w-5 h-5"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M6 18L18 6M6 6l12 12"
										/>
									</svg>
								</button>
							{/if}

							<!-- Удалить -->
							<button
								on:click={() => openDeleteModal(event)}
								class="text-red-600 hover:text-red-900"
								title={$_('admin.events.delete')}
							>
								<svg
									class="w-5 h-5"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
									/>
								</svg>
							</button>
						</div>
					</td>
				</tr>
			{:else}
				<tr>
					<td colspan="7" class="px-6 py-8 text-center text-gray-500">
						{$_('admin.events.noEvents')}
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<!-- Карточки (Mobile/Tablet) -->
<div class="lg:hidden space-y-4">
	{#each paginatedEvents as event (event.id)}
		<div class="bg-white rounded-lg shadow-sm p-4">
			<!-- Header карточки -->
			<div class="flex justify-between items-start mb-3">
				<h3 class="text-lg font-semibold text-gray-900 flex-1">
					{getEventTitle(event, $locale || 'de')}
				</h3>
				<span
					class="ml-2 px-2 py-1 text-xs leading-5 font-semibold rounded-full {getStatusColor(
						event.status,
						event
					)}"
				>
					{getStatusText(event)}
				</span>
			</div>

			<!-- Детали -->
			<div class="space-y-2 text-sm text-gray-600 mb-4">
				<div class="flex items-center">
					<svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
						/>
					</svg>
					{formatDate(event.date)}
				</div>
				<div class="flex items-center">
					<svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
						/>
					</svg>
					{event.registeredCount} / {event.max_participants ||
						$_('admin.events.unlimited')}
					{#if event.max_participants && event.registeredCount >= event.max_participants}
						<span class="ml-2 text-red-600 font-medium"
							>({$_('admin.events.full')})</span
						>
					{/if}
				</div>
				{#if event.qr_telegram_url || event.qr_whatsapp_url}
					<div class="flex items-center gap-2">
						<span class="text-gray-500">QR:</span>
						{#if event.qr_telegram_url}
							<span class="text-blue-500 flex items-center">
								<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
									<path
										d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.161c-.18.717-.962 4.038-1.359 5.356-.168.558-.5.744-.822.762-.698.064-1.229-.461-1.907-.903-1.061-.692-1.659-1.123-2.687-1.799-.188-.124-.332-.243-.437-.379a.963.963 0 01-.096-.806c.064-.21.342-.468.695-.753.925-.745 2.051-1.63 2.876-2.275.153-.119.18-.284.058-.397-.13-.122-.341-.073-.492.013-.946.537-2.492 1.577-3.462 2.194-.313.199-.596.296-.853.296-.227 0-.664-.07-1.311-.266-.852-.257-1.53-.393-1.472-.83.03-.227.347-.458.951-.69 2.51-1.065 4.184-1.767 5.023-2.107 2.392-.999 2.888-1.172 3.211-1.178.071-.001.231.016.334.1a.367.367 0 01.122.265c.002.036-.002.145-.013.21z"
									/>
								</svg>
							</span>
						{/if}
						{#if event.qr_whatsapp_url}
							<span class="text-green-500 flex items-center">
								<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
									<path
										d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"
									/>
								</svg>
							</span>
						{/if}
					</div>
				{/if}
			</div>

			<!-- Листинг на /events -->
			<div class="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
				<span class="text-sm text-gray-600">{$_('admin.events.listing')}</span>
				<label class="relative inline-flex items-center cursor-pointer">
					<input
						type="checkbox"
						checked={Boolean(event.is_listed)}
						disabled={listedLoadingIds.has(event.id)}
						on:change={(e) => setListed(event, e.currentTarget.checked)}
						class="sr-only peer"
					/>
					<div
						class="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600 peer-disabled:opacity-50"
					></div>
				</label>
			</div>

			<!-- Действия -->
			<div class="flex flex-wrap gap-2">
				<Button on:click={() => openViewModal(event)} variant="secondary" size="sm">
					{$_('admin.events.view')}
				</Button>
				<Button on:click={() => openEditModal(event)} variant="secondary" size="sm">
					{$_('admin.events.edit')}
				</Button>
				{#if event.status === 'draft'}
					<Button on:click={() => publishEvent(event.id)} variant="primary" size="sm">
						{$_('admin.events.publish')}
					</Button>
				{/if}
				{#if event.status === 'active' && !isPastEvent(event)}
					<Button on:click={() => openCancelModal(event)} variant="danger" size="sm">
						{$_('admin.events.cancel')}
					</Button>
				{/if}
				<Button on:click={() => openDeleteModal(event)} variant="danger" size="sm">
					{$_('admin.events.delete')}
				</Button>
			</div>
		</div>
	{:else}
		<div class="bg-white rounded-lg shadow-sm p-8 text-center text-gray-500">
			{$_('admin.events.noEvents')}
		</div>
	{/each}
</div>

<!-- Пагинация -->
{#if totalPages > 1}
	<div class="mt-6 flex justify-center">
		<nav
			class="relative z-0 inline-flex rounded-md shadow-sm -space-x-px"
			aria-label="Pagination"
		>
			<!-- Previous -->
			<button
				on:click={() => goToPage(currentPage - 1)}
				disabled={currentPage === 1}
				class="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
			>
				<span class="sr-only">Previous</span>
				<svg class="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
					<path
						fill-rule="evenodd"
						d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
						clip-rule="evenodd"
					/>
				</svg>
			</button>

			<!-- Номера страниц -->
			{#each Array(totalPages) as _, i}
				{@const page = i + 1}
				{@const isActive = page === currentPage}
				{#if page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1)}
					<button
						on:click={() => goToPage(page)}
						class:z-10={isActive}
						class:bg-blue-50={isActive}
						class:border-blue-500={isActive}
						class:text-blue-600={isActive}
						class:bg-white={!isActive}
						class:border-gray-300={!isActive}
						class:text-gray-700={!isActive}
						class:hover:bg-gray-50={!isActive}
						class="relative inline-flex items-center px-4 py-2 border text-sm font-medium"
					>
						{page}
					</button>
				{:else if page === currentPage - 2 || page === currentPage + 2}
					<span
						class="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700"
					>
						...
					</span>
				{/if}
			{/each}

			<!-- Next -->
			<button
				on:click={() => goToPage(currentPage + 1)}
				disabled={currentPage === totalPages}
				class="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
			>
				<span class="sr-only">Next</span>
				<svg class="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
					<path
						fill-rule="evenodd"
						d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
						clip-rule="evenodd"
					/>
				</svg>
			</button>
		</nav>
	</div>
{/if}

<!-- Модальные окна -->

<!-- Создание мероприятия -->
<EventFormModal
	isOpen={showCreateModal}
	mode="create"
	onClose={() => (showCreateModal = false)}
	onSave={handleCreateEvent}
	on:success={() => {
		showCreateModal = false;
		showToastMessage($_('admin.events.createSuccess'), 'success');
		invalidateAll();
	}}
/>

<!-- Редактирование мероприятия -->
<EventFormModal
	isOpen={showEditModal && selectedEvent !== null}
	mode="edit"
	event={selectedEvent}
	onClose={() => {
		showEditModal = false;
		selectedEvent = null;
	}}
	onSave={handleUpdateEvent}
	on:success={() => {
		showEditModal = false;
		selectedEvent = null;
		showToastMessage($_('admin.events.updateSuccess'), 'success');
		invalidateAll();
	}}
/>

<!-- Просмотр мероприятия -->
{#if showViewModal && selectedEvent}
	<EventViewModal
		isOpen={showViewModal}
		eventId={selectedEvent.id}
		onClose={() => {
			// Закрытие по программному сценарию (например, при переходе к редактированию)
			// Не сбрасываем selectedEvent, чтобы переиспользовать его в EditModal
			showViewModal = false;
		}}
		on:edit={(e) => {
			showViewModal = false;
			showEditModal = true;
		}}
		on:close={() => {
			showViewModal = false;
			selectedEvent = null;
		}}
	/>
{/if}

<!-- Отмена мероприятия -->
{#if showCancelModal && selectedEvent}
	<CancelEventModal
		isOpen={showCancelModal}
		event={selectedEvent}
		registrationsCount={selectedEvent.registeredCount || 0}
		onClose={() => {
			showCancelModal = false;
			selectedEvent = null;
		}}
		onCancel={handleCancelEvent}
		on:success={() => {
			showCancelModal = false;
			selectedEvent = null;
			showToastMessage($_('admin.events.cancelSuccess'), 'success');
			invalidateAll();
		}}
	/>
{/if}

<!-- Подтверждение удаления -->
{#if showDeleteModal && selectedEvent}
	<Modal
		title={$_('admin.events.deleteConfirmTitle')}
		on:close={() => {
			showDeleteModal = false;
			selectedEvent = null;
		}}
	>
		<div class="space-y-4">
			<p class="text-gray-700">
				{$_('admin.events.deleteConfirmMessage', {
					values: { title: getEventTitle(selectedEvent, $locale || 'de') },
				})}
			</p>
			<p class="text-sm text-red-600">
				{$_('admin.events.deleteWarning')}
			</p>
		</div>

		<svelte:fragment slot="actions">
			<Button
				on:click={() => {
					showDeleteModal = false;
					selectedEvent = null;
				}}
				variant="secondary"
			>
				{$_('common.cancel')}
			</Button>
			<Button on:click={deleteEvent} variant="danger">
				{$_('admin.events.delete')}
			</Button>
		</svelte:fragment>
	</Modal>
{/if}

<!-- Toast уведомления -->
{#if showToast}
	<Toast
		message={toastMessage}
		type={toastType}
		on:close={() => (showToast = false)}
		duration={4000}
	/>
{/if}
