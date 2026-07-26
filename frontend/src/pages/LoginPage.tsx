import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { login } from '../lib/api'

export default function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    try {
      const res = await login(email, password)
      localStorage.setItem('token', res.data.access_token)
      navigate('/products')
    } catch {
      setError('Email veya şifre hatalı')
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
          <h1 className="text-2xl font-extrabold text-slate-900 mb-1 tracking-tight">Giriş Yap</h1>
          <p className="text-sm text-slate-400 mb-6">Hesabına giriş yaparak alışverişe devam et.</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-shadow"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Şifre</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-shadow"
                required
              />
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button
              type="submit"
              className="w-full bg-slate-900 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-brand-700 transition-colors"
            >
              Giriş Yap
            </button>
          </form>
          <p className="mt-5 text-sm text-center text-slate-500">
            Hesabın yok mu?{' '}
            <Link to="/register" className="text-brand-600 font-semibold hover:underline">
              Kayıt Ol
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
