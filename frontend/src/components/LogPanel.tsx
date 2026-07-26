import { useEffect, useRef, useState } from 'react'

type LogEntry = {
  service: string
  level: string
  event: string
  message: string
  ts: string
}

// Her servis için renk
const SERVICE_COLORS: Record<string, string> = {
  'auth-service':         'text-blue-400',
  'product-service':      'text-green-400',
  'order-service':        'text-orange-400',
  'notification-service': 'text-purple-400',
  'inventory-service':    'text-cyan-400',
  'email-worker':         'text-pink-400',
  'system':               'text-gray-400',
}

// Her level için stil
const LEVEL_STYLES: Record<string, string> = {
  success: 'text-emerald-400 font-semibold',
  info:    'text-gray-300',
  warning: 'text-yellow-400',
  error:   'text-red-400 font-semibold',
}

const MAX_LOGS = 150

export default function LogPanel() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [open, setOpen] = useState(true)
  const [autoScroll, setAutoScroll] = useState(true)
  const [filter, setFilter] = useState<string>('all')
  const bottomRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // EventSource: browser built-in SSE client, otomatik reconnect yapar
    const es = new EventSource('/api/logs/stream')

    es.onmessage = (e) => {
      try {
        const entry: LogEntry = JSON.parse(e.data)
        setLogs((prev) => {
          const next = [...prev, entry]
          return next.length > MAX_LOGS ? next.slice(-MAX_LOGS) : next
        })
      } catch {
        // parse hatası sessizce geç
      }
    }

    es.onerror = () => {
      // EventSource bağlantı koptuğunda otomatik yeniden bağlanır
      // biz sadece bağlantı kopma logu ekleyelim
      setLogs((prev) => [
        ...prev,
        {
          service: 'system',
          level: 'warning',
          event: 'reconnecting',
          message: 'Bağlantı koptu, yeniden bağlanılıyor...',
          ts: new Date().toISOString().substring(11, 19),
        },
      ])
    }

    return () => es.close()
  }, [])

  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs, autoScroll])

  const services = ['all', ...Array.from(new Set(logs.map((l) => l.service)))]
  const filtered = filter === 'all' ? logs : logs.filter((l) => l.service === filter)

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-700 bg-gray-950 shadow-2xl">
      {/* Başlık çubuğu */}
      <div className="flex items-center justify-between px-4 py-1.5 bg-gray-900 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <div className="flex gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
            <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
          </div>
          <span className="text-xs font-mono text-gray-400 font-semibold tracking-wider">
            LIVE LOGS — Redis Pub/Sub → SSE
          </span>
          <span className="text-xs text-gray-600">({logs.length} kayıt)</span>
        </div>

        <div className="flex items-center gap-3">
          {/* Servis filtresi */}
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="text-xs bg-gray-800 text-gray-300 border border-gray-700 rounded px-2 py-0.5 focus:outline-none"
          >
            {services.map((s) => (
              <option key={s} value={s}>{s === 'all' ? 'Tüm servisler' : s}</option>
            ))}
          </select>

          <label className="flex items-center gap-1 text-xs text-gray-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="accent-indigo-500"
            />
            Otomatik kaydır
          </label>

          <button
            onClick={() => setLogs([])}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            Temizle
          </button>

          <button
            onClick={() => setOpen((o) => !o)}
            className="text-xs text-gray-500 hover:text-gray-300 px-2 transition-colors"
          >
            {open ? '▼' : '▲'}
          </button>
        </div>
      </div>

      {/* Log listesi */}
      {open && (
        <div
          ref={containerRef}
          className="h-52 overflow-y-auto font-mono text-xs px-3 py-2 space-y-0.5"
          onScroll={() => {
            const el = containerRef.current
            if (!el) return
            const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 30
            setAutoScroll(atBottom)
          }}
        >
          {filtered.length === 0 && (
            <p className="text-gray-600 pt-4 text-center">
              Servisler başlayınca loglar burada görünecek...
            </p>
          )}
          {filtered.map((entry, i) => (
            <div key={i} className="flex items-start gap-2 leading-5">
              <span className="text-gray-600 shrink-0 w-14">{entry.ts}</span>
              <span className={`shrink-0 w-36 truncate ${SERVICE_COLORS[entry.service] ?? 'text-gray-400'}`}>
                {entry.service}
              </span>
              <span className="text-gray-600 shrink-0 w-28 truncate">{entry.event}</span>
              <span className={`flex-1 ${LEVEL_STYLES[entry.level] ?? 'text-gray-300'}`}>
                {entry.message}
              </span>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  )
}
