import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import LogPanel from './LogPanel'

export default function Layout() {
  const navigate = useNavigate()

  function logout() {
    localStorage.removeItem('token')
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <span className="text-xl font-bold text-indigo-600">MicroShop</span>
        <div className="flex items-center gap-6">
          <NavLink
            to="/products"
            className={({ isActive }) =>
              `text-sm font-medium ${isActive ? 'text-indigo-600' : 'text-gray-600 hover:text-gray-900'}`
            }
          >
            Ürünler
          </NavLink>
          <NavLink
            to="/cart"
            className={({ isActive }) =>
              `text-sm font-medium ${isActive ? 'text-indigo-600' : 'text-gray-600 hover:text-gray-900'}`
            }
          >
            Sepet
          </NavLink>
          <NavLink
            to="/orders"
            className={({ isActive }) =>
              `text-sm font-medium ${isActive ? 'text-indigo-600' : 'text-gray-600 hover:text-gray-900'}`
            }
          >
            Siparişlerim
          </NavLink>
          <button
            onClick={logout}
            className="text-sm text-red-500 hover:text-red-700 font-medium"
          >
            Çıkış
          </button>
        </div>
      </nav>
      {/* pb-60: log paneli içeriğin üstüne gelmesin */}
      <main className="max-w-5xl mx-auto px-6 py-8 pb-60">
        <Outlet />
      </main>
      <LogPanel />
    </div>
  )
}
