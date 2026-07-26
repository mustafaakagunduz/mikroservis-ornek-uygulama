import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getOrders, cancelOrder } from '../lib/api'

type Order = {
  id: string
  items: { name: string; quantity: number; unit_price: number }[]
  total_price: number
  status: string
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  confirmed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
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

  if (isLoading) return <p className="text-gray-500">Yükleniyor...</p>

  if (!data || data.length === 0) {
    return (
      <div className="text-center py-16 text-gray-500">
        <p className="text-lg">Henüz siparişin yok</p>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Siparişlerim</h1>
      <div className="space-y-4">
        {data.map((order) => (
          <div
            key={order.id}
            className="bg-white border border-gray-200 rounded-xl p-5"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-gray-400 font-mono">{order.id}</span>
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  statusColors[order.status] || 'bg-gray-100 text-gray-600'
                }`}
              >
                {order.status}
              </span>
            </div>
            <ul className="space-y-1 mb-3">
              {order.items.map((item, i) => (
                <li key={i} className="text-sm text-gray-700">
                  {item.name} × {item.quantity} —{' '}
                  <span className="font-medium">{(item.unit_price * item.quantity).toFixed(2)} ₺</span>
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between">
              <span className="font-bold text-gray-900">
                Toplam: {order.total_price.toFixed(2)} ₺
              </span>
              {order.status === 'pending' && (
                <button
                  onClick={() => cancel.mutate(order.id)}
                  disabled={cancel.isPending}
                  className="text-sm text-red-500 hover:text-red-700 font-medium"
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
