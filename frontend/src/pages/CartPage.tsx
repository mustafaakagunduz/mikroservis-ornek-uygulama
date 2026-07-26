import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createOrder } from '../lib/api'
import { getProductImage } from '../lib/productImages'

type CartItem = { product_id: string; quantity: number; name: string; price: number }

function getCart(): CartItem[] {
  return JSON.parse(localStorage.getItem('cart') || '[]')
}

function clearCart() {
  localStorage.removeItem('cart')
}

export default function CartPage() {
  const navigate = useNavigate()
  const [cart, setCart] = useState<CartItem[]>(getCart)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const total = cart.reduce((sum, i) => sum + i.price * i.quantity, 0)

  function remove(product_id: string) {
    const updated = cart.filter((i) => i.product_id !== product_id)
    setCart(updated)
    localStorage.setItem('cart', JSON.stringify(updated))
  }

  async function handleOrder() {
    if (cart.length === 0) return
    setLoading(true)
    setError('')
    try {
      await createOrder(cart.map((i) => ({ product_id: i.product_id, quantity: i.quantity })))
      clearCart()
      setCart([])
      navigate('/orders')
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Sipariş oluşturulamadı')
    } finally {
      setLoading(false)
    }
  }

  if (cart.length === 0) {
    return (
      <div className="text-center py-24 bg-white rounded-2xl border border-slate-200">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-4 text-2xl">
          🛒
        </div>
        <p className="text-lg font-semibold text-slate-700">Sepetiniz boş</p>
        <p className="text-sm text-slate-400 mt-1">Ürünler sayfasından sepetine ekleme yapabilirsin.</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-extrabold text-slate-900 mb-6 tracking-tight">Sepet</h1>
      <div className="bg-white border border-slate-200/80 rounded-2xl divide-y divide-slate-100 shadow-card overflow-hidden">
        {cart.map((item) => (
          <div key={item.product_id} className="flex items-center gap-4 px-5 py-4">
            <img
              src={getProductImage(item.name)}
              alt={item.name}
              className="w-14 h-14 rounded-xl object-cover bg-slate-50 shrink-0"
            />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-900 truncate">{item.name}</p>
              <p className="text-sm text-slate-500">
                {item.quantity} × {item.price.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
              </p>
            </div>
            <div className="flex items-center gap-4 shrink-0">
              <span className="font-bold text-slate-900">
                {(item.price * item.quantity).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
              </span>
              <button
                onClick={() => remove(item.product_id)}
                className="text-slate-400 hover:text-red-600 text-sm font-medium transition-colors"
              >
                Kaldır
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-5 bg-white border border-slate-200/80 rounded-2xl p-5 shadow-card flex items-center justify-between">
        <span className="text-lg font-bold text-slate-900">
          Toplam: {total.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
        </span>
        <button
          onClick={handleOrder}
          disabled={loading}
          className="bg-slate-900 text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-brand-700 disabled:opacity-50 transition-colors"
        >
          {loading ? 'İşleniyor...' : 'Sipariş Ver'}
        </button>
      </div>
      {error && <p className="mt-2 text-red-500 text-sm">{error}</p>}
    </div>
  )
}
