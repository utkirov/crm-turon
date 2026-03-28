<script setup lang="ts">
import { useAuthStore } from '~/stores/useAuthStore'
import { useCrmStore } from '~/stores/useCrmStore'
import { useWindowSize, useLocalStorage } from '@vueuse/core'

const auth  = useAuthStore()
const crm   = useCrmStore()
const route = useRoute()

interface NavItem {
  label: string
  icon: string
  to: string
  badge?: number
}

const NAV: Record<string, NavItem[]> = {
  ceo: [
    { label: 'Дашборд',       icon: 'i-ph-squares-four', to: '/' },
    { label: 'Аналитика',     icon: 'i-ph-chart-bar',    to: '/analytics' },
    { label: 'Настройки',     icon: 'i-ph-gear',         to: '/settings' },
  ],
  pm: [
    { label: 'Kanban проектов', icon: 'i-ph-kanban',      to: '/pm/kanban' },
    { label: 'Проекты',         icon: 'i-ph-folder-open', to: '/pm/projects' },
    { label: 'Создать проект',  icon: 'i-ph-plus-circle', to: '/pm/create' },
    { label: 'Настройки',       icon: 'i-ph-gear',        to: '/settings' },
  ],
  financier: [
    { label: 'Финансы',         icon: 'i-ph-wallet',  to: '/finance' },
    { label: 'Транзакции',      icon: 'i-ph-receipt', to: '/transactions' },
    { label: 'Установить цену', icon: 'i-ph-tag',     to: '/finance/set-price' },
  ],
  staff: [
    { label: 'Мои задачи',    icon: 'i-ph-kanban', to: '/staff/tasks' },
    { label: 'Мои заработки', icon: 'i-ph-coins',  to: '/staff/earnings' },
  ],
}

const ROLE_LABELS: Record<string, string> = {
  ceo: 'Директор', pm: 'Менеджер проектов', financier: 'Финансист', staff: 'Сотрудник',
}
const ROLE_COLORS: Record<string, string> = {
  ceo: 'text-amber-400', pm: 'text-blue-400', financier: 'text-emerald-400', staff: 'text-purple-400',
}

// ── Sidebar collapse ──────────────────────────────────────────────────────────
const sidebarCollapsed = useLocalStorage('sidebar-collapsed', false)
const { width: windowWidth } = useWindowSize()
const mobileOpen = ref(false)
const isMobile = computed(() => windowWidth.value < 768)

watch(isMobile, (v) => { if (!v) mobileOpen.value = false })
watch(() => route.path, () => { mobileOpen.value = false })

// ── Project search (PM) ───────────────────────────────────────────────────────
const pmSearch = ref('')

// ── Nav items with badges ─────────────────────────────────────────────────────
const navItems = computed((): NavItem[] => {
  if (!auth.currentRole) return []
  const items = (NAV[auth.currentRole] ?? []).map(item => ({ ...item }))
  const uid = auth.currentUser?.id ?? ''
  const badgeCount = crm.pendingChangeCount(uid)
  for (const item of items) {
    if (auth.currentRole === 'staff' && item.to === '/staff/tasks' && badgeCount > 0) item.badge = badgeCount
    if (auth.currentRole === 'pm' && item.to === '/pm/projects' && badgeCount > 0) item.badge = badgeCount
    if (auth.currentRole === 'financier' && item.to === '/finance/set-price') {
      const c = crm.unpricedTasks.length
      if (c > 0) item.badge = c
    }
  }
  return items
})

// ── PM projects (filtered) ────────────────────────────────────────────────────
const pmProjects = computed(() => {
  if (auth.currentRole !== 'pm' || !auth.currentUser) return []
  const all = crm.projectsByPm(auth.currentUser.id)
  if (!pmSearch.value.trim()) return all
  const q = pmSearch.value.toLowerCase()
  return all.filter(p => p.name.toLowerCase().includes(q) || p.client.toLowerCase().includes(q))
})

// ── Breadcrumbs ───────────────────────────────────────────────────────────────
const ROUTE_LABELS: Record<string, string> = {
  '/':                 'Дашборд',
  '/analytics':        'Аналитика',
  '/settings':         'Настройки',
  '/pm/kanban':        'Kanban',
  '/pm/projects':      'Проекты',
  '/pm/create':        'Создать проект',
  '/finance':          'Финансы',
  '/finance/set-price':'Установить цену',
  '/transactions':     'Транзакции',
  '/staff/tasks':      'Мои задачи',
  '/staff/earnings':   'Мои заработки',
}
const breadcrumbs = computed(() => {
  const path = route.path
  if (path === '/') return []
  const crumbs = [{ label: 'Главная', to: auth.roleHome }]
  const label = ROUTE_LABELS[path]
  if (label) crumbs.push({ label, to: path })
  return crumbs
})

const roleLabel = computed(() => auth.currentRole ? ROLE_LABELS[auth.currentRole] : '')
const roleColor = computed(() => auth.currentRole ? ROLE_COLORS[auth.currentRole] : '')

// ── Notifications ─────────────────────────────────────────────────────────────
const today = new Date().toISOString().slice(0, 10)

const notifItems = computed(() => {
  const uid  = auth.currentUser?.id ?? ''
  const role = auth.currentRole ?? ''
  const items: Array<{ icon: string; label: string; sub: string; color: string }> = []

  // Pending change requests relevant to this user
  const changes = crm.changeRequests.filter(r => r.status === 'pending' && (
    r.requestedBy === uid || (role === 'pm' && crm.projects.some(p => p.id === r.projectId && p.pmId === uid)) ||
    role === 'ceo' || role === 'financier'
  ))
  for (const c of changes.slice(0, 3)) {
    const proj = crm.projects.find(p => p.id === c.projectId)
    items.push({ icon: 'i-ph-git-pull-request', label: 'Запрос на изменение', sub: proj?.name ?? c.projectId, color: 'text-warning-500' })
  }

  // Overdue milestones (for ceo / financier / pm)
  if (role !== 'staff') {
    for (const proj of crm.projects) {
      for (const ms of proj.clientMilestones) {
        if (ms.status !== 'paid' && ms.dueDate && ms.dueDate < today) {
          items.push({ icon: 'i-ph-warning', label: 'Просрочен транш', sub: `${proj.name} — ${ms.label}`, color: 'text-error-500' })
          if (items.length >= 5) break
        }
      }
      if (items.length >= 5) break
    }
  }

  return items.slice(0, 5)
})

const notifCount = computed(() => notifItems.value.length)

async function logout() {
  await auth.logout()
  await navigateTo('/login')
}

function isActive(to: string) {
  if (to === '/') return route.path === '/'
  return route.path === to || route.path.startsWith(to + '/')
}
</script>

<template>
  <div class="flex h-screen overflow-hidden bg-slate-100 dark:bg-slate-950">

      <!-- Mobile overlay -->
      <Transition name="fade">
        <div
          v-if="isMobile && mobileOpen"
          class="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          @click="mobileOpen = false"
        />
      </Transition>

      <!-- Sidebar -->
      <Transition name="slide-sidebar">
        <aside
          class="flex-shrink-0 flex flex-col bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 text-white shadow-2xl transition-all duration-300 z-50"
          :class="[
            isMobile ? 'fixed inset-y-0 left-0' : 'relative',
            isMobile && !mobileOpen ? '-translate-x-full' : 'translate-x-0',
            sidebarCollapsed && !isMobile ? 'w-[72px]' : 'w-64',
          ]"
        >
          <!-- Logo -->
          <div class="h-16 flex items-center gap-3 px-4 border-b border-white/10 overflow-hidden">
            <div class="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-500/25">
              <UIcon name="i-ph-buildings" class="text-white w-5 h-5" />
            </div>
            <Transition name="fade-text">
              <div v-if="!sidebarCollapsed || isMobile" class="overflow-hidden">
                <p class="font-bold text-sm text-white leading-tight tracking-tight whitespace-nowrap">AEC-Flow</p>
                <p class="text-[10px] text-slate-400 font-medium tracking-widest uppercase whitespace-nowrap">CRM 2.0</p>
              </div>
            </Transition>
            <!-- Collapse toggle (desktop only) -->
            <button
              v-if="!isMobile"
              class="ml-auto text-slate-500 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
              @click="sidebarCollapsed = !sidebarCollapsed"
            >
              <UIcon
                :name="sidebarCollapsed ? 'i-ph-caret-right' : 'i-ph-caret-left'"
                class="w-4 h-4"
              />
            </button>
          </div>

          <!-- Nav -->
          <nav class="flex-1 overflow-y-auto px-2 py-4 space-y-0.5">

            <!-- Financier: project selector -->
            <template v-if="auth.currentRole === 'financier'">
              <template v-if="!sidebarCollapsed || isMobile">
                <p class="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.15em] px-3 mb-2">Проект</p>
                <button
                  class="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs transition-colors mb-0.5"
                  :class="!crm.selectedProjectId
                    ? 'bg-gradient-to-r from-blue-600/90 to-indigo-600/80 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'"
                  @click="crm.setSelectedProject(null)"
                >
                  <UIcon name="i-ph-grid-four" class="w-4 h-4 shrink-0" />
                  <span class="flex-1 text-left">Все проекты</span>
                </button>
                <button
                  v-for="p in crm.projects" :key="p.id"
                  class="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs transition-colors mb-0.5"
                  :class="crm.selectedProjectId === p.id
                    ? 'bg-gradient-to-r from-blue-600/90 to-indigo-600/80 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'"
                  @click="crm.setSelectedProject(p.id)"
                >
                  <span class="w-2 h-2 rounded-full flex-shrink-0"
                    :class="p.status === 'active' ? 'bg-emerald-400' : 'bg-slate-500'" />
                  <span class="flex-1 text-left truncate">{{ p.name }}</span>
                </button>
                <div class="h-px bg-white/10 my-3" />
              </template>
            </template>

            <p v-if="!sidebarCollapsed || isMobile" class="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.15em] px-3 mb-2">Навигация</p>

            <!-- Main nav items -->
            <NuxtLink
              v-for="item in navItems"
              :key="item.to + item.label"
              :to="item.to"
              class="nav-item flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200"
              :class="[
                isActive(item.to)
                  ? 'bg-gradient-to-r from-blue-600/90 to-indigo-600/80 text-white shadow-lg shadow-blue-600/20'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.06]',
                sidebarCollapsed && !isMobile ? 'justify-center' : '',
              ]"
              :title="sidebarCollapsed && !isMobile ? item.label : undefined"
            >
              <UIcon :name="item.icon" class="w-5 h-5 flex-shrink-0" />
              <span v-if="!sidebarCollapsed || isMobile" class="flex-1">{{ item.label }}</span>
              <span
                v-if="item.badge && item.badge > 0 && (!sidebarCollapsed || isMobile)"
                class="flex-shrink-0 inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold rounded-full bg-amber-500 text-white"
              >
                {{ item.badge }}
              </span>
              <span
                v-else-if="item.badge && item.badge > 0 && sidebarCollapsed && !isMobile"
                class="absolute top-1 right-1 w-2 h-2 bg-amber-500 rounded-full"
              />
            </NuxtLink>

            <!-- PM project list -->
            <template v-if="auth.currentRole === 'pm' && (!sidebarCollapsed || isMobile)">
              <div class="pt-4">
                <p class="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.15em] px-3 mb-2">Мои проекты</p>
                <!-- Search -->
                <div class="px-1 mb-2">
                  <UInput
                    v-model="pmSearch"
                    placeholder="Поиск проекта..."
                    size="xs"
                    variant="soft"
                    :ui="{ base: 'bg-white/5 border-white/10 text-white placeholder-slate-500 text-xs' }"
                  />
                </div>
                <TransitionGroup name="list" tag="div">
                  <button
                    v-for="p in pmProjects"
                    :key="p.id"
                    class="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-slate-500 hover:text-slate-300 hover:bg-white/[0.04] transition-all cursor-pointer"
                    @click="navigateTo('/pm/projects?id=' + p.id)"
                  >
                    <span class="w-2 h-2 rounded-full flex-shrink-0"
                      :class="p.status === 'active' ? 'bg-emerald-400' : 'bg-slate-600'" />
                    <span class="truncate flex-1 text-left">{{ p.name }}</span>
                  </button>
                </TransitionGroup>
                <EmptyState
                  v-if="pmSearch && !pmProjects.length"
                  icon="i-ph-magnifying-glass"
                  title="Не найдено"
                  class="py-4"
                />
              </div>
            </template>
          </nav>

          <!-- Footer -->
          <div class="p-2 border-t border-white/10 bg-slate-950/50">
            <div v-if="!sidebarCollapsed || isMobile" class="flex items-center gap-2.5 mb-2 px-1">
              <div class="relative">
                <UAvatar :text="auth.currentUser?.initials ?? '?'" size="sm" />
                <span class="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-slate-900" />
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-xs font-semibold text-white truncate">{{ auth.currentUser?.name }}</p>
                <p class="text-[10px] font-medium truncate" :class="roleColor">{{ roleLabel }}</p>
              </div>
            </div>
            <div class="flex items-center justify-between px-1">
              <UButton
                size="sm" color="neutral" variant="ghost"
                :icon="sidebarCollapsed && !isMobile ? 'i-ph-sign-out' : undefined"
                class="text-slate-400 hover:text-white"
                @click="logout"
              >
                <span v-if="!sidebarCollapsed || isMobile">Выйти</span>
              </UButton>
              <div class="flex items-center gap-1">
                <!-- Notification bell -->
                <UPopover>
                  <UButton
                    size="xs" color="neutral" variant="ghost"
                    icon="i-ph-bell"
                    class="text-slate-400 hover:text-white relative"
                    :title="notifCount > 0 ? `${notifCount} уведомлений` : 'Уведомления'"
                  >
                    <span
                      v-if="notifCount > 0"
                      class="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 flex items-center justify-center text-[9px] font-bold bg-red-500 text-white rounded-full"
                    >
                      {{ notifCount > 9 ? '9+' : notifCount }}
                    </span>
                  </UButton>
                  <template #content>
                    <div class="w-72 py-1">
                      <div v-if="notifItems.length === 0" class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                        Нет уведомлений
                      </div>
                      <div
                        v-for="(n, i) in notifItems"
                        :key="i"
                        class="flex items-start gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-white/5"
                      >
                        <UIcon :name="n.icon" class="w-4 h-4 mt-0.5 flex-shrink-0" :class="n.color" />
                        <div class="min-w-0">
                          <p class="text-xs font-medium text-gray-800 dark:text-white">{{ n.label }}</p>
                          <p class="text-[11px] text-gray-500 dark:text-gray-400 truncate">{{ n.sub }}</p>
                        </div>
                      </div>
                    </div>
                  </template>
                </UPopover>
                <UColorModeButton size="xs" />
              </div>
            </div>
          </div>
        </aside>
      </Transition>

      <!-- Main content area -->
      <div class="flex-1 flex flex-col overflow-hidden min-w-0">

        <!-- Mobile top bar -->
        <div v-if="isMobile" class="h-14 flex items-center gap-3 px-4 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-white/10 flex-shrink-0">
          <button
            class="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-white"
            @click="mobileOpen = !mobileOpen"
          >
            <UIcon name="i-ph-list" class="w-5 h-5" />
          </button>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold text-gray-900 dark:text-white truncate">
              {{ ROUTE_LABELS[route.path] ?? 'AEC-Flow' }}
            </p>
          </div>
          <div class="flex items-center gap-1.5">
            <UPopover>
              <UButton size="xs" color="neutral" variant="ghost" icon="i-ph-bell" class="relative">
                <span
                  v-if="notifCount > 0"
                  class="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 flex items-center justify-center text-[9px] font-bold bg-red-500 text-white rounded-full"
                >
                  {{ notifCount }}
                </span>
              </UButton>
              <template #content>
                <div class="w-72 py-1">
                  <div v-if="notifItems.length === 0" class="px-4 py-3 text-sm text-gray-500">Нет уведомлений</div>
                  <div v-for="(n, i) in notifItems" :key="i" class="flex items-start gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-white/5">
                    <UIcon :name="n.icon" class="w-4 h-4 mt-0.5 flex-shrink-0" :class="n.color" />
                    <div class="min-w-0">
                      <p class="text-xs font-medium text-gray-800 dark:text-white">{{ n.label }}</p>
                      <p class="text-[11px] text-gray-500 truncate">{{ n.sub }}</p>
                    </div>
                  </div>
                </div>
              </template>
            </UPopover>
            <UColorModeButton size="xs" />
          </div>
        </div>

        <!-- Breadcrumbs (desktop) -->
        <div
          v-if="!isMobile && breadcrumbs.length > 1"
          class="flex items-center gap-2 px-6 pt-4 pb-0"
        >
          <template v-for="(crumb, i) in breadcrumbs" :key="crumb.to">
            <NuxtLink
              :to="crumb.to"
              class="text-xs font-medium transition-colors"
              :class="i === breadcrumbs.length - 1
                ? 'text-gray-900 dark:text-white pointer-events-none'
                : 'text-gray-500 dark:text-white/40 hover:text-gray-700 dark:hover:text-white/70'"
            >
              {{ crumb.label }}
            </NuxtLink>
            <UIcon
              v-if="i < breadcrumbs.length - 1"
              name="i-ph-caret-right"
              class="w-3.5 h-3.5 text-gray-400 dark:text-white/20"
            />
          </template>
        </div>

        <slot />
      </div>
    </div>
</template>

<style scoped>
.slide-sidebar-enter-active,
.slide-sidebar-leave-active {
  transition: transform 0.25s ease;
}
.slide-sidebar-enter-from,
.slide-sidebar-leave-to {
  transform: translateX(-100%);
}

.fade-text-enter-active,
.fade-text-leave-active {
  transition: opacity 0.15s ease;
}
.fade-text-enter-from,
.fade-text-leave-to {
  opacity: 0;
}
</style>
