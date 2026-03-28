export function useApi() {
  const toast = useToast()

  async function request<T>(
    fn: () => Promise<T>,
    errorMsg = 'Ошибка запроса',
  ): Promise<T | null> {
    try {
      return await fn()
    }
    catch (e: any) {
      const desc = e?.data?.message ?? e?.message ?? ''
      toast.add({ color: 'error', title: errorMsg, description: desc })
      return null
    }
  }

  function success(title: string, description?: string) {
    toast.add({ color: 'success', title, description })
  }

  function warn(title: string, description?: string) {
    toast.add({ color: 'warning', title, description })
  }

  return { request, success, warn }
}
