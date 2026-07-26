import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getProducts } from '../lib/api'
import { getProductImage } from '../lib/productImages'

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
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [toast, setToast] = useState<string | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['products'],
    queryFn: () => getProducts().then((r) => r.data as Product[]),
  })

  const categories = useMemo(() => {
    if (!data) return []
    return Array.from(new Set(data.map((p) => p.category).filter(Boolean))) as string[]
  }, [data])

  const filtered = useMemo(() => {
    if (!data) return []
    return activeCategory === 'all' ? data : data.filter((p) => p.category === activeCategory)
  }, [data, activeCategory])

  function handleAdd(p: Product) {
    addToCart(p)
    setToast(`"${p.name}" sepete eklendi`)
    window.setTimeout(() => setToast(null), 2200)
  }

  return (
    <div>
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-700 via-brand-600 to-brand-500 px-8 py-12 sm:px-12 sm:py-16 mb-10 shadow-card-hover">
        <div className="absolute -top-16 -right-16 w-72 h-72 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-24 -left-10 w-72 h-72 rounded-full bg-brand-900/30 blur-3xl" />
        <div className="relative max-w-xl">
          <span className="inline-block text-xs font-bold tracking-wider uppercase text-brand-100 bg-white/10 px-3 py-1 rounded-full mb-4">
            Yeni sezon fırsatları
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
            Teknoloji ihtiyaçların<br />tek adreste.
          </h1>
          <p className="mt-3 text-brand-100 text-sm sm:text-base max-w-md">
            Seçkin elektronik ve aksesuar ürünlerini keşfet, sepetine ekle, siparişini anında oluştur.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-slate-900">Tüm Ürünler</h2>
        {categories.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveCategory('all')}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${
                activeCategory === 'all'
                  ? 'bg-brand-600 text-white'
                  : 'bg-white text-slate-500 border border-slate-200 hover:border-brand-300 hover:text-brand-600'
              }`}
            >
              Tümü
            </button>
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setActiveCategory(c)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${
                  activeCategory === c
                    ? 'bg-brand-600 text-white'
                    : 'bg-white text-slate-500 border border-slate-200 hover:border-brand-300 hover:text-brand-600'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        )}
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl h-80 animate-pulse border border-slate-100" />
          ))}
        </div>
      )}

      {error && <p className="text-red-500">Ürünler yüklenemedi</p>}

      {!isLoading && !error && (!data || data.length === 0) && (
        <div className="text-center py-20 text-slate-500 bg-white rounded-2xl border border-slate-200">
          <p className="text-lg font-medium text-slate-700">Henüz ürün yok.</p>
          <p className="text-sm mt-1">
            <a
              href="http://localhost:8002/docs"
              target="_blank"
              rel="noreferrer"
              className="text-brand-600 hover:underline"
            >
              Product Service Swagger
            </a>{' '}
            üzerinden ürün ekleyebilirsin.
          </p>
        </div>
      )}

      {!isLoading && !error && data && data.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
          {filtered.map((p) => (
            <div
              key={p.id}
              className="group bg-white border border-slate-200/80 rounded-2xl overflow-hidden flex flex-col shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200"
            >
              <div className="relative aspect-[4/3] bg-slate-50 overflow-hidden">
                <img
                  src={getProductImage(p.name, p.category)}
                  alt={p.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                {p.stock === 0 && (
                  <span className="absolute top-3 left-3 text-[11px] font-bold px-2 py-1 rounded-full bg-slate-900/80 text-white">
                    Tükendi
                  </span>
                )}
                {p.stock > 0 && p.stock <= 10 && (
                  <span className="absolute top-3 left-3 text-[11px] font-bold px-2 py-1 rounded-full bg-amber-500 text-white">
                    Son {p.stock} adet
                  </span>
                )}
              </div>

              <div className="p-5 flex flex-col flex-1">
                {p.category && (
                  <span className="text-[11px] font-semibold text-brand-600 bg-brand-50 self-start px-2 py-0.5 rounded-full">
                    {p.category}
                  </span>
                )}
                <h3 className="mt-2 text-base font-bold text-slate-900 leading-snug">{p.name}</h3>

                <div className="mt-auto pt-4 flex items-end justify-between">
                  <span className="text-2xl font-extrabold text-slate-900">
                    {p.price.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                    <span className="text-base font-bold text-slate-400 ml-1">₺</span>
                  </span>
                </div>

                <button
                  onClick={() => handleAdd(p)}
                  disabled={p.stock === 0}
                  className="mt-4 bg-slate-900 text-white text-sm py-2.5 rounded-xl font-semibold hover:bg-brand-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  Sepete Ekle
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-card-hover animate-[fade-in_0.15s_ease-out]">
          ✓ {toast}
        </div>
      )}
    </div>
  )
}
