<script setup lang="ts">
import { useAuthStore } from '~/stores/useAuthStore'
import { useCrmStore } from '~/stores/useCrmStore'

const auth = useAuthStore()
const crm  = useCrmStore()
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
    { label: 'Аналитика',     icon: 'i-ph-chart-bar',      to: '/analytics' },
    { label: 'Настройки',     icon: 'i-ph-gear',         to: '/settings' },
  ],
  pm: [
    { label: 'Kanban проектов', icon: 'i-ph-kanban',       to: '/pm/kanban' },
    { label: 'Проекты',         icon: 'i-ph-folder-open',  to: '/pm/projects' },
    { label: 'Создать проект',  icon: 'i-ph-plus-circle',  to: '/pm/create' },
    { label: 'Настройки',       icon: 'i-ph-gear',         to: '/settings' },
  ],
  financier: [
    { label: 'Финансы',         icon: 'i-ph-wallet',       to: '/finance' },
    { label: 'Транзакции',      icon: 'i-ph-receipt',      to: '/transactions' },
    { label: 'Установить цену', icon: 'i-ph-tag',          to: '/finance/set-price' },
  ],
  staff: [
    { label: 'Мои задачи',    icon: 'i-ph-kanban',   to: '/staff/tasks' },
    { label: 'Мои заработки', icon: 'i-ph-coins',    to: '/staff/earnings' },
  ],
}

const ROLE_LABELS: Record<string, string> = {
  ceo: 'Директор',
  pm: 'Менеджер проектов',
  financier: 'Финансист',
  staff: 'Сотрудник'
}

const ROLE_COLORS: Record<string, string> = {
  ceo: 'text-amber-400',
  pm: 'text-blue-400',
  financier: 'text-emerald-400',
  staff: 'text-purple-400'
}

const navItems = computed((): NavItem[] => {
  if (!auth.currentRole) return []
  const items = (NAV[auth.currentRole] ?? []).map(item => ({ ...item }))
  const uid = auth.currentUser?.id ?? ''
  const badgeCount = crm.pendingChangeCount(uid)

  // Attach badge counts to relevant nav items
  for (const item of items) {
    if (auth.currentRole === 'staff' && item.to === '/staff/tasks' && badgeCount > 0) {
      item.badge = badgeCount
    }
    if (auth.currentRole === 'pm' && item.to === '/pm/projects' && badgeCount > 0) {
      item.badge = badgeCount
    }
    if (auth.currentRole === 'financier' && item.to === '/finance/set-price') {
      const unpricedCount = crm.unpricedTasks.length
      if (unpricedCount > 0) item.badge = unpricedCount
    }
  }
  return items
})

const roleLabel = computed(() => auth.currentRole ? ROLE_LABELS[auth.currentRole] : '')
const roleColor = computed(() => auth.currentRole ? ROLE_COLORS[auth.currentRole] : '')

const pmProjects = computed(() =>
  auth.currentRole === 'pm' && auth.currentUser
    ? crm.projectsByPm(auth.currentUser.id)
    : []
)

async function logout() {
  auth.logout()
  await navigateTo('/login')
}

function isActive(to: string) {
  return route.path === to || route.path.startsWith(to + '/')
}
</script>

<template>
  <UApp>
    <div class="flex h-screen overflow-hidden bg-slate-100 dark:bg-slate-950">
      <!-- Sidebar -->
      <aside class="w-64 flex-shrink-0 flex flex-col bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 text-white shadow-2xl">

        <!-- Logo -->
        <div class="h-16 flex items-center gap-3 px-5 border-b border-white/10">
          <div class="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-500/25">
            <UIcon name="i-ph-buildings" class="text-white w-5 h-5" />
          </div>
          <div>
            <p class="font-bold text-sm text-white leading-tight tracking-tight">AEC-Flow</p>
            <p class="text-[10px] text-slate-400 font-medium tracking-widest uppercase">CRM 2.0</p>
          </div>
        </div>

        <!-- Nav -->
        <nav class="flex-1 overflow-y-auto px-3 py-5 space-y-1">

          <!-- Financier: project selector (above nav items) -->
          <template v-if="auth.currentRole === 'financier'">
            <p class="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.15em] px-3 mb-2">Проект</p>
            <button
              @click="crm.setSelectedProject(null)"
              class="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs transition-colors mb-0.5"
              :class="!crm.selectedProjectId
                ? 'bg-gradient-to-r from-blue-600/90 to-indigo-600/80 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'"
            >
              <UIcon name="i-ph-grid-four" class="w-4 h-4 shrink-0" />
              <span class="flex-1 text-left">Все проекты</span>
            </button>
            <button
              v-for="p in crm.projects" :key="p.id"
              @click="crm.setSelectedProject(p.id)"
              class="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs transition-colors mb-0.5"
              :class="crm.selectedProjectId === p.id
                ? 'bg-gradient-to-r from-blue-600/90 to-indigo-600/80 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'"
            >
              <span class="w-2 h-2 rounded-full flex-shrink-0"
                :class="p.status === 'active' ? 'bg-emerald-400' : 'bg-slate-500'" />
              <span class="flex-1 text-left truncate">{{ p.name }}</span>
            </button>
            <div class="h-px bg-white/10 my-3" />
          </template>

          <p class="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.15em] px-3 mb-3">Навигация</p>

          <!-- Main nav items -->
          <NuxtLink
            v-for="item in navItems"
            :key="item.to + item.label"
            :to="item.to"
            class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200"
            :class="isActive(item.to)
              ? 'bg-gradient-to-r from-blue-600/90 to-indigo-600/80 text-white shadow-lg shadow-blue-600/20'
              : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'"
          >
            <UIcon :name="item.icon" class="w-5 h-5 flex-shrink-0" />
            <span class="flex-1">{{ item.label }}</span>
            <span
              v-if="item.badge && item.badge > 0"
              class="flex-shrink-0 inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold rounded-full bg-amber-500 text-white"
            >
              {{ item.badge }}
            </span>
          </NuxtLink>

          <!-- PM project list -->
          <template v-if="auth.currentRole === 'pm' && pmProjects.length">
            <div class="pt-5">
              <p class="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.15em] px-3 mb-3">Мои проекты</p>
              <NuxtLink
                v-for="p in pmProjects"
                :key="p.id"
                :to="`/projects/${p.id}`"
                class="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-slate-500 hover:text-slate-300 hover:bg-white/[0.04] transition-all cursor-pointer"
              >
                <span class="w-2 h-2 rounded-full flex-shrink-0 ring-2 ring-offset-1 ring-offset-slate-900"
                  :class="p.status === 'active' ? 'bg-emerald-400 ring-emerald-400/30' : 'bg-slate-600 ring-slate-600/30'" />
                <span class="truncate">{{ p.name }}</span>
              </NuxtLink>
            </div>
          </template>
        </nav>

        <!-- Footer -->
        <div class="p-3 border-t border-white/10 bg-slate-950/50">
          <div class="flex items-center gap-2.5 mb-3 px-1">
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
            <UButton size="sm" color="neutral" variant="ghost" icon="i-ph-sign-out" class="text-slate-400 hover:text-white" @click="logout">
              Выйти
            </UButton>
            <UColorModeButton size="xs" />
          </div>
        </div>
      </aside>

      <!-- Main -->
      <div class="flex-1 flex flex-col overflow-hidden">
        <slot />
      </div>
    </div>
  </UApp>
</template>
