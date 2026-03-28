<script setup lang="ts">
const props = withDefaults(defineProps<{
  open: boolean
  title?: string
  description?: string
  confirmLabel?: string
  confirmColor?: string
  loading?: boolean
}>(), {
  title: 'Вы уверены?',
  confirmLabel: 'Подтвердить',
  confirmColor: 'error',
})

const emit = defineEmits<{
  'update:open': [value: boolean]
  confirm: []
}>()

const close = () => emit('update:open', false)
const confirm = () => emit('confirm')
</script>

<template>
  <UModal :open="open" @update:open="emit('update:open', $event)" :ui="{ content: 'sm:max-w-sm' }">
    <template #content>
      <div class="p-6 text-center">
        <div class="w-12 h-12 rounded-full bg-red-100 dark:bg-red-500/20 flex items-center justify-center mx-auto mb-4">
          <UIcon name="i-ph-warning" class="w-6 h-6 text-red-600 dark:text-red-400" />
        </div>
        <h3 class="text-base font-semibold text-gray-900 dark:text-white mb-2">{{ title }}</h3>
        <p v-if="description" class="text-sm text-gray-500 dark:text-white/50 mb-6">{{ description }}</p>
        <div class="flex gap-3 justify-center">
          <UButton variant="ghost" color="neutral" @click="close">Отмена</UButton>
          <UButton :color="confirmColor as any" :loading="loading" @click="confirm">
            {{ confirmLabel }}
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
