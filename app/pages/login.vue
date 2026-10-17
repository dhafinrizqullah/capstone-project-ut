<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import { createLoginSchema, type LoginSchema } from '~/utils/login-schema'
import type { Database } from '~/types/database.types'
import { HOME_BY_ROLE } from '~/middleware/role'

definePageMeta({ titleKey: 'auth.title', layout: false, middleware: 'guest' })

const { t } = useI18n()
const loginSchema = computed(() => createLoginSchema({ email: t('auth.emailInvalid'), password: t('auth.passwordRequired') }))
const state = reactive<Partial<LoginSchema>>({ email: '', password: '' })

const client = useSupabaseClient<Database>()
const loading = ref(false)
const serverError = ref('')

async function onSubmit(event: FormSubmitEvent<LoginSchema>) {
  loading.value = true
  serverError.value = ''
  try {
    // ponytail: use the user from the sign-in response directly — skips the getUser roundtrip that fails when http rejects Secure cookies
    const { data: signIn, error: authError } = await client.auth.signInWithPassword({
      email: event.data.email,
      password: event.data.password,
    })
    if (authError) {
      serverError.value = t('auth.failed')
      return
    }
    const user = signIn.user
    // ponytail: wait for the module auth listener to sync (INITIAL_SESSION can briefly overwrite) before navigating
    const userState = useSupabaseUser()
    const deadline = Date.now() + 5000
    while (!userState.value && Date.now() < deadline) await new Promise(r => setTimeout(r, 100))
    const { data: profile, error: profErr } = user
      ? await client.from('profiles').select('role').eq('id', user.id).maybeSingle()
      : { data: null, error: { message: 'no-user' } as Error }
    if (profErr || !profile) {
      serverError.value = profErr?.message ?? t('auth.failed')
      return
    }
    await navigateTo(HOME_BY_ROLE[profile.role] ?? '/')
  }
  catch (e) {
    serverError.value = (e as Error).message ?? t('auth.failed')
  }
  finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
    <section class="relative hidden bg-gradient-to-br from-emerald-950 to-emerald-700 text-emerald-50 lg:flex flex-col justify-center overflow-hidden p-10 xl:p-16">
      <div class="absolute -right-24 -bottom-32 w-[28rem] h-[28rem] rounded-full bg-emerald-300/20 blur-sm" aria-hidden="true" />
      <div class="relative max-w-xl">
        <div class="flex items-center gap-3 font-extrabold text-lg mb-8">
          <span class="grid size-10 place-items-center rounded-xl bg-white/20" aria-hidden="true">
            <UIcon name="i-lucide-recycle" class="size-5" />
          </span>
          <span>{{ $t('brand') }}</span>
        </div>
        <h1 class="text-5xl font-extrabold leading-tight tracking-tight mb-4 text-balance">
          {{ $t('auth.heroTitle') }}
        </h1>
        <p class="text-emerald-100 leading-relaxed max-w-md">
          {{ $t('auth.heroSubtitle') }}
        </p>
        <div class="grid grid-cols-2 gap-3 mt-8 max-w-md">
          <div class="bg-white/10 border border-white/20 rounded-2xl p-4">
            <div class="text-2xl font-extrabold">12.4 ton</div>
            <div class="text-sm text-emerald-200">{{ $t('auth.statWaste') }}</div>
          </div>
          <div class="bg-white/10 border border-white/20 rounded-2xl p-4">
            <div class="text-2xl font-extrabold">326</div>
            <div class="text-sm text-emerald-200">{{ $t('auth.statResidents') }}</div>
          </div>
          <div class="bg-white/10 border border-white/20 rounded-2xl p-4">
            <div class="text-2xl font-extrabold">Rp 18,7 jt</div>
            <div class="text-sm text-emerald-200">{{ $t('auth.statBalance') }}</div>
          </div>
          <div class="bg-white/10 border border-white/20 rounded-2xl p-4">
            <div class="text-2xl font-extrabold">94%</div>
            <div class="text-sm text-emerald-200">{{ $t('auth.statCompliance') }}</div>
          </div>
        </div>
      </div>
    </section>

    <div class="flex items-center justify-center bg-emerald-50 p-5 sm:p-6 lg:p-10">
      <div class="w-full max-w-md bg-white border border-emerald-100 rounded-3xl shadow-2xl p-6 sm:p-8">
        <!-- the hero carries the brand from lg up; smaller screens keep a compact mark -->
        <div class="mb-6 flex items-center gap-2.5 lg:hidden">
          <span class="grid size-9 shrink-0 place-items-center rounded-xl bg-emerald-600 text-white" aria-hidden="true">
            <UIcon name="i-lucide-recycle" class="size-5" />
          </span>
          <span class="text-sm font-extrabold text-emerald-950">{{ $t('brand') }}</span>
        </div>

        <h2 class="text-2xl font-extrabold tracking-tight mb-1 text-slate-900">{{ $t('auth.title') }}</h2>
        <p class="text-slate-500 mb-6">{{ $t('auth.subtitle') }}</p>

        <UForm :schema="loginSchema" :state="state" class="space-y-4" @submit="onSubmit">
          <UFormField name="email" :label="$t('auth.email')" required>
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

          <UFormField name="password" :label="$t('auth.password')" required>
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
            :label="$t('auth.submit')"
          />
        </UForm>

        <p class="text-center text-sm text-slate-500 mt-6">
          {{ $t('auth.noAccount') }}
        </p>
      </div>
    </div>
  </div>
</template>
