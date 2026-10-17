<template>
  <div class="min-h-screen grid grid-cols-1 lg:grid-cols-2 bg-emerald-50">
    <section class="relative bg-gradient-to-br from-emerald-900 to-emerald-700 text-emerald-50 flex flex-col justify-center p-10 lg:p-20 overflow-hidden">
      <div class="absolute -right-20 -bottom-28 w-96 h-96 rounded-full bg-emerald-300/20 blur-sm" />
      <div class="relative z-10 max-w-xl">
        <div class="flex items-center gap-3 font-extrabold mb-8">
          <span class="w-10 h-10 rounded-xl bg-white/20 grid place-items-center">♻</span>
          <span>Bank Sampah RW Digital</span>
        </div>
        <h1 class="text-4xl lg:text-6xl font-extrabold leading-tight tracking-tight mb-4">
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

    <section class="flex items-center justify-center p-6 lg:p-10">
      <div class="w-full max-w-md bg-white border border-emerald-100 rounded-3xl shadow-2xl p-8">
        <h2 class="text-2xl font-extrabold tracking-tight mb-1">Masuk</h2>
        <p class="text-slate-500 mb-6">Gunakan akun email dan kata sandi sesuai peran.</p>

        <form class="space-y-4" @submit.prevent="login">
          <div>
            <label class="block text-sm font-semibold mb-1.5" for="email">Email</label>
            <input
              id="email"
              v-model="email"
              type="email"
              placeholder="nama@rw05.id"
              required
              class="w-full px-3 py-2.5 rounded-xl border border-emerald-200 bg-emerald-50/40 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
            />
          </div>
          <div>
            <label class="block text-sm font-semibold mb-1.5" for="password">Kata sandi</label>
            <input
              id="password"
              v-model="password"
              type="password"
              placeholder="••••••••"
              required
              class="w-full px-3 py-2.5 rounded-xl border border-emerald-200 bg-emerald-50/40 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
            />
          </div>

          <div v-if="error" class="rounded-xl bg-red-50 border border-red-200 text-red-700 px-3 py-2 text-sm">
            {{ error }}
          </div>

          <button
            type="submit"
            class="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold py-3 transition"
            :disabled="loading"
          >
            {{ loading ? 'Memproses...' : 'Masuk ke Dasbor' }}
          </button>
        </form>

        <p class="text-center text-sm text-slate-500 mt-6">
          Belum punya akun? Hubungi pengurus RW.
        </p>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: false })

const supabase = useSupabaseClient()
const email = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')

async function login() {
  loading.value = true
  error.value = ''

  const { error: authError } = await supabase.auth.signInWithPassword({
    email: email.value,
    password: password.value,
  })

  loading.value = false

  if (authError) {
    error.value = authError.message
    return
  }

  await navigateTo('/')
}
</script>