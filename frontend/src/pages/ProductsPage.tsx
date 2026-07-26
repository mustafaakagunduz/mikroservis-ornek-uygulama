import { useQuery } from '@tanstack/react-query'
import { getProducts } from '../lib/api'

type Product = {
  id: string
  name: string
  price: number
  stock: number
  category: string | null
}

type CartItem = { product_id: string; quantity: number; name: string; price: number }

function getCart(): CartItem[] {
  return JSON.parse(localStorage.getItem('cart') || '[]')
}

function addToCart(product: Product) {
  const cart = getCart()
  const existing = cart.find((i) => i.product_id === product.id)
  if (existing) {
    existing.quantity += 1
  } else {
    cart.push({ product_id: product.id, quantity: 1, name: product.name, price: product.price })
  }
  localStorage.setItem('cart', JSON.stringify(cart))
}

export default function ProductsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['products'],
    queryFn: () => getProducts().then((r) => r.data as Product[]),
  })

  if (isLoading) return <p className="text-gray-500">Yükleniyor...</p>
  if (error) return <p className="text-red-500">Ürünler yüklenemedi</p>

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Ürünler</h1>
      {(!data || data.length === 0) ? (
        <div className="text-center py-16 text-gray-500">
          <p className="text-lg">Henüz ürün yok.</p>
          <p className="text-sm mt-1">
            <a
              href="http://localhost:8002/docs"
              target="_blank"
              rel="noreferrer"
              className="text-indigo-500 hover:underline"
            >
              Product Service Swagger
            </a>{' '}
            üzerinden ürün ekleyebilirsin.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.map((p) => (
            <div
              key={p.id}
              className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col justify-between hover:shadow-md transition-shadow"
            >
              <div>
                {p.category && (
                  <span className="text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                    {p.category}
                  </span>
                )}
                <h2 className="mt-2 text-base font-semibold text-gray-900">{p.name}</h2>
                <p className="text-2xl font-bold text-indigo-600 mt-1">
                  {p.price.toFixed(2)} ₺
                </p>
                <p className="text-xs text-gray-400 mt-1">Stok: {p.stock}</p>
              </div>
              <button
                onClick={() => {
                  addToCart(p)
                  alert(`"${p.name}" sepete eklendi`)
                }}
                disabled={p.stock === 0}
                className="mt-4 bg-indigo-600 text-white text-sm py-2 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Sepete Ekle
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
