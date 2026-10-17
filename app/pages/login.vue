<template>
  <div class="min-h-dvh lg:grid lg:grid-cols-[1.1fr_1fr]">
    <section class="hidden lg:flex relative bg-gradient-to-br from-emerald-950 to-emerald-700 text-emerald-50 flex-col justify-center p-16 overflow-hidden">
      <div class="absolute -right-24 -bottom-32 w-[28rem] h-[28rem] rounded-full bg-emerald-300/20 blur-sm" />
      <div class="relative max-w-xl">
        <div class="flex items-center gap-3 font-extrabold text-lg mb-8">
          <span class="w-10 h-10 rounded-xl bg-white/20 grid place-items-center">♻</span>
          <span>Bank Sampah RW Digital</span>
        </div>
        <h1 class="text-5xl font-extrabold leading-tight tracking-tight mb-4">
          Pilah sampah dari rumah, pantau tabungan secara real-time.
        </h1>
        <p class="text-emerald-100 leading-relaxed max-w-md">
          Platform web untuk warga, petugas, pengepul, dan pengurus RW. Pencatatan penimbangan, saldo tabungan, dan dasbor analitik timbulan sampah dalam satu sistem.
        </p>
        <div class="grid grid-cols-2 gap-3 mt-8 max-w-md">
          <div class="bg-white/10 border border-white/20 rounded-2xl p-4">
            <div class="text-2xl font-extrabold">12.4 ton</div>
            <div class="text-sm text-emerald-200">Sampah terkumpul</div>
          </div>
          <div class="bg-white/10 border border-white/20 rounded-2xl p-4">
            <div class="text-2xl font-extrabold">326</div>
            <div class="text-sm text-emerald-200">Warga aktif</div>
          </div>
          <div class="bg-white/10 border border-white/20 rounded-2xl p-4">
            <div class="text-2xl font-extrabold">Rp 18,7 jt</div>
            <div class="text-sm text-emerald-200">Saldo tabungan</div>
          </div>
          <div class="bg-white/10 border border-white/20 rounded-2xl p-4">
            <div class="text-2xl font-extrabold">94%</div>
            <div class="text-sm text-emerald-200">Kepatuhan pilah</div>
          </div>
        </div>
      </div>
    </section>

    <div class="flex items-center justify-center p-6 lg:p-10 bg-emerald-50">
      <UPageCard class="w-full max-w-md">
        <UAuthForm
          :schema="schema"
          :fields="fields"
          title="Masuk"
          description="Gunakan akun email dan kata sandi sesuai peran."
          icon="i-lucide-recycle"
          :submit="{ label: 'Masuk ke Dasbor', block: true }"
          @submit="onSubmit"
        >
          <template #validation>
            <UAlert v-if="error" color="error" variant="soft" :title="error" class="mb-4" />
          </template>
          <template #footer>
            Belum punya akun? Hubungi pengurus RW.
          </template>
        </UAuthForm>
      </UPageCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent, AuthFormField } from '@nuxt/ui'

definePageMeta({ layout: false })

const supabase = useSupabaseClient()

const fields: AuthFormField[] = [
  { name: 'email', type: 'email', label: 'Email', placeholder: 'nama@rw05.id', required: true },
  { name: 'password', type: 'password', label: 'Kata sandi', placeholder: '••••••••', required: true },
]

const schema = z.object({
  email: z.email('Email tidak valid'),
  password: z.string().min(1, 'Kata sandi wajib diisi'),
})

type Schema = z.output<typeof schema>

const error = ref('')

async function onSubmit(event: FormSubmitEvent<Schema>) {
  error.value = ''
  const { error: authError } = await supabase.auth.signInWithPassword(event.data)
  if (authError) {
    error.value = authError.message
    return
  }
  await navigateTo('/')
}
</script>