<script setup lang="ts">
definePageMeta({ layout: 'dashboard', middleware: ['auth'] })
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <!-- no navbar title: the body already shows the centred denial state -->
      <UDashboardNavbar />
    </template>

    <template #body>
      <div class="max-w-md mx-auto text-center py-16">
        <h1 class="text-2xl font-extrabold mb-2">{{ $t('denied.title') }}</h1>
        <p class="text-sm text-muted mb-6">{{ $t('denied.subtitle') }}</p>
        <UButton :label="$t('denied.back')" to="/" />
      </div>
    </template>
  </UDashboardPanel>
</template>
