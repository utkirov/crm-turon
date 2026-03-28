<script setup lang="ts">
import { useCrmStore } from '~/stores/useCrmStore'
import {
  STAGE_LABELS, STAGE_ICONS,
  ROLE_LABELS, ROLE_ICONS,
  STAGES
} from '~/constants/taskCatalog'
import type { DesignStage, StageRole } from '~/types/crm'

definePageMeta({ layout: 'default', middleware: ['auth'] })

const crm = useCrmStore()

// ── Active stage tab ─────────────────────────────────────────────────────────
const activeStage = ref<DesignStage>('sketch')

// ── Tasks grouped by role for active stage ───────────────────────────────────
const stageRoleGroups = computed(() => {
  const tasks = crm.taskCatalog.filter(t => t.stage === activeStage.value)
  const map = new Map<StageRole, typeof tasks>()
  for (const t of tasks) {
    if (!map.has(t.role)) map.set(t.role, [])
    map.get(t.role)!.push(t)
  }
  return map
})

const rolesInStage = computed(() => Array.from(stageRoleGroups.value.keys()))

// ── Add task modal ────────────────────────────────────────────────────────────
const showAddModal = ref(false)
const newTask = reactive({ name: '', stage: 'sketch' as DesignStage, role: 'architect' as StageRole, defaultDays: undefined as number | undefined })

function openAddModal(stage?: DesignStage, role?: StageRole) {
  newTask.name = ''
  newTask.stage = stage ?? activeStage.value
  newTask.role  = role  ?? 'architect'
  newTask.defaultDays = undefined
  showAddModal.value = true
}

function submitAddTask() {
  if (!newTask.name.trim()) return
  crm.addCatalogTask({
    name: newTask.name.trim(),
    stage: newTask.stage,
    role: newTask.role,
    ...(newTask.defaultDays ? { defaultDays: newTask.defaultDays } : {}),
  })
  showAddModal.value = false
}

// ── Inline edit ───────────────────────────────────────────────────────────────
const editingId = ref<string | null>(null)
const editingName = ref('')
const editingDefaultDays = ref<number | undefined>(undefined)

function startEdit(id: string, name: string, defaultDays?: number) {
  editingId.value = id
  editingName.value = name
  editingDefaultDays.value = defaultDays
}

function saveEdit(id: string) {
  if (editingName.value.trim()) {
    crm.updateCatalogTask(id, {
      name: editingName.value.trim(),
      defaultDays: editingDefaultDays.value || undefined,
    })
  }
  editingId.value = null
}

function cancelEdit() {
  editingId.value = null
}

// ── Delete ────────────────────────────────────────────────────────────────────
const confirmDeleteId = ref<string | null>(null)

function confirmDelete(id: string) {
  confirmDeleteId.value = id
}

function doDelete() {
  if (confirmDeleteId.value) {
    crm.removeCatalogTask(confirmDeleteId.value)
    confirmDeleteId.value = null
  }
}

const stageOptions = STAGES.map(s => ({ label: STAGE_LABELS[s], value: s }))
const roleOptions = (Object.keys(ROLE_LABELS) as StageRole[]).map(r => ({ label: ROLE_LABELS[r], value: r }))
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <!-- Header -->
    <header class="h-16 flex items-center justify-between px-8 bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 flex-shrink-0">
      <div>
        <div class="flex items-center gap-1.5 text-[11px] text-slate-400 mb-0.5">
          <NuxtLink to="/settings" class="hover:text-blue-500 transition-colors">Настройки</NuxtLink>
          <UIcon name="i-ph-caret-right" class="w-2.5 h-2.5" />
          <span class="text-slate-600 dark:text-slate-300 font-medium">Каталог задач</span>
        </div>
        <h1 class="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Каталог задач</h1>
      </div>
      <UButton icon="i-ph-plus" size="sm" @click="openAddModal()">
        Добавить задачу
      </UButton>
    </header>

    <div class="flex-1 overflow-y-auto p-8 space-y-5">

      <!-- Stage tabs -->
      <div class="flex gap-2 flex-wrap">
        <UButton
          v-for="stage in STAGES"
          :key="stage"
          :icon="STAGE_ICONS[stage]"
          size="sm"
          :color="activeStage === stage ? 'primary' : 'neutral'"
          :variant="activeStage === stage ? 'solid' : 'outline'"
          @click="activeStage = stage"
        >
          {{ STAGE_LABELS[stage] }}
        </UButton>
      </div>

      <!-- Role accordion groups -->
      <div v-if="rolesInStage.length === 0" class="flex flex-col items-center justify-center py-16 text-slate-400">
        <UIcon name="i-ph-tray" class="w-10 h-10 mb-3 opacity-40" />
        <p class="text-sm">Нет задач на этом этапе</p>
        <UButton size="sm" variant="ghost" icon="i-ph-plus" class="mt-3" @click="openAddModal()">
          Добавить первую задачу
        </UButton>
      </div>

      <UCard
        v-for="role in rolesInStage"
        :key="role"
      >
        <!-- Role header -->
        <template #header>
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <UIcon :name="ROLE_ICONS[role]" class="w-5 h-5 text-blue-500" />
              <span class="font-semibold text-slate-800 dark:text-slate-200">{{ ROLE_LABELS[role] }}</span>
              <UBadge color="neutral" variant="soft" size="xs">
                {{ stageRoleGroups.get(role)?.length ?? 0 }}
              </UBadge>
            </div>
            <UButton
              size="sm"
              icon="i-ph-plus"
              variant="ghost"
              color="primary"
              @click="openAddModal(activeStage, role)"
            >
              Добавить
            </UButton>
          </div>
        </template>

        <!-- Task list -->
        <div class="space-y-2">
          <div
            v-for="task in stageRoleGroups.get(role)"
            :key="task.id"
            class="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 group"
          >
            <UIcon name="i-ph-dots-six-vertical" class="w-4 h-4 text-slate-300 flex-shrink-0" />

            <!-- Inline edit or display -->
            <div class="flex-1 min-w-0 flex items-center gap-2">
              <template v-if="editingId === task.id">
                <input
                  v-model="editingName"
                  class="flex-1 text-sm bg-white dark:bg-slate-800 border border-blue-400 rounded px-2 py-1 outline-none"
                  autofocus
                  @keydown.enter="saveEdit(task.id)"
                  @keydown.escape="cancelEdit"
                />
                <input
                  v-model.number="editingDefaultDays"
                  type="number"
                  min="1"
                  placeholder="дн."
                  class="w-16 text-sm bg-white dark:bg-slate-800 border border-blue-400 rounded px-2 py-1 outline-none text-center"
                  @keydown.enter="saveEdit(task.id)"
                  @keydown.escape="cancelEdit"
                />
              </template>
              <template v-else>
                <span class="text-sm text-slate-700 dark:text-slate-300">{{ task.name }}</span>
                <span v-if="task.defaultDays" class="text-xs text-slate-400 bg-slate-100 dark:bg-slate-800 rounded px-1.5 py-0.5 flex-shrink-0">
                  {{ task.defaultDays }} дн.
                </span>
              </template>
            </div>

            <!-- Actions (visible on hover) -->
            <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
              <UButton
                v-if="editingId !== task.id"
                size="sm"
                icon="i-ph-pencil"
                variant="ghost"
                color="neutral"
                @click="startEdit(task.id, task.name, task.defaultDays)"
              />
              <UButton
                v-if="editingId === task.id"
                size="sm"
                icon="i-ph-check"
                variant="ghost"
                color="green"
                @click="saveEdit(task.id)"
              />
              <UButton
                size="sm"
                icon="i-ph-trash"
                variant="ghost"
                color="red"
                @click="confirmDelete(task.id)"
              />
            </div>
          </div>

          <!-- Inline add row -->
          <div
            class="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-slate-200 dark:border-slate-700 cursor-pointer hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors text-slate-400 hover:text-blue-500"
            @click="openAddModal(activeStage, role)"
          >
            <UIcon name="i-ph-plus" class="w-4 h-4" />
            <span class="text-xs">Добавить задачу для {{ ROLE_LABELS[role].toLowerCase() }}</span>
          </div>
        </div>
      </UCard>
    </div>

    <!-- Add Task Modal -->
    <UModal v-model:open="showAddModal" title="Добавить задачу">
      <template #body>
        <div class="space-y-4">
          <UFormField label="Название задачи" required>
            <UInput
              v-model="newTask.name"
              placeholder="Введите название задачи..."
              autofocus
              @keydown.enter="submitAddTask"
            />
          </UFormField>
          <UFormField label="Этап">
            <USelect v-model="newTask.stage" :options="stageOptions" />
          </UFormField>
          <UFormField label="Роль специалиста">
            <USelect v-model="newTask.role" :options="roleOptions" />
          </UFormField>
          <UFormField label="Срок по умолчанию (дней)">
            <UInput
              v-model.number="newTask.defaultDays"
              type="number"
              min="1"
              placeholder="Например: 14"
            />
          </UFormField>
        </div>
      </template>
      <template #footer>
        <div class="flex gap-2 justify-end">
          <UButton variant="ghost" color="neutral" @click="showAddModal = false">Отмена</UButton>
          <UButton :disabled="!newTask.name.trim()" @click="submitAddTask">Добавить</UButton>
        </div>
      </template>
    </UModal>

    <!-- Delete Confirm Modal -->
    <UModal :open="!!confirmDeleteId" @update:open="confirmDeleteId = null" title="Удалить задачу?">
      <template #body>
        <p class="text-sm text-slate-600 dark:text-slate-400">
          Это действие удалит задачу из каталога. Уже назначенные задачи в проектах не затронуты.
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
