import { useAuthStore } from '~/stores/useAuthStore'

export default defineNuxtPlugin(async () => {
  const auth = useAuthStore()
  // On every page load (SSR + client), hydrate from server session
  try {
    const member = await $fetch('/api/auth/me')
    if (member) {
      auth.currentUserId = (member as { id: string }).id
    } else {
      auth.currentUserId = null
    }
  } catch {
    auth.currentUserId = null
  }
})
