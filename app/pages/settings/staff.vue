<script setup lang="ts">
import { useCrmStore } from '~/stores/useCrmStore'
import { ROLE_LABELS } from '~/constants/taskCatalog'
import type { Role } from '~/types/crm'

definePageMeta({ layout: 'default', middleware: ['auth'] })

const crm = useCrmStore()

// ── Staff grouped by position ─────────────────────────────────────────────────
const staffByPosition = computed(() => {
  const map = new Map<string, typeof crm.staff>()
  for (const s of crm.staff) {
    const pos = s.position || 'Без должности'
    if (!map.has(pos)) map.set(pos, [])
    map.get(pos)!.push(s)
  }
  return map
})

const positions = computed(() => Array.from(staffByPosition.value.keys()))

// ── Role badge colors ─────────────────────────────────────────────────────────
const ROLE_COLORS: Record<Role, string> = {
  ceo:       'amber',
  pm:        'blue',
  financier: 'purple',
  staff:     'green',
}

const ROLE_SYSTEM_LABELS: Record<Role, string> = {
  ceo:       'CEO',
  pm:        'Менеджер',
  financier: 'Финансист',
  staff:     'Сотрудник',
}

// ── Add/Edit modal ────────────────────────────────────────────────────────────
const showModal = ref(false)
const editingStaffId = ref<string | null>(null)

const form = reactive({
  name:           '',
  position:       '',
  specialization: '',
  role:           'staff' as Role,
})

const systemRoleOptions: { label: string; value: Role }[] = [
  { label: 'Сотрудник',  value: 'staff' },
  { label: 'Менеджер',   value: 'pm' },
  { label: 'Финансист',  value: 'financier' },
  { label: 'CEO',        value: 'ceo' },
]

function openAdd() {
  editingStaffId.value = null
  form.name           = ''
  form.position       = ''
  form.specialization = ''
  form.role           = 'staff'
  showModal.value = true
}

function openEdit(id: string) {
  const s = crm.staff.find(x => x.id === id)
  if (!s) return
  editingStaffId.value    = id
  form.name               = s.name
  form.position           = s.position
  form.specialization     = s.specialization
  form.role               = s.role
  showModal.value = true
}

function submitForm() {
  if (!form.name.trim()) return
  if (editingStaffId.value) {
    crm.updateStaff(editingStaffId.value, {
      name:           form.name.trim(),
      position:       form.position.trim(),
      specialization: form.specialization.trim(),
      role:           form.role,
    })
  } else {
    crm.addStaff({
      name:           form.name.trim(),
      position:       form.position.trim(),
      specialization: form.specialization.trim(),
      role:           form.role,
    })
  }
  showModal.value = false
}

// ── Delete ────────────────────────────────────────────────────────────────────
const confirmDeleteId = ref<string | null>(null)

function doDelete() {
  if (confirmDeleteId.value) {
    crm.removeStaff(confirmDeleteId.value)
    confirmDeleteId.value = null
  }
}
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <!-- Header -->
    <header class="h-16 flex items-center justify-between px-6 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
      <div>
        <div class="flex items-center gap-1.5 text-xs text-slate-400 mb-0.5">
          <NuxtLink to="/settings" class="hover:text-blue-500 transition-colors">Настройки</NuxtLink>
          <UIcon name="i-ph-caret-right" class="w-3 h-3" />
          <span class="text-slate-600 dark:text-slate-300">Сотрудники</span>
        </div>
        <h1 class="text-xl font-bold text-slate-900 dark:text-white">Сотрудники</h1>
      </div>
      <UButton icon="i-ph-user-plus" size="sm" @click="openAdd()">
        Добавить сотрудника
      </UButton>
    </header>

    <div class="flex-1 overflow-y-auto p-6 space-y-5">

      <!-- Stats row -->
      <div class="grid grid-cols-4 gap-4">
        <div class="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5">
          <div class="flex items-center gap-3.5">
            <div class="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-slate-50 dark:bg-slate-800">
              <UIcon name="i-ph-users" class="w-5 h-5 text-slate-600 dark:text-slate-400" />
            </div>
            <div>
              <p class="text-2xl font-bold text-slate-800 dark:text-slate-200 leading-tight">{{ crm.staff.length }}</p>
              <p class="text-[11px] text-slate-400 mt-0.5 font-medium">Всего</p>
            </div>
          </div>
        </div>
        <div class="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5">
          <div class="flex items-center gap-3.5">
            <div class="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-purple-50 dark:bg-purple-900/20">
              <UIcon name="i-ph-pencil-ruler" class="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p class="text-2xl font-bold text-slate-800 dark:text-slate-200 leading-tight">{{ crm.staff.filter(s => s.role === 'staff').length }}</p>
              <p class="text-[11px] text-slate-400 mt-0.5 font-medium">Сотрудники</p>
            </div>
          </div>
        </div>
        <div class="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5">
          <div class="flex items-center gap-3.5">
            <div class="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-blue-50 dark:bg-blue-900/20">
              <UIcon name="i-ph-hard-hat" class="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p class="text-2xl font-bold text-slate-800 dark:text-slate-200 leading-tight">{{ crm.staff.filter(s => s.role === 'pm').length }}</p>
              <p class="text-[11px] text-slate-400 mt-0.5 font-medium">Менеджеры</p>
            </div>
          </div>
        </div>
        <div class="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5">
          <div class="flex items-center gap-3.5">
            <div class="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-green-50 dark:bg-green-900/20">
              <UIcon name="i-ph-wallet" class="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p class="text-2xl font-bold text-slate-800 dark:text-slate-200 leading-tight">{{ crm.staff.filter(s => s.role === 'financier').length }}</p>
              <p class="text-[11px] text-slate-400 mt-0.5 font-medium">Финансисты</p>
            </div>
          </div>
        </div>
      </div>

      <!-- No staff -->
      <div v-if="crm.staff.length === 0" class="flex flex-col items-center justify-center py-16 text-slate-400">
        <UIcon name="i-ph-users" class="w-10 h-10 mb-3 opacity-40" />
        <p class="text-sm">Нет сотрудников</p>
        <UButton size="sm" variant="ghost" icon="i-ph-user-plus" class="mt-3" @click="openAdd()">
          Добавить первого
        </UButton>
      </div>

      <!-- Staff grouped by position -->
      <div v-for="position in positions" :key="position" class="space-y-3">
        <!-- Position header -->
        <div class="flex items-center gap-3">
          <div class="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
          <div class="flex items-center gap-2">
            <UIcon name="i-ph-identification-badge" class="w-4 h-4 text-slate-400" />
            <span class="text-sm font-semibold text-slate-600 dark:text-slate-400">{{ position }}</span>
            <UBadge color="neutral" variant="soft" size="xs">
              {{ staffByPosition.get(position)?.length }}
            </UBadge>
          </div>
          <div class="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
        </div>

        <!-- Staff cards -->
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          <div
            v-for="member in staffByPosition.get(position)"
            :key="member.id"
            class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex items-center gap-3 hover:border-blue-200 dark:hover:border-blue-800 hover:shadow-sm transition-all group"
          >
            <!-- Avatar -->
            <UAvatar :text="member.initials" size="md" />

            <!-- Info -->
            <div class="flex-1 min-w-0">
              <p class="font-semibold text-sm text-slate-800 dark:text-slate-200 truncate">{{ member.name }}</p>
              <p class="text-xs text-slate-500 truncate">{{ member.specialization }}</p>
              <div class="flex items-center gap-1.5 mt-1">
                <UBadge
                  :color="ROLE_COLORS[member.role] as any"
                  variant="soft"
                  size="xs"
                >
                  {{ ROLE_SYSTEM_LABELS[member.role] }}
                </UBadge>
              </div>
            </div>

            <!-- Actions -->
            <div class="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
              <UButton
                size="sm"
                icon="i-ph-pencil"
                variant="ghost"
                color="neutral"
                @click="openEdit(member.id)"
              />
              <UButton
                size="sm"
                icon="i-ph-trash"
                variant="ghost"
                color="red"
                @click="confirmDeleteId = member.id"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Add/Edit Modal -->
    <UModal
      v-model:open="showModal"
      :title="editingStaffId ? 'Редактировать сотрудника' : 'Добавить сотрудника'"
    >
      <template #body>
        <div class="space-y-4">
          <UFormField label="ФИО" required>
            <UInput
              v-model="form.name"
              placeholder="Иванов Иван Иванович"
              autofocus
            />
          </UFormField>
          <UFormField label="Должность (позиция)" required>
            <UInput
              v-model="form.position"
              placeholder="ГАП, ГИП, ГКП, Директор, ..."
            />
          </UFormField>
          <UFormField label="Специализация">
            <UInput
              v-model="form.specialization"
              placeholder="Архитектор (ГАП), Главный инженер проекта, ..."
            />
          </UFormField>
          <UFormField label="Системная роль">
            <USelect v-model="form.role" :options="systemRoleOptions" />
          </UFormField>
        </div>
      </template>
      <template #footer>
        <div class="flex gap-2 justify-end">
          <UButton variant="ghost" color="neutral" @click="showModal = false">Отмена</UButton>
          <UButton :disabled="!form.name.trim() || !form.position.trim()" @click="submitForm">
            {{ editingStaffId ? 'Сохранить' : 'Добавить' }}
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- Delete Confirm Modal -->
    <UModal :open="!!confirmDeleteId" @update:open="confirmDeleteId = null" title="Удалить сотрудника?">
      <template #body>
        <p class="text-sm text-slate-600 dark:text-slate-400">
          Сотрудник будет удалён из системы. Назначенные задачи в проектах не затронуты.
        </p>
      </template>
      <template #footer>
        <div class="flex gap-2 justify-end">
          <UButton variant="ghost" color="neutral" @click="confirmDeleteId = null">Отмена</UButton>
          <UButton color="red" @click="doDelete">Удалить</UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
