import { useCrmStore } from '~/stores/useCrmStore'

export default defineNuxtPlugin(async () => {
  const crm = useCrmStore()
  try {
    await crm.fetchAll()
  } catch (e) {
    console.error('Failed to load initial data', e)
  }
})
