import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createOrder } from '../lib/api'

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
      <div className="text-center py-16 text-gray-500">
        <p className="text-lg">Sepetiniz boş</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Sepet</h1>
      <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
        {cart.map((item) => (
          <div key={item.product_id} className="flex items-center justify-between px-5 py-4">
            <div>
              <p className="font-medium text-gray-900">{item.name}</p>
              <p className="text-sm text-gray-500">
                {item.quantity} × {item.price.toFixed(2)} ₺
              </p>
            </div>
            <div className="flex items-center gap-4">
              <span className="font-semibold text-gray-900">
                {(item.price * item.quantity).toFixed(2)} ₺
              </span>
              <button
                onClick={() => remove(item.product_id)}
                className="text-red-400 hover:text-red-600 text-sm"
              >
                Kaldır
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between">
        <span className="text-lg font-bold text-gray-900">Toplam: {total.toFixed(2)} ₺</span>
        <button
          onClick={handleOrder}
          disabled={loading}
          className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {loading ? 'İşleniyor...' : 'Sipariş Ver'}
        </button>
      </div>
      {error && <p className="mt-2 text-red-500 text-sm">{error}</p>}
    </div>
  )
}
