<script setup lang="ts">
import { STAGES, STAGE_MAP } from '~/constants/stages'
import { useProjectsStore } from '~/stores/projects'
import { useProjectValidation } from '~/composables/useProjectValidation'
import type { ProjectStage, DocumentStatus } from '~/types/project'

definePageMeta({ layout: 'default' })

const route = useRoute()
const router = useRouter()
const store = useProjectsStore()
const { canAdvance, stageProgress } = useProjectValidation()

const project = computed(() => store.getById(route.params.id as string))

watchEffect(() => {
  if (!project.value) router.push('/')
})

const currentStageData = computed(() =>
  project.value?.stages.find(s => s.stage === project.value?.currentStage)
)

const stageInfo = computed(() => project.value ? STAGE_MAP[project.value.currentStage] : null)

const activeTab = ref('checklist')
const tabs = [
  { label: 'Чеклист', value: 'checklist', icon: 'i-ph-check-square' },
  { label: 'Документы', value: 'documents', icon: 'i-ph-files' },
  { label: 'Калькулятор', value: 'calculator', icon: 'i-ph-calculator' }
]

// Expertise calculator
const smrAmount = ref<number>(0)
const feeAmount = computed(() => Math.round(smrAmount.value * 0.001))
const feeFormatted = computed(() => feeAmount.value.toLocaleString('ru-RU'))
const smrFormatted = computed(() => smrAmount.value.toLocaleString('ru-RU'))
const copied = ref(false)
function copyFee() {
  navigator.clipboard.writeText(String(feeAmount.value))
  copied.value = true
  setTimeout(() => { copied.value = false }, 2000)
}

// Validation
const validation = computed(() => project.value ? canAdvance(project.value) : { ok: false, errors: [] })

function advanceStage() {
  if (!project.value || !validation.value.ok) return
  store.advanceStage(project.value.id)
}

function toggleChecklist(itemId: string, done: boolean) {
  if (!project.value) return
  store.updateChecklistItem(project.value.id, project.value.currentStage, itemId, done)
}

function cycleDocStatus(docId: string, currentStatus: DocumentStatus) {
  if (!project.value) return
  const next: Record<DocumentStatus, DocumentStatus> = {
    pending: 'uploaded',
    uploaded: 'approved',
    approved: 'pending'
  }
  store.updateDocumentStatus(project.value.id, project.value.currentStage, docId, next[currentStatus])
}

const docStatusConfig: Record<DocumentStatus, { color: string; label: string; icon: string }> = {
  pending: { color: 'neutral', label: 'Ожидает', icon: 'i-ph-clock' },
  uploaded: { color: 'blue', label: 'Загружен', icon: 'i-ph-upload' },
  approved: { color: 'green', label: 'Одобрен', icon: 'i-ph-check-circle' }
}

const stageBadgeColor: Record<number, string> = {
  1: 'neutral', 2: 'purple', 3: 'amber', 4: 'blue', 5: 'indigo', 6: 'orange', 7: 'green'
}

// Stage progress bar for all stages
const allStagesProgress = computed(() =>
  project.value
    ? STAGES.map(s => ({
        ...s,
        progress: stageProgress(project.value!, s.id as ProjectStage),
        isActive: s.id === project.value!.currentStage,
        isDone: s.id < project.value!.currentStage
      }))
    : []
)
</script>

<template>
  <div v-if="project" class="flex flex-col h-full overflow-hidden">
    <!-- Header -->
    <header class="px-6 py-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
      <div class="flex items-start justify-between gap-4">
        <div class="flex items-center gap-3">
          <NuxtLink to="/" class="text-slate-400 hover:text-slate-600 transition-colors">
            <UIcon name="i-ph-arrow-left" class="w-5 h-5" />
          </NuxtLink>
          <div>
            <h1 class="text-lg font-bold text-slate-900 dark:text-white">{{ project.name }}</h1>
            <div class="flex items-center gap-3 mt-1">
              <span class="text-sm text-slate-500 flex items-center gap-1">
                <UIcon name="i-ph-user" class="w-3.5 h-3.5" />
                {{ project.client }}
              </span>
              <span class="text-slate-300">•</span>
              <span class="text-sm text-slate-500 flex items-center gap-1">
                <UIcon name="i-ph-map-pin" class="w-3.5 h-3.5" />
                {{ project.location }}
              </span>
            </div>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <UBadge
            v-if="stageInfo"
            :color="stageBadgeColor[project.currentStage] as any"
            variant="soft"
            :icon="stageInfo.icon"
          >
            Стадия {{ project.currentStage }}: {{ stageInfo.label }}
          </UBadge>
          <UButton
            size="sm"
            :disabled="!validation.ok || project.currentStage >= 7"
            icon="i-ph-arrow-right"
            trailing
            @click="advanceStage"
          >
            Следующая стадия
          </UButton>
        </div>
      </div>

      <!-- Stage validation warning -->
      <div v-if="!validation.ok && validation.errors.length > 0" class="mt-3">
        <UAlert
          color="amber"
          variant="soft"
          icon="i-ph-warning"
          title="Требуется для перехода:"
          :description="validation.errors.join(' • ')"
        />
      </div>

      <!-- Stage pipeline -->
      <div class="flex items-center gap-1 mt-4 overflow-x-auto pb-1">
        <template v-for="(s, idx) in allStagesProgress" :key="s.id">
          <div
            class="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium flex-shrink-0 transition-all"
            :class="s.isActive
              ? `bg-${stageBadgeColor[s.id]}-100 text-${stageBadgeColor[s.id]}-700 ring-2 ring-${stageBadgeColor[s.id]}-400`
              : s.isDone
                ? 'bg-green-50 text-green-600'
                : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'"
          >
            <UIcon
              :name="s.isDone ? 'i-ph-check-circle' : s.icon"
              class="w-3.5 h-3.5"
            />
            <span>{{ s.label }}</span>
          </div>
          <div v-if="idx < allStagesProgress.length - 1" class="w-4 h-px bg-slate-200 dark:bg-slate-700 flex-shrink-0" />
        </template>
      </div>
    </header>

    <!-- Tabs + Content -->
    <div class="flex-1 overflow-hidden flex flex-col">
      <!-- Tab bar -->
      <div class="flex border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 flex-shrink-0">
        <button
          v-for="tab in tabs"
          :key="tab.value"
          class="flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px"
          :class="activeTab === tab.value
            ? 'border-blue-600 text-blue-700 dark:text-blue-400'
            : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'"
          @click="activeTab = tab.value"
        >
          <UIcon :name="tab.icon" class="w-4 h-4" />
          {{ tab.label }}
        </button>
      </div>

      <div class="flex-1 overflow-y-auto p-6">
        <!-- CHECKLIST TAB -->
        <div v-if="activeTab === 'checklist' && currentStageData">
          <div class="max-w-2xl space-y-3">
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-base font-semibold text-slate-800 dark:text-slate-200">
                Чеклист — {{ stageInfo?.label }}
              </h2>
              <span class="text-sm text-slate-500">
                {{ currentStageData.checklist.filter(c => c.done).length }} /
                {{ currentStageData.checklist.length }}
              </span>
            </div>
            <div
              v-for="item in currentStageData.checklist"
              :key="item.id"
              class="flex items-center gap-3 p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 cursor-pointer hover:border-blue-300 transition-colors"
              @click="toggleChecklist(item.id, !item.done)"
            >
              <UCheckbox :model-value="item.done" @update:model-value="toggleChecklist(item.id, $event)" />
              <span
                class="text-sm"
                :class="item.done ? 'line-through text-slate-400' : 'text-slate-700 dark:text-slate-300'"
              >
                {{ item.label }}
              </span>
            </div>
          </div>
        </div>

        <!-- DOCUMENTS TAB -->
        <div v-if="activeTab === 'documents' && currentStageData">
          <div class="max-w-2xl">
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-base font-semibold text-slate-800 dark:text-slate-200">
                Документы — {{ stageInfo?.label }}
              </h2>
              <p class="text-xs text-slate-400">Нажмите на статус для изменения</p>
            </div>

            <!-- Stage 4 gate warning -->
            <UAlert
              v-if="project.currentStage === 4"
              color="blue"
              variant="soft"
              icon="i-ph-info"
              class="mb-4"
              title="Требование для экспертизы"
              description="Для перехода к Стадии 5 необходимо загрузить: АР, КЖ, Смета."
            />

            <div class="space-y-2">
              <div
                v-for="doc in currentStageData.documents"
                :key="doc.id"
                class="flex items-center justify-between p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
              >
                <div class="flex items-center gap-3">
                  <UIcon name="i-ph-file-text" class="w-4 h-4 text-slate-400" />
                  <div>
                    <p class="text-sm font-medium text-slate-800 dark:text-slate-200">{{ doc.name }}</p>
                    <p v-if="doc.uploadedAt" class="text-xs text-slate-400">
                      {{ new Date(doc.uploadedAt).toLocaleDateString('ru-RU') }}
                    </p>
                  </div>
                </div>
                <UBadge
                  :color="docStatusConfig[doc.status].color as any"
                  :icon="docStatusConfig[doc.status].icon"
                  variant="soft"
                  class="cursor-pointer select-none"
                  @click="cycleDocStatus(doc.id, doc.status)"
                >
                  {{ docStatusConfig[doc.status].label }}
                </UBadge>
              </div>
            </div>
          </div>
        </div>

        <!-- CALCULATOR TAB -->
        <div v-if="activeTab === 'calculator'">
          <div class="max-w-lg">
            <h2 class="text-base font-semibold text-slate-800 dark:text-slate-200 mb-1">
              Калькулятор сбора экспертизы
            </h2>
            <p class="text-sm text-slate-500 mb-6">
              Расчёт 0.1% сбора за экспертизу проектной документации (СМР).
            </p>

            <UCard :ui="{ body: 'p-6' }">
              <div class="space-y-6">
                <UFormField label="Стоимость СМР (сумы)" required>
                  <UInput
                    v-model.number="smrAmount"
                    type="number"
                    placeholder="0"
                    size="xl"
                    class="w-full"
                    :trailing-icon="'i-ph-wallet'"
                  />
                </UFormField>

                <USeparator />

                <div class="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-5">
                  <div class="flex items-center justify-between">
                    <div>
                      <p class="text-sm text-blue-700 dark:text-blue-400 font-medium">Сбор экспертизы (0.1%)</p>
                      <p class="text-xs text-blue-500 mt-0.5">от {{ smrFormatted }} сум</p>
                    </div>
                    <div class="flex items-center gap-3">
                      <div class="text-right">
                        <p class="text-2xl font-bold text-blue-700 dark:text-blue-300">
                          {{ feeFormatted }}
                        </p>
                        <p class="text-xs text-blue-500">сум</p>
                      </div>
                      <UButton
                        size="sm"
                        :icon="copied ? 'i-ph-check' : 'i-ph-copy'"
                        :color="copied ? 'green' : 'primary'"
                        variant="soft"
                        :disabled="smrAmount === 0"
                        @click="copyFee"
                      >
                        {{ copied ? 'Скопировано' : 'Копировать' }}
                      </UButton>
                    </div>
                  </div>
                </div>

                <div class="text-xs text-slate-400 space-y-1">
                  <p>• Регистрация проекта на <span class="font-medium">my.gov.uz</span></p>
                  <p>• Срок рассмотрения: 30 рабочих дней</p>
                  <p>• Основание: Постановление КМ РУз №289</p>
                </div>
              </div>
            </UCard>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
