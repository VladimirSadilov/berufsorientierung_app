<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { Button, FormField } from '$lib/components/ui';
	import Turnstile from '$lib/components/security/Turnstile.svelte';
	import { userLoginSchema } from '$lib/validation/schemas';
	import type { UserLoginData } from '$lib/types/user';
	import { setUser } from '$lib/stores/user';
	import { changeLanguage } from '$lib/stores/language';
	import { _ } from 'svelte-i18n';

	// Данные из server load функции (включая CSRF токен и Turnstile site key)
	export let data: { csrfToken?: string; turnstileSiteKey?: string };

	/**
	 * Sanitize redirectTo parameter to prevent open-redirect attacks.
	 * Only allows internal relative paths starting with `/` but not `//`.
	 */
	function getSafeRedirectTo(value: string | null): string | null {
		if (!value) return null;
		// Must start with `/` and NOT start with `//`
		if (value.startsWith('/') && !value.startsWith('//')) {
			return value;
		}
		return null;
	}

	// Get sanitized redirectTo from URL
	$: safeRedirectTo = getSafeRedirectTo($page.url.searchParams.get('redirectTo'));

	// Check if redirectTo leads to event registration
	$: isEventRegistrationFlow = safeRedirectTo
		? /^\/events\/[^/]+\/register/.test(safeRedirectTo)
		: false;

	/**
	 * Handle cancel button click - go back or to events page
	 */
	function handleCancelFlow() {
		if (typeof window !== 'undefined' && window.history.length > 1) {
			window.history.back();
		} else {
			goto('/events');
		}
	}

	// Состояние формы
	let formData: UserLoginData = {
		email: '',
		password: '',
	};

	// Состояние валидации
	let errors: Record<string, string> = {};
	let isSubmitting = false;
	let errorMessage = '';
	let showPassword = false;
	let turnstileComponent: any;

	/**
	 * Валидация поля на клиенте
	 */
	function validateField(fieldName: keyof UserLoginData) {
		try {
			// Валидируем всю форму, но показываем ошибку только для конкретного поля
			userLoginSchema.parse(formData);
			// Если валидация прошла, удаляем ошибку для этого поля
			delete errors[fieldName];
			errors = errors;
		} catch (err: any) {
			// Извлекаем ошибки для конкретного поля
			const fieldErrors = err.issues.filter((issue: any) => issue.path[0] === fieldName);
			if (fieldErrors.length > 0) {
				// Маппим i18n ключ через $_ с fallback на сам ключ
				const errorKey = fieldErrors[0].message;
				errors[fieldName] = $_(errorKey, { default: errorKey });
			} else {
				delete errors[fieldName];
			}
			errors = errors;
		}
	}

	/**
	 * Обработка отправки формы
	 */
	async function handleSubmit(event: Event) {
		event.preventDefault();

		// Сбрасываем предыдущие ошибки
		errors = {};
		errorMessage = '';
		isSubmitting = true;

		try {
			// Валидация на клиенте
			const validatedData = userLoginSchema.parse(formData);

			// Извлекаем Turnstile токен из формы
			const form = event.target as HTMLFormElement;
			const turnstileToken =
				form.querySelector<HTMLInputElement>('input[name="cf-turnstile-response"]')
					?.value || '';

			// Проверяем наличие Turnstile токена
			if (!turnstileToken) {
				errorMessage = $_('validation.turnstile_required', {
					default: 'Подтвердите, что вы не робот',
				});
				isSubmitting = false;
				return;
			}

			// Отправляем запрос на сервер
			const response = await fetch('/api/auth/login', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					// Добавляем CSRF токен в заголовок для защиты от атак
					...(data.csrfToken && { 'X-CSRF-Token': data.csrfToken }),
				},
				body: JSON.stringify({
					...validatedData,
					// Добавляем CSRF токен в тело запроса как fallback
					csrfToken: data.csrfToken,
					// Добавляем Turnstile токен для верификации на сервере
					turnstileToken,
				}),
			});

			const result = await response.json();

			if (!response.ok) {
				if (turnstileComponent?.reset) {
					turnstileComponent.reset();
				}

				// Обработка ошибок с сервера
				if (result.errors && Array.isArray(result.errors)) {
					// Ошибки валидации
					result.errors.forEach((err: any) => {
						if (err.field && err.message) {
							// Если сообщение - строка (i18n ключ), переводим его
							if (typeof err.message === 'string') {
								errors[err.field] = $_(err.message, { default: err.message });
							} else {
								// Используем сообщение на текущем языке (старый формат)
								errors[err.field] = err.message.de || err.message.en || err.message;
							}
						}
					});
					errors = errors;
				} else if (result.error) {
					errorMessage = result.error;
				} else {
					errorMessage = 'Вход не удался. Проверьте email и пароль.';
				}
				return;
			}

			// Успешный вход
			if (result.user) {
				setUser(result.user);

				// Переключаем язык на предпочитаемый пользователем
				if (result.user.preferred_language) {
					await changeLanguage(result.user.preferred_language);
				}
			}

			// Редирект на целевую страницу или главную
			await goto(safeRedirectTo ?? '/');
		} catch (err: any) {
			if (turnstileComponent?.reset) {
				turnstileComponent.reset();
			}

			if (err.errors) {
				// Ошибки валидации Zod
				err.errors.forEach((error: any) => {
					if (error.path && error.path.length > 0) {
						// Маппим i18n ключ через $_ с fallback на сам ключ
						const errorKey = error.message;
						errors[error.path[0]] = $_(errorKey, { default: errorKey });
					}
				});
				errors = errors;
			} else {
				errorMessage = err.message || 'Произошла ошибка при входе';
			}
		} finally {
			isSubmitting = false;
		}
	}

	/**
	 * Переключение видимости пароля
	 */
	function togglePasswordVisibility() {
		showPassword = !showPassword;
	}
</script>

<svelte:head>
	<title>{$_('auth.loginTitle')} | Berufsorientierung</title>
	<meta name="description" content={$_('auth.loginTitle') + ' - Berufsorientierung'} />
</svelte:head>

<div class="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
	<div class="max-w-md w-full">
		<!-- Заголовок -->
		<div class="text-center mb-8">
			<h1 class="text-3xl font-bold text-gray-900 mb-2">{$_('auth.loginTitle')}</h1>
			<p class="text-gray-600">
				{$_('auth.loginSubtitle', {
					default: 'Войдите для участия в мероприятиях Berufsorientierung',
				})}
			</p>
		</div>

		<!-- Инфо-блок для регистрации на мероприятие -->
		{#if isEventRegistrationFlow}
			<div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
				<div class="flex items-start gap-3">
					<svg
						class="w-6 h-6 text-blue-600 shrink-0 mt-0.5"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
						/>
					</svg>
					<div class="flex-1">
						<h3 class="text-sm font-semibold text-blue-900 mb-1">
							{$_('auth.eventFlow.title')}
						</h3>
						<p class="text-sm text-blue-800">
							{$_('auth.eventFlow.stepHint')}
						</p>
					</div>
				</div>
				<div class="mt-3 flex justify-end">
					<button
						type="button"
						class="text-sm font-medium text-blue-700 hover:text-blue-900 hover:underline"
						on:click={handleCancelFlow}
					>
						{$_('auth.eventFlow.cancel')}
					</button>
				</div>
			</div>
		{/if}

		<!-- Форма входа -->
		<div class="bg-white rounded-lg shadow-md p-8">
			<form on:submit={handleSubmit} novalidate>
				<!-- CSRF токен для защиты от атак -->
				{#if data.csrfToken}
					<input type="hidden" name="_csrf" value={data.csrfToken} />
				{/if}

				<!-- Общее сообщение об ошибке -->
				{#if errorMessage}
					<div class="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg" role="alert">
						<div class="flex">
							<div class="shrink-0">
								<svg
									class="h-5 w-5 text-red-400"
									viewBox="0 0 20 20"
									fill="currentColor"
								>
									<path
										fill-rule="evenodd"
										d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
										clip-rule="evenodd"
									/>
								</svg>
							</div>
							<div class="ml-3">
								<p class="text-sm text-red-800">{errorMessage}</p>
							</div>
						</div>
					</div>
				{/if}

				<!-- Поля формы -->
				<div class="space-y-4 mb-6">
					<FormField
						label={$_('form.email', { default: 'Email' })}
						type="email"
						name="email"
						bind:value={formData.email}
						error={errors.email}
						required
						autocomplete="email"
						on:blur={() => validateField('email')}
						placeholder={$_('form.emailPlaceholder', { default: 'beispiel@email.de' })}
					/>

					<div class="relative">
						<FormField
							label={$_('form.password', { default: 'Пароль' })}
							type={showPassword ? 'text' : 'password'}
							name="password"
							bind:value={formData.password}
							error={errors.password}
							required
							autocomplete="current-password"
							on:blur={() => validateField('password')}
							placeholder={$_('form.passwordPlaceholder', {
								default: 'Введите пароль',
							})}
						/>
						<button
							type="button"
							class="absolute right-3 top-11 text-gray-500 hover:text-gray-700 transition-colors"
							on:click={togglePasswordVisibility}
							aria-label={showPassword
								? $_('form.hidePassword', { default: 'Скрыть пароль' })
								: $_('form.showPassword', { default: 'Показать пароль' })}
						>
							{#if showPassword}
								<!-- Иконка: глаз закрыт -->
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
										d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
									/>
								</svg>
							{:else}
								<!-- Иконка: глаз открыт -->
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
							{/if}
						</button>
					</div>
				</div>

				<!-- Забыли пароль (TODO: реализовать позже) -->
				<div class="flex items-center justify-end mb-6">
					<a
						href="/forgot-password"
						class="text-sm font-medium text-blue-600 hover:text-blue-500 hover:underline"
					>
						{$_('auth.forgotPassword', { default: 'Забыли пароль?' })}
					</a>
				</div>

				<!-- Cloudflare Turnstile (защита от ботов) -->
				{#if data.turnstileSiteKey}
					<Turnstile bind:this={turnstileComponent} siteKey={data.turnstileSiteKey} action="login" />
				{/if}

				<!-- Кнопка входа -->
				<Button
					type="submit"
					variant="primary"
					loading={isSubmitting}
					disabled={isSubmitting}
					class="w-full"
				>
					{isSubmitting
						? $_('auth.loggingIn', { default: 'Вход...' })
						: $_('auth.loginButton', { default: 'Войти' })}
				</Button>
			</form>

			<!-- Разделитель -->
			<div class="mt-6">
				<div class="relative">
					<div class="absolute inset-0 flex items-center">
						<div class="w-full border-t border-gray-300"></div>
					</div>
					<div class="relative flex justify-center text-sm">
						<span class="px-2 bg-white text-gray-500">
							{$_('auth.noAccount', { default: 'Нет аккаунта?' })}
						</span>
					</div>
				</div>
			</div>

			<!-- Ссылка на регистрацию -->
			<div class="mt-6">
				<Button
					type="button"
					variant="secondary"
					on:click={() =>
						goto(
							safeRedirectTo
								? '/register?redirectTo=' + encodeURIComponent(safeRedirectTo)
								: '/register'
						)}
					disabled={isSubmitting}
					class="w-full"
				>
					{$_('auth.registerButton', { default: 'Зарегистрироваться' })}
				</Button>
			</div>
		</div>

		<!-- Дополнительная информация -->
		<div class="mt-8 text-center">
			<p class="text-sm text-gray-600">
				{$_('auth.loginProblems', { default: 'Проблемы с входом?' })}
				<a
					href="/support"
					class="font-medium text-blue-600 hover:text-blue-500 hover:underline"
				>
					{$_('auth.contactUs', { default: 'Свяжитесь с нами' })}
				</a>
			</p>
		</div>
	</div>
</div>

<style>
	/* Дополнительная анимация для плавности */
	form {
		animation: fadeIn 0.3s ease-in;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateY(-10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>
