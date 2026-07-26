import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import LogPanel from './LogPanel'

const navItems = [
  { to: '/products', label: 'Ürünler' },
  { to: '/cart', label: 'Sepet' },
  { to: '/orders', label: 'Siparişlerim' },
]

export default function Layout() {
  const navigate = useNavigate()

  function logout() {
    localStorage.removeItem('token')
    navigate('/login')
  }

  return (
    <div className="h-screen flex bg-slate-50 overflow-hidden">
      <div className="flex-1 min-w-0 flex flex-col">
        <nav className="shrink-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200/80">
          <div className="max-w-6xl mx-auto px-6 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white font-bold text-sm shadow-card">
                M
              </span>
              <span className="text-lg font-extrabold text-slate-900 tracking-tight">
                Micro<span className="text-brand-600">Shop</span>
              </span>
            </div>

            <div className="flex items-center gap-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors ${
                      isActive
                        ? 'bg-brand-50 text-brand-700'
                        : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
              <button
                onClick={logout}
                className="ml-2 px-3.5 py-2 rounded-lg text-sm font-semibold text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
              >
                Çıkış
              </button>
            </div>
          </div>
        </nav>

        <main className="flex-1 min-h-0 overflow-y-auto">
          <div className="max-w-6xl mx-auto px-6 py-10">
            <Outlet />
          </div>
        </main>
      </div>
      <LogPanel />
    </div>
  )
}
