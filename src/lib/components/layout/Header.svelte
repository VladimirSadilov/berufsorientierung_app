<script lang="ts">
	/**
	 * Header Component
	 * Sticky navigation с логотипом, меню и языковым переключателем
	 * Мобильное бургер-меню для экранов <768px
	 *
	 * Источник правды: user store (синхронизируется с сервером в +layout.svelte)
	 */

	import { page } from '$app/stores';
	import { _ } from 'svelte-i18n';
	import { clickOutside } from '$lib/utils/clickOutside';
	import LanguageSwitcher from './LanguageSwitcher.svelte';
	import { user as userStore, clearUser } from '$lib/stores/user';
	import type { User } from '$lib/types';

	// Типы
	type HeaderUser = User & { isAdmin: boolean };

	// Пропсы (используются только для SSR рендеринга, синхронизация происходит в layout)
	let { user = null } = $props<{ user: HeaderUser | null }>();

	// Источник правды - store, автоматически реагирует на изменения
	const currentUser = $derived($userStore as HeaderUser | null);

	// Состояние мобильного меню
	let isMobileMenuOpen = $state(false);

	// Ссылки навигации (теперь зависят от currentUser из стора)
	const navLinks = $derived([
		{ href: '/', label: $_('nav.home'), requireAuth: false },
		{ href: '/events', label: $_('nav.events'), requireAuth: false },
		{ href: '/reviews', label: $_('nav.reviews'), requireAuth: false },
		...(currentUser
			? [
					{ href: '/profile', label: $_('nav.profile'), requireAuth: true },
					...(currentUser.isAdmin
						? [
								{
									href: '/admin',
									label: $_('nav.admin'),
									requireAuth: true,
									adminOnly: true,
								},
							]
						: []),
				]
			: []),
	]);

	// Кнопки авторизации (теперь зависят от currentUser из стора)
	const authButtons = $derived(
		currentUser
			? [{ href: '/api/auth/logout', label: $_('nav.logout'), isLogout: true }]
			: [
					{ href: '/login', label: $_('nav.login'), isLogout: false },
					{ href: '/register', label: $_('nav.register'), isLogout: false },
				]
	);

	/**
	 * Переключает мобильное меню
	 */
	function toggleMobileMenu() {
		isMobileMenuOpen = !isMobileMenuOpen;
	}

	/**
	 * Закрывает мобильное меню
	 */
	function closeMobileMenu() {
		isMobileMenuOpen = false;
	}

	/**
	 * Обрабатывает клик по кнопке logout
	 */
	async function handleLogout(event: MouseEvent) {
		event.preventDefault();
		closeMobileMenu();

		// Отправляем POST запрос на logout
		try {
			const response = await fetch('/api/auth/logout', { method: 'POST' });
			if (response.ok) {
				// Очищаем store перед редиректом
				clearUser();
				// Перезагружаем страницу для обновления состояния
				window.location.href = '/';
			}
		} catch (error) {
			console.error('Logout error:', error);
		}
	}

	/**
	 * Закрывает меню при клике вне его
	 */
	function handleClickOutside() {
		if (isMobileMenuOpen) {
			closeMobileMenu();
		}
	}

	/**
	 * Opens admin tab via window.open() so it can be closed via window.close()
	 * Only uses preventDefault if popup succeeded, otherwise lets default link behavior work
	 */
	function openAdminTab(event: MouseEvent, href: string) {
		if (href !== '/admin') {
			return;
		}
		const w = window.open('/admin', '_blank');
		if (w) {
			event.preventDefault();
			closeMobileMenu();
			w.focus();
		}
		// If popup was blocked (w === null), do NOT preventDefault - let default link behavior work as fallback
	}

	/**
	 * Закрывает меню при нажатии Escape
	 */
	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && isMobileMenuOpen) {
			closeMobileMenu();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<header class="header">
	<div class="container">
		<!-- Логотип -->
		<a href="/" class="logo">
			<span class="logo-text">Berufsorientierung</span>
		</a>

		<!-- Desktop Navigation -->
		<nav class="nav-desktop" aria-label="Main navigation">
			<ul class="nav-list">
				{#each navLinks as link (link.href)}
					<li>
						<a
							href={link.href}
							class="nav-link"
							class:active={$page.url.pathname === link.href}
							aria-current={$page.url.pathname === link.href ? 'page' : undefined}
							target={link.href === '/admin' ? '_blank' : undefined}
							onclick={(e) => openAdminTab(e, link.href)}
						>
							{link.label}
						</a>
					</li>
				{/each}
			</ul>
		</nav>

		<!-- Desktop Auth Buttons & Language Switcher -->
		<div class="header-actions-desktop">
			{#each authButtons as button (button.href)}
				{#if button.isLogout}
					<form method="POST" action={button.href} style="display: inline;">
						<button type="submit" class="auth-button logout" onclick={handleLogout}>
							{button.label}
						</button>
					</form>
				{:else}
					<a href={button.href} class="auth-button">{button.label}</a>
				{/if}
			{/each}

			<LanguageSwitcher />
		</div>

		<!-- Mobile Menu Button -->
		<button
			type="button"
			class="mobile-menu-button"
			onclick={toggleMobileMenu}
			aria-expanded={isMobileMenuOpen}
			aria-label={isMobileMenuOpen ? $_('common.close') : $_('nav.openMenu')}
		>
			{#if isMobileMenuOpen}
				<!-- Close Icon -->
				<svg
					width="24"
					height="24"
					viewBox="0 0 24 24"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
					aria-hidden="true"
				>
					<path
						d="M6 18L18 6M6 6L18 18"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
				</svg>
			{:else}
				<!-- Burger Icon -->
				<svg
					width="24"
					height="24"
					viewBox="0 0 24 24"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
					aria-hidden="true"
				>
					<path
						d="M3 12H21M3 6H21M3 18H21"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
				</svg>
			{/if}
		</button>
	</div>

	<!-- Mobile Menu -->
	{#if isMobileMenuOpen}
		<div class="mobile-menu" use:clickOutside={handleClickOutside}>
			<nav aria-label="Mobile navigation">
				<ul class="mobile-nav-list">
					{#each navLinks as link (link.href)}
						<li>
							<a
								href={link.href}
								class="mobile-nav-link"
								class:active={$page.url.pathname === link.href}
								onclick={(e) => {
									openAdminTab(e, link.href);
									if (link.href !== '/admin') closeMobileMenu();
								}}
								aria-current={$page.url.pathname === link.href ? 'page' : undefined}
								target={link.href === '/admin' ? '_blank' : undefined}
							>
								{link.label}
							</a>
						</li>
					{/each}
				</ul>

				<!-- Mobile Auth Buttons -->
				<div class="mobile-auth-buttons">
					{#each authButtons as button (button.href)}
						{#if button.isLogout}
							<form method="POST" action={button.href} style="width: 100%;">
								<button
									type="submit"
									class="mobile-auth-button logout"
									onclick={handleLogout}
								>
									{button.label}
								</button>
							</form>
						{:else}
							<a
								href={button.href}
								class="mobile-auth-button"
								onclick={closeMobileMenu}
							>
								{button.label}
							</a>
						{/if}
					{/each}
				</div>

				<!-- Mobile Language Switcher -->
				<div class="mobile-language-switcher">
					<LanguageSwitcher />
				</div>
			</nav>
		</div>
	{/if}
</header>

<style>
	/* Header */
	.header {
		position: sticky;
		top: 0;
		z-index: 40;
		width: 100%;
		background-color: white;
		border-bottom: 1px solid #e5e7eb;
		box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
	}

	.container {
		display: flex;
		align-items: center;
		justify-content: space-between;
		max-width: 1280px;
		margin: 0 auto;
		padding: 1rem 1rem;
		gap: 1rem;
	}

	/* Logo */
	.logo {
		display: flex;
		align-items: center;
		text-decoration: none;
		flex-shrink: 0;
	}

	.logo-text {
		font-size: 1.25rem;
		font-weight: 700;
		color: #1f2937;
		white-space: nowrap;
	}

	/* Desktop Navigation */
	.nav-desktop {
		display: none;
		flex: 1;
		justify-content: center;
	}

	.nav-list {
		display: flex;
		gap: 0.5rem;
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.nav-link {
		display: inline-block;
		padding: 0.5rem 1rem;
		font-size: 0.9375rem;
		font-weight: 500;
		color: #4b5563;
		text-decoration: none;
		border-radius: 0.375rem;
		transition: all 0.2s ease;
		white-space: nowrap;
	}

	.nav-link:hover {
		color: #1f2937;
		background-color: #f3f4f6;
	}

	.nav-link:focus {
		outline: none;
		box-shadow: 0 0 0 2px #3b82f6;
	}

	.nav-link.active {
		color: #2563eb;
		background-color: #eff6ff;
	}

	/* Desktop Actions */
	.header-actions-desktop {
		display: none;
		align-items: center;
		gap: 0.75rem;
	}

	.auth-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.5rem 1rem;
		font-size: 0.875rem;
		font-weight: 500;
		color: #374151;
		background-color: white;
		border: 1px solid #d1d5db;
		border-radius: 0.5rem;
		text-decoration: none;
		cursor: pointer;
		transition: all 0.2s ease;
		white-space: nowrap;
		min-height: 44px;
	}

	.auth-button:hover {
		background-color: #f9fafb;
		border-color: #9ca3af;
	}

	.auth-button:focus {
		outline: none;
		box-shadow: 0 0 0 2px #3b82f6;
	}

	.auth-button.logout {
		color: #dc2626;
		border-color: #fca5a5;
	}

	.auth-button.logout:hover {
		background-color: #fef2f2;
		border-color: #f87171;
	}

	/* Mobile Menu Button */
	.mobile-menu-button {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 44px;
		height: 44px;
		padding: 0.5rem;
		background-color: transparent;
		border: none;
		color: #374151;
		cursor: pointer;
		border-radius: 0.375rem;
		transition: background-color 0.2s ease;
	}

	.mobile-menu-button:hover {
		background-color: #f3f4f6;
	}

	.mobile-menu-button:focus {
		outline: none;
		box-shadow: 0 0 0 2px #3b82f6;
	}

	/* Mobile Menu */
	.mobile-menu {
		position: absolute;
		top: 100%;
		left: 0;
		right: 0;
		background-color: white;
		border-bottom: 1px solid #e5e7eb;
		box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
		animation: slideDown 0.2s ease;
	}

	@keyframes slideDown {
		from {
			opacity: 0;
			transform: translateY(-0.5rem);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.mobile-nav-list {
		list-style: none;
		margin: 0;
		padding: 0.5rem 0;
	}

	.mobile-nav-link {
		display: block;
		padding: 0.75rem 1rem;
		font-size: 1rem;
		font-weight: 500;
		color: #4b5563;
		text-decoration: none;
		transition: background-color 0.15s ease;
		min-height: 44px;
	}

	.mobile-nav-link:hover {
		background-color: #f9fafb;
	}

	.mobile-nav-link:focus {
		outline: none;
		background-color: #f3f4f6;
	}

	.mobile-nav-link.active {
		color: #2563eb;
		background-color: #eff6ff;
	}

	/* Mobile Auth Buttons */
	.mobile-auth-buttons {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.75rem 1rem;
		border-top: 1px solid #e5e7eb;
	}

	.mobile-auth-button {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		padding: 0.75rem 1rem;
		font-size: 0.9375rem;
		font-weight: 500;
		color: #374151;
		background-color: white;
		border: 1px solid #d1d5db;
		border-radius: 0.5rem;
		text-decoration: none;
		cursor: pointer;
		transition: all 0.15s ease;
		min-height: 44px;
	}

	.mobile-auth-button:hover {
		background-color: #f9fafb;
		border-color: #9ca3af;
	}

	.mobile-auth-button:focus {
		outline: none;
		box-shadow: 0 0 0 2px #3b82f6;
	}

	.mobile-auth-button.logout {
		color: #dc2626;
		border-color: #fca5a5;
	}

	.mobile-auth-button.logout:hover {
		background-color: #fef2f2;
		border-color: #f87171;
	}

	/* Mobile Language Switcher */
	.mobile-language-switcher {
		padding: 0.75rem 1rem;
		border-top: 1px solid #e5e7eb;
	}

	/* Tablet Breakpoint (768px) */
	@media (min-width: 768px) {
		.container {
			padding: 1rem 1.5rem;
		}

		.logo-text {
			font-size: 1.5rem;
		}

		.nav-desktop {
			display: flex;
		}

		.header-actions-desktop {
			display: flex;
		}

		.mobile-menu-button {
			display: none;
		}

		.mobile-menu {
			display: none;
		}
	}

	/* Desktop Breakpoint (1024px) */
	@media (min-width: 1024px) {
		.container {
			padding: 1rem 2rem;
		}

		.nav-list {
			gap: 1rem;
		}

		.nav-link {
			padding: 0.625rem 1.25rem;
		}

		.header-actions-desktop {
			gap: 1rem;
		}
	}

	/* Dark mode support (optional) */
	@media (prefers-color-scheme: dark) {
		.header {
			background-color: #1f2937;
			border-bottom-color: #374151;
		}

		.logo-text {
			color: #f9fafb;
		}

		.nav-link {
			color: #d1d5db;
		}

		.nav-link:hover {
			color: #f9fafb;
			background-color: #374151;
		}

		.nav-link.active {
			color: #93c5fd;
			background-color: #1e3a8a;
		}

		.auth-button {
			color: #f9fafb;
			background-color: #374151;
			border-color: #4b5563;
		}

		.auth-button:hover {
			background-color: #4b5563;
			border-color: #6b7280;
		}

		.mobile-menu {
			background-color: #1f2937;
			border-bottom-color: #374151;
		}

		.mobile-nav-link {
			color: #d1d5db;
		}

		.mobile-nav-link:hover {
			background-color: #374151;
		}

		.mobile-nav-link.active {
			color: #93c5fd;
			background-color: #1e3a8a;
		}

		.mobile-auth-buttons {
			border-top-color: #374151;
		}

		.mobile-auth-button {
			color: #f9fafb;
			background-color: #374151;
			border-color: #4b5563;
		}

		.mobile-auth-button:hover {
			background-color: #4b5563;
			border-color: #6b7280;
		}

		.mobile-language-switcher {
			border-top-color: #374151;
		}
	}
</style>
