import { defineStore } from 'pinia'
import type { Role, StaffMember } from '~/types/crm'

export const MOCK_STAFF: StaffMember[] = [
  { id: 'akbar',  name: 'Акбар Юсупов',    role: 'ceo',       specialization: 'Директор',                  position: 'Директор',  initials: 'АЮ' },
  { id: 'dilshod',name: 'Дильшод Рашидов', role: 'pm',        specialization: 'Главный архитектор (ГИП)',   position: 'ГИП',       initials: 'ДР' },
  { id: 'malika', name: 'Малика Каримова',  role: 'financier', specialization: 'Финансист',                  position: 'Финансист', initials: 'МК' },
  { id: 'ivan',   name: 'Иван Петров',      role: 'staff',     specialization: 'Архитектор (ГАП)',           position: 'ГАП',       initials: 'ИП' },
  { id: 'aziz',   name: 'Азиз Каримов',     role: 'staff',     specialization: 'Конструктор',                position: 'ГКП',       initials: 'АК' }
]

const ROLE_HOME: Record<Role, string> = {
  ceo: '/',
  pm: '/pm/projects',
  financier: '/finance',
  staff: '/staff/tasks'
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    currentUserId: null as string | null
  }),

  persist: {
    storage: persistedState.cookiesWithOptions({
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 30,
    }),
  },

  getters: {
    currentUser: (state): StaffMember | null =>
      MOCK_STAFF.find(s => s.id === state.currentUserId) ?? null,

    currentRole(): Role | null {
      return this.currentUser?.role ?? null
    },

    isAuthenticated(): boolean {
      return this.currentUserId !== null
    },

    roleHome(): string {
      return this.currentRole ? ROLE_HOME[this.currentRole] : '/login'
    }
  },

  actions: {
    async login(staffId: string) {
      await $fetch('/api/auth/login', { method: 'POST', body: { staffId } })
      this.currentUserId = staffId
    },
    async logout() {
      await $fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
      this.currentUserId = null
    }
  }
})
