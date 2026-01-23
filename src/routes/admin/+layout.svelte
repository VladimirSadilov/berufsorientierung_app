<script lang="ts">
	import { page } from '$app/stores';
	import { _ } from 'svelte-i18n';
	import { goto } from '$app/navigation';
	import type { ComponentType } from 'svelte';
	import {
		LayoutDashboard,
		Calendar,
		Users,
		ClipboardList,
		Mail,
		BarChart2,
		FileText,
		LogOut,
		Menu,
		MessageSquare,
	} from 'lucide-svelte';

	// Данные наследуются из родительского layout (+layout.server.ts)
	export let data: any;

	// Состояние мобильного меню
	let mobileMenuOpen = false;

	// Список пунктов навигации с компонентами иконок
	const navItems: Array<{
		path: string;
		label: string;
		icon: ComponentType;
	}> = [
		{ path: '/admin', label: 'admin.nav.dashboard', icon: LayoutDashboard },
		{ path: '/admin/events', label: 'admin.nav.events', icon: Calendar },
		{ path: '/admin/users', label: 'admin.nav.users', icon: Users },
		{ path: '/admin/registrations', label: 'admin.nav.registrations', icon: ClipboardList },
		{ path: '/admin/reviews', label: 'admin.nav.reviews', icon: MessageSquare },
		{ path: '/admin/newsletter', label: 'admin.nav.newsletter', icon: Mail },
		{ path: '/admin/stats', label: 'admin.nav.stats', icon: BarChart2 },
		{ path: '/admin/logs', label: 'admin.nav.logs', icon: FileText },
	];

	// Определяем активный пункт меню
	$: currentPath = $page.url.pathname;
	$: activeNavItem = navItems.find((item) => {
		if (item.path === '/admin' && currentPath === '/admin') return true;
		if (item.path !== '/admin' && currentPath.startsWith(item.path)) return true;
		return false;
	});

	// Закрываем мобильное меню при смене маршрута
	$: if (currentPath) {
		mobileMenuOpen = false;
	}

	// Закрываем мобильное меню по клику вне его
	function handleBackdropClick() {
		mobileMenuOpen = false;
	}

	// Обработчик закрытия админки (не logout!)
	function handleCloseAdmin() {
		// Пытаемся вернуть фокус на вкладку-открыватель
		window.opener?.focus();
		// Пытаемся закрыть вкладку
		window.close();
		// Если браузер заблокировал закрытие, переходим на главную
		// (setTimeout даёт время на закрытие вкладки)
		setTimeout(() => {
			goto('/');
		}, 100);
	}

	// Получаем имя страницы для заголовка
	$: pageTitle = activeNavItem ? $_(`${activeNavItem.label}`) : $_('admin.nav.dashboard');
</script>

<div class="admin-layout">
	<!-- Mobile Header -->
	<header class="mobile-header md:hidden">
		<button
			class="mobile-menu-button"
			on:click={() => (mobileMenuOpen = !mobileMenuOpen)}
			aria-label={$_('admin.menu.toggle')}
			aria-expanded={mobileMenuOpen}
		>
			<Menu size={24} />
		</button>
		<h1 class="mobile-title">{pageTitle}</h1>
		<div class="mobile-spacer"></div>
	</header>

	<!-- Backdrop для мобильного меню -->
	{#if mobileMenuOpen}
		<div
			class="backdrop"
			on:click={handleBackdropClick}
			on:keydown={() => {}}
			aria-hidden="true"
		></div>
	{/if}

	<!-- Sidebar -->
	<aside
		class="sidebar"
		class:open={mobileMenuOpen}
		role={mobileMenuOpen ? 'dialog' : undefined}
		aria-modal={mobileMenuOpen ? 'true' : undefined}
	>
		<!-- Логотип/название -->
		<div class="sidebar-header">
			<h2 class="sidebar-title">{$_('admin.title')}</h2>
		</div>

		<!-- Навигация -->
		<nav class="sidebar-nav" aria-label={$_('admin.navigation')}>
			{#each navItems as item}
				<a
					href={item.path}
					class="nav-item"
					class:active={item.path === '/admin'
						? currentPath === '/admin'
						: currentPath.startsWith(item.path)}
				>
					<span class="nav-icon">
						<svelte:component this={item.icon} size={20} />
					</span>
					<span class="nav-label">{$_(item.label)}</span>
				</a>
			{/each}
		</nav>

		<!-- Информация о пользователе и выход -->
		<div class="sidebar-footer">
			<div class="admin-info">
				<div class="admin-name">
					{data.user.first_name}
					{data.user.last_name}
				</div>
				<div class="admin-email">{data.user.email}</div>
			</div>
			<button class="logout-button" on:click={handleCloseAdmin}>
				<span class="logout-icon">
					<LogOut size={18} />
				</span>
				<span>{$_('admin.logout')}</span>
			</button>
		</div>
	</aside>

	<!-- Main Content -->
	<main class="main-content">
		<!-- Desktop Header -->
		<header class="desktop-header">
			<h1 class="page-title">{pageTitle}</h1>
		</header>

		<!-- Slot для контента страницы -->
		<div class="content-wrapper">
			<slot />
		</div>
	</main>
</div>

<style>
	/* Layout Grid */
	.admin-layout {
		display: grid;
		grid-template-columns: 1fr;
		grid-template-rows: auto 1fr;
		min-height: 100vh;
		background-color: #f5f5f5;
	}

	@media (min-width: 768px) {
		.admin-layout {
			grid-template-columns: 280px 1fr;
			grid-template-rows: 1fr;
		}

		/* Явное позиционирование элементов в grid */
		.admin-layout > .sidebar {
			grid-column: 1;
			grid-row: 1;
		}

		.admin-layout > .main-content {
			grid-column: 2;
			grid-row: 1;
		}
	}

	/* Mobile Header */
	.mobile-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1rem;
		background-color: white;
		border-bottom: 1px solid #e5e5e5;
		position: sticky;
		top: 0;
		z-index: 40;
	}

	/* Скрываем mobile-header на десктопе */
	@media (min-width: 768px) {
		.mobile-header {
			display: none;
		}
	}

	.mobile-menu-button {
		padding: 0.5rem;
		background: none;
		border: none;
		cursor: pointer;
		color: #333;
		transition: color 0.2s;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.mobile-menu-button:hover {
		color: #0066cc;
	}

	.mobile-title {
		font-size: 1.125rem;
		font-weight: 600;
		color: #333;
		flex: 1;
		text-align: center;
	}

	.mobile-spacer {
		width: 40px;
	}

	/* Backdrop */
	.backdrop {
		position: fixed;
		inset: 0;
		background-color: rgba(0, 0, 0, 0.5);
		z-index: 45;
		animation: fadeIn 0.2s;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	/* Sidebar - базовое состояние для мобильных */
	.sidebar {
		position: fixed;
		top: 0;
		left: 0;
		bottom: 0;
		width: 280px;
		background-color: white;
		border-right: 1px solid #e5e5e5;
		display: flex;
		flex-direction: column;
		transform: translateX(-100%);
		transition: transform 0.3s ease;
		z-index: 50;
		overflow-y: auto;
	}

	.sidebar.open {
		transform: translateX(0);
	}

	/* Десктопное поведение - полное переопределение */
	@media (min-width: 768px) {
		.sidebar {
			position: sticky;
			top: 0;
			left: 0;
			bottom: auto;
			height: 100vh;
			width: 280px;
			transform: none;
			transition: none;
			z-index: auto;
		}
	}

	.sidebar-header {
		padding: 1.5rem 1rem;
		border-bottom: 1px solid #e5e5e5;
	}

	.sidebar-title {
		font-size: 1.25rem;
		font-weight: 700;
		color: #0066cc;
		margin: 0;
	}

	/* Navigation */
	.sidebar-nav {
		flex: 1;
		padding: 1rem 0;
	}

	.nav-item {
		display: flex;
		align-items: center;
		padding: 0.75rem 1rem;
		margin: 0.25rem 0.5rem;
		color: #666;
		text-decoration: none;
		border-radius: 0.5rem;
		transition: all 0.2s;
		font-size: 0.9375rem;
	}

	.nav-item:hover {
		background-color: #f0f0f0;
		color: #333;
	}

	.nav-item.active {
		background-color: #e6f2ff;
		color: #0066cc;
		font-weight: 600;
	}

	.nav-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		margin-right: 0.75rem;
		width: 1.5rem;
	}

	.nav-label {
		flex: 1;
	}

	/* Sidebar Footer */
	.sidebar-footer {
		padding: 1rem;
		border-top: 1px solid #e5e5e5;
	}

	.admin-info {
		padding: 0.75rem;
		background-color: #f9f9f9;
		border-radius: 0.5rem;
		margin-bottom: 0.75rem;
	}

	.admin-name {
		font-size: 0.9375rem;
		font-weight: 600;
		color: #333;
		margin-bottom: 0.25rem;
	}

	.admin-email {
		font-size: 0.8125rem;
		color: #666;
		word-break: break-all;
	}

	.logout-button {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		padding: 0.75rem;
		background-color: #f5f5f5;
		border: 1px solid #e5e5e5;
		border-radius: 0.5rem;
		color: #666;
		font-size: 0.9375rem;
		cursor: pointer;
		transition: all 0.2s;
	}

	.logout-button:hover {
		background-color: #ffe6e6;
		border-color: #ffcccc;
		color: #cc0000;
	}

	.logout-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		margin-right: 0.5rem;
	}

	/* Main Content */
	.main-content {
		display: flex;
		flex-direction: column;
		min-height: 100vh;
	}

	@media (min-width: 768px) {
		.main-content {
			min-height: 100vh;
			overflow-y: auto;
		}
	}

	.desktop-header {
		display: none;
	}

	@media (min-width: 768px) {
		.desktop-header {
			display: block;
			padding: 1.5rem 2rem;
			background-color: white;
			border-bottom: 1px solid #e5e5e5;
		}
	}

	.page-title {
		font-size: 1.5rem;
		font-weight: 700;
		color: #333;
		margin: 0;
	}

	.content-wrapper {
		flex: 1;
		padding: 1.5rem;
	}

	@media (min-width: 768px) {
		.content-wrapper {
			padding: 2rem;
		}
	}

	@media (min-width: 1024px) {
		.content-wrapper {
			padding: 2rem 3rem;
		}
	}
</style>
