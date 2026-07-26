import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getOrders, cancelOrder } from '../lib/api'

type Order = {
  id: string
  items: { name: string; quantity: number; unit_price: number }[]
  total_price: number
  status: string
}

const statusLabels: Record<string, string> = {
  pending: 'Beklemede',
  confirmed: 'Onaylandı',
  cancelled: 'İptal Edildi',
}

const statusColors: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  confirmed: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  cancelled: 'bg-red-50 text-red-700 ring-1 ring-red-200',
}

export default function OrdersPage() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['orders'],
    queryFn: () => getOrders().then((r) => r.data as Order[]),
  })

  const cancel = useMutation({
    mutationFn: cancelOrder,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orders'] }),
  })

  if (isLoading) return <p className="text-slate-500">Yükleniyor...</p>

  if (!data || data.length === 0) {
    return (
      <div className="text-center py-24 bg-white rounded-2xl border border-slate-200">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-4 text-2xl">
          📦
        </div>
        <p className="text-lg font-semibold text-slate-700">Henüz siparişin yok</p>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-extrabold text-slate-900 mb-6 tracking-tight">Siparişlerim</h1>
      <div className="space-y-4">
        {data.map((order) => (
          <div
            key={order.id}
            className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-card"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-slate-400 font-mono">#{order.id.slice(0, 8)}</span>
              <span
                className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                  statusColors[order.status] || 'bg-slate-100 text-slate-600'
                }`}
              >
                {statusLabels[order.status] || order.status}
              </span>
            </div>
            <ul className="space-y-1 mb-3 divide-y divide-slate-50">
              {order.items.map((item, i) => (
                <li key={i} className="text-sm text-slate-700 py-1 flex items-center justify-between">
                  <span>{item.name} × {item.quantity}</span>
                  <span className="font-semibold text-slate-900">
                    {(item.unit_price * item.quantity).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <span className="font-bold text-slate-900">
                Toplam: {order.total_price.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
              </span>
              {order.status === 'pending' && (
                <button
                  onClick={() => cancel.mutate(order.id)}
                  disabled={cancel.isPending}
                  className="text-sm text-slate-400 hover:text-red-600 font-semibold transition-colors"
                >
                  İptal Et
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
