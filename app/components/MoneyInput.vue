<script setup lang="ts">
import { formatMoneyInput, parseMoney } from '~/utils/money'

const props = defineProps<{
  modelValue: string | number
  placeholder?: string
  disabled?: boolean
  size?: 'sm' | 'md' | 'lg'
}>()

const emit = defineEmits<{ 'update:modelValue': [v: string] }>()

function toDisplay(v: string | number) {
  if (typeof v === 'number') return v > 0 ? formatMoneyInput(String(v)) : ''
  return v ? formatMoneyInput(v) : ''
}

const displayValue = ref(toDisplay(props.modelValue))

watch(() => props.modelValue, (v) => {
  const newDisplay = toDisplay(v)
  if (newDisplay !== displayValue.value) displayValue.value = newDisplay
})

function onInput(e: Event) {
  const raw = (e.target as HTMLInputElement).value
  const formatted = formatMoneyInput(raw)
  displayValue.value = formatted
  emit('update:modelValue', formatted)
}
</script>

<template>
  <div class="relative">
    <UInput
      :value="displayValue"
      :placeholder="placeholder ?? '0'"
      :disabled="disabled"
      :size="size"
      inputmode="numeric"
      @input="onInput"
    >
      <template #trailing>
        <span class="text-xs text-gray-400 dark:text-white/30 select-none pr-1">сум</span>
      </template>
    </UInput>
  </div>
</template>
