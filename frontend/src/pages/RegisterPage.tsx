import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { register } from '../lib/api'

export default function RegisterPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '', full_name: '' })
  const [error, setError] = useState('')

  function update(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    try {
      await register(form)
      navigate('/login')
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Kayıt başarısız')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-950 via-brand-800 to-brand-600 px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <span className="w-9 h-9 rounded-lg bg-white/15 backdrop-blur flex items-center justify-center text-white font-bold text-base ring-1 ring-white/20">
            M
          </span>
          <span className="text-xl font-extrabold text-white tracking-tight">
            Micro<span className="text-brand-200">Shop</span>
          </span>
        </div>

        <div className="bg-white p-8 rounded-2xl shadow-card-hover">
          <h1 className="text-2xl font-extrabold text-slate-900 mb-1 tracking-tight">Kayıt Ol</h1>
          <p className="text-sm text-slate-400 mb-6">Ücretsiz hesap oluştur, alışverişe başla.</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            {(['full_name', 'email', 'password'] as const).map((field) => (
              <div key={field}>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  {field === 'full_name' ? 'Ad Soyad' : field === 'email' ? 'Email' : 'Şifre'}
                </label>
                <input
                  type={field === 'password' ? 'password' : field === 'email' ? 'email' : 'text'}
                  value={form[field]}
                  onChange={(e) => update(field, e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-shadow"
                  required
                />
              </div>
            ))}
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button
              type="submit"
              className="w-full bg-slate-900 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-brand-700 transition-colors"
            >
              Kayıt Ol
            </button>
          </form>
          <p className="mt-5 text-sm text-center text-slate-500">
            Hesabın var mı?{' '}
            <Link to="/login" className="text-brand-600 font-semibold hover:underline">
              Giriş Yap
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
