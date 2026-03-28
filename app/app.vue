<script setup lang="ts">
useHead({
  meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1' }],
  link: [{ rel: 'icon', href: '/favicon.ico' }],
  htmlAttrs: { lang: 'ru' }
})
useSeoMeta({
  title: 'AEC-Flow CRM',
  description: 'CRM для архитектурно-проектных организаций Узбекистана'
})
</script>

<template>
  <UApp>
    <NuxtLoadingIndicator color="rgb(59,130,246)" :height="3" />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
