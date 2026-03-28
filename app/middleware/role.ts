export default defineNuxtRouteMiddleware((to) => {
  const auth = useAuthStore()
  const role = auth.currentRole

  if (!role) return

  const isPm = role === 'pm'
  const isCeo = role === 'ceo'
  const isFinancier = role === 'financier'
  const isStaff = role === 'staff'

  if (to.path.startsWith('/pm/') && !isPm && !isCeo) {
    return navigateTo(auth.roleHome)
  }
  if (to.path.startsWith('/finance/') && !isFinancier && !isCeo) {
    return navigateTo(auth.roleHome)
  }
  if (to.path.startsWith('/staff/') && !isStaff) {
    return navigateTo(auth.roleHome)
  }
  // /analytics and /settings - CEO only (if those pages exist)
  if ((to.path === '/analytics' || to.path === '/settings') && !isCeo) {
    return navigateTo(auth.roleHome)
  }
})
