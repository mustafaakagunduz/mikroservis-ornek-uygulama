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

  if (!open) {
    return (
      <div className="shrink-0 h-full w-12 border-l border-gray-700 bg-gray-950 flex flex-col items-center py-4 gap-3">
        <button
          onClick={() => setOpen(true)}
          className="text-gray-500 hover:text-gray-300 transition-colors text-sm"
          title="Live Logs panelini aç"
        >
          ◀
        </button>
        <div className="flex gap-1">
          <span className="w-2 h-2 rounded-full bg-red-500" />
          <span className="w-2 h-2 rounded-full bg-yellow-500" />
          <span className="w-2 h-2 rounded-full bg-green-500" />
        </div>
        <span className="text-[10px] font-mono text-gray-500 tracking-wider [writing-mode:vertical-rl] rotate-180">
          LIVE LOGS
        </span>
        <span className="text-[10px] font-mono text-gray-600 bg-gray-800 rounded-full px-1.5 py-0.5">
          {logs.length}
        </span>
      </div>
    )
  }

  return (
    <div className="shrink-0 h-full w-[26rem] max-w-[90vw] border-l border-gray-700 bg-gray-950 shadow-2xl flex flex-col">
      {/* Başlık çubuğu */}
      <div className="px-4 py-2.5 bg-gray-900 border-b border-gray-700 flex flex-col gap-2 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
              <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
            </div>
            <span className="text-xs font-mono text-gray-400 font-semibold tracking-wider">
              LIVE LOGS
            </span>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="text-xs text-gray-500 hover:text-gray-300 px-1 transition-colors"
            title="Paneli daralt"
          >
            ▶
          </button>
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-gray-600 font-mono">({logs.length} kayıt)</span>
          <button
            onClick={() => setLogs([])}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            Temizle
          </button>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="flex-1 min-w-0 text-xs bg-gray-800 text-gray-300 border border-gray-700 rounded px-2 py-1 focus:outline-none"
          >
            {services.map((s) => (
              <option key={s} value={s}>{s === 'all' ? 'Tüm servisler' : s}</option>
            ))}
          </select>

          <label className="flex items-center gap-1 text-xs text-gray-400 cursor-pointer select-none shrink-0">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="accent-indigo-500"
            />
            Kaydır
          </label>
        </div>
      </div>

      {/* Log listesi */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0 overflow-y-auto font-mono text-xs px-3 py-2 space-y-2"
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
          <div key={i} className="leading-5 border-b border-gray-900 pb-1.5">
            <div className="flex items-center gap-2 text-[11px]">
              <span className="text-gray-600 shrink-0">{entry.ts}</span>
              <span className={`truncate ${SERVICE_COLORS[entry.service] ?? 'text-gray-400'}`}>
                {entry.service}
              </span>
              <span className="text-gray-700 shrink-0">·</span>
              <span className="text-gray-600 truncate">{entry.event}</span>
            </div>
            <div className={`mt-0.5 ${LEVEL_STYLES[entry.level] ?? 'text-gray-300'}`}>
              {entry.message}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
