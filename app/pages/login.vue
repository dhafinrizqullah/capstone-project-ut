<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import { loginSchema, type LoginSchema } from '~/utils/login-schema'

definePageMeta({ layout: false, middleware: 'guest' })

const state = reactive<Partial<LoginSchema>>({ email: '', password: '' })

const supabase = useSupabaseClient()
const loading = ref(false)
const serverError = ref('')

async function onSubmit(event: FormSubmitEvent<LoginSchema>) {
  loading.value = true
  serverError.value = ''
  const { error: authError } = await supabase.auth.signInWithPassword({
    email: event.data.email,
    password: event.data.password,
  })
  loading.value = false
  if (authError) {
    serverError.value = 'Email atau kata sandi salah. Periksa kembali lalu coba lagi.'
    return
  }
  await navigateTo('/')
}
</script>

<template>
  <div class="min-h-dvh lg:grid lg:grid-cols-[1.1fr_1fr]">
    <section class="hidden lg:flex relative bg-gradient-to-br from-emerald-950 to-emerald-700 text-emerald-50 flex-col justify-center p-16 overflow-hidden">
      <div class="absolute -right-24 -bottom-32 w-[28rem] h-[28rem] rounded-full bg-emerald-300/20 blur-sm" aria-hidden="true" />
      <div class="relative max-w-xl">
        <div class="flex items-center gap-3 font-extrabold text-lg mb-8">
          <span class="w-10 h-10 rounded-xl bg-white/20 grid place-items-center" aria-hidden="true">♻</span>
          <span>Bank Sampah RW Digital</span>
        </div>
        <h1 class="text-5xl font-extrabold leading-tight tracking-tight mb-4 text-balance">
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
      <div class="w-full max-w-md bg-white border border-emerald-100 rounded-3xl shadow-2xl p-8">
        <h2 class="text-2xl font-extrabold tracking-tight mb-1 text-slate-900">Masuk</h2>
        <p class="text-slate-500 mb-6">Gunakan akun email dan kata sandi sesuai peran.</p>

        <UForm :schema="loginSchema" :state="state" class="space-y-4" @submit="onSubmit">
          <UFormField name="email" label="Email" required>
            <UInput
              v-model="state.email"
              type="email"
              name="email"
              autocomplete="email"
              :spellcheck="false"
              placeholder="nama@rw05.id…"
              size="lg"
              :ui="{ base: 'rounded-xl' }"
              class="w-full"
            />
          </UFormField>

          <UFormField name="password" label="Kata sandi" required>
            <UInput
              v-model="state.password"
              type="password"
              name="password"
              autocomplete="current-password"
              placeholder="••••••••…"
              size="lg"
              :ui="{ base: 'rounded-xl' }"
              class="w-full"
            />
          </UFormField>

          <UAlert
            v-if="serverError"
            color="error"
            variant="soft"
            :title="serverError"
            aria-live="polite"
          />

          <UButton
            type="submit"
            block
            size="lg"
            :ui="{ base: 'rounded-xl font-bold' }"
            :loading="loading"
            label="Masuk ke Dasbor"
          />
        </UForm>

        <p class="text-center text-sm text-slate-500 mt-6">
          Belum punya akun? Hubungi pengurus RW.
        </p>
      </div>
    </div>
  </div>
</template>
