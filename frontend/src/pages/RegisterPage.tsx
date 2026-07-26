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
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 w-full max-w-sm">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Kayıt Ol</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          {(['full_name', 'email', 'password'] as const).map((field) => (
            <div key={field}>
              <label className="block text-sm font-medium text-gray-700 mb-1 capitalize">
                {field === 'full_name' ? 'Ad Soyad' : field === 'email' ? 'Email' : 'Şifre'}
              </label>
              <input
                type={field === 'password' ? 'password' : field === 'email' ? 'email' : 'text'}
                value={form[field]}
                onChange={(e) => update(field, e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>
          ))}
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            type="submit"
            className="w-full bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            Kayıt Ol
          </button>
        </form>
        <p className="mt-4 text-sm text-center text-gray-600">
          Hesabın var mı?{' '}
          <Link to="/login" className="text-indigo-600 hover:underline">
            Giriş Yap
          </Link>
        </p>
      </div>
    </div>
  )
}
