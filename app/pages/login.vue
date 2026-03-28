<script setup lang="ts">
import { useAuthStore, MOCK_STAFF } from '~/stores/useAuthStore'

definePageMeta({ layout: false, middleware: [] })

const auth = useAuthStore()
const toast = useToast()

if (auth.isAuthenticated) {
  navigateTo(auth.roleHome)
}

const ROLE_CONFIG = {
  ceo:       { icon: 'i-ph-crown',       badge: 'amber',   label: 'Директор' },
  pm:        { icon: 'i-ph-hard-hat',     badge: 'blue',    label: 'Менеджер проектов' },
  financier: { icon: 'i-ph-wallet',       badge: 'success', label: 'Финансист' },
  staff:     { icon: 'i-ph-pencil-ruler', badge: 'purple',  label: 'Сотрудник' },
}

const loggingIn = ref<string | null>(null)

async function selectUser(staffId: string) {
  if (loggingIn.value) return
  loggingIn.value = staffId
  try {
    await auth.login(staffId)
    await navigateTo(auth.roleHome)
  }
  catch (e: any) {
    toast.add({ color: 'error', title: 'Ошибка входа', description: e?.data?.message ?? e?.message })
  }
  finally {
    loggingIn.value = null
  }
}
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex items-center justify-center p-6 relative overflow-hidden">
      <!-- Animated bg orbs (hidden for prefers-reduced-motion) -->
      <div class="motion-safe:block hidden absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[120px] animate-pulse" />
      <div class="motion-safe:block hidden absolute bottom-[-15%] right-[-5%] w-[400px] h-[400px] bg-indigo-600/15 rounded-full blur-[100px] animate-pulse" style="animation-delay: 1s" />
      <div class="motion-safe:block hidden absolute top-[40%] right-[20%] w-[300px] h-[300px] bg-purple-600/10 rounded-full blur-[80px] animate-pulse" style="animation-delay: 2s" />

      <div class="w-full max-w-2xl relative z-10">
        <!-- Header -->
        <div class="text-center mb-12">
          <div class="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-3xl mb-5 shadow-2xl shadow-blue-500/30">
            <UIcon name="i-ph-buildings" class="w-10 h-10 text-white" />
          </div>
          <h1 class="text-4xl font-extrabold text-white tracking-tight">AEC-Flow</h1>
          <p class="text-lg text-blue-300/60 font-medium mt-1">CRM 2.0</p>
          <p class="text-slate-500 mt-3 text-sm">Выберите роль для входа в систему</p>
        </div>

        <!-- Role cards -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            v-for="user in MOCK_STAFF"
            :key="user.id"
            :disabled="!!loggingIn"
            class="group text-left p-5 rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-sm transition-all duration-300 hover:scale-[1.03] hover:bg-white/[0.08] hover:border-white/20 hover:shadow-2xl hover:shadow-blue-500/10 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100"
            @click="selectUser(user.id)"
          >
            <div class="flex items-start gap-4">
              <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
                <UIcon
                  v-if="loggingIn === user.id"
                  name="i-ph-spinner"
                  class="w-6 h-6 text-blue-400 animate-spin"
                />
                <UIcon
                  v-else
                  :name="ROLE_CONFIG[user.role].icon"
                  class="w-6 h-6 text-white/80"
                />
              </div>
              <div class="flex-1 min-w-0">
                <p class="font-bold text-white text-sm">{{ user.name }}</p>
                <p class="text-xs text-slate-400 mt-0.5">{{ user.specialization }}</p>
                <UBadge
                  :color="ROLE_CONFIG[user.role].badge as any"
                  variant="soft"
                  size="xs"
                  class="mt-2"
                >
                  {{ ROLE_CONFIG[user.role].label }}
                </UBadge>
              </div>
              <UIcon
                v-if="loggingIn !== user.id"
                name="i-ph-arrow-right"
                class="w-4 h-4 text-white/30 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all mt-0.5"
              />
            </div>
          </button>
        </div>

        <p class="text-center text-slate-600 text-xs mt-10">
          Demo-режим · SQLite база данных
        </p>
      </div>
  </div>
</template>
