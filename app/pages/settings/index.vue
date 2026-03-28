<script setup lang="ts">
definePageMeta({ layout: 'default', middleware: ['auth'] })

const sections = [
  {
    label: 'Каталог задач',
    description: 'Управление шаблонами задач по этапам и ролям специалистов',
    icon: 'i-ph-stack',
    to: '/settings/catalog',
    color: 'text-blue-500',
    bg: 'bg-blue-50 dark:bg-blue-900/20',
  },
  {
    label: 'Сотрудники',
    description: 'Добавление, редактирование и управление персоналом компании',
    icon: 'i-ph-users',
    to: '/settings/staff',
    color: 'text-purple-500',
    bg: 'bg-purple-50 dark:bg-purple-900/20',
  },
]
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <!-- Header -->
    <header class="h-16 flex items-center px-8 bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 flex-shrink-0">
      <div>
        <h1 class="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Настройки</h1>
        <p class="text-xs text-slate-400 mt-0.5">Конфигурация системы</p>
      </div>
    </header>

    <div class="flex-1 overflow-y-auto p-8">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-2xl">
        <NuxtLink
          v-for="section in sections"
          :key="section.to"
          :to="section.to"
          class="group block card-hover"
        >
          <div class="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 flex items-start gap-4 hover:border-blue-200 dark:hover:border-blue-800/60 transition-all">
            <div :class="[section.bg, 'w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0']">
              <UIcon :name="section.icon" :class="[section.color, 'w-6 h-6']" />
            </div>
            <div class="flex-1 min-w-0">
              <p class="font-semibold text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                {{ section.label }}
              </p>
              <p class="text-sm text-slate-400 mt-1 leading-relaxed">{{ section.description }}</p>
            </div>
            <UIcon name="i-ph-arrow-right" class="w-4 h-4 text-slate-300 flex-shrink-0 mt-1 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
          </div>
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
