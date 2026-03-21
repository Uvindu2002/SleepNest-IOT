import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSensor } from '../../context/SensorContext'
import { fmtDateTime } from '../../utils/format'

// ── Per-event styling ────────────────────────────────────────────
const META = {
  CRYING:         { icon: '😭', dot: 'bg-red-400',    pill: 'bg-red-100    text-red-600    dark:bg-red-900/30    dark:text-red-400'    },
  RESTLESS:       { icon: '😟', dot: 'bg-yellow-400', pill: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  LIGHT_ACTIVITY: { icon: '🌙', dot: 'bg-teal-400',   pill: 'bg-teal-100   text-teal-700   dark:bg-teal-900/30   dark:text-teal-400'   },
}
const DEFAULT_META = { icon: '🔔', dot: 'bg-gray-300', pill: 'bg-gray-100 text-gray-600' }

export default function Topbar() {
  const { dark, toggleDark, alertLog, setAlertLog } = useSensor()
  const navigate  = useNavigate()

  // ── Notification state ───────────────────────────────────────
  const [open,      setOpen]      = useState(false)
  const [seenCount, setSeenCount] = useState(0)   // how many alerts were read last time panel opened
  const panelRef  = useRef(null)
  const bellRef   = useRef(null)

  // unread = alerts that arrived since panel was last opened
  const unread = Math.max(0, alertLog.length - seenCount)

  // Open / close the panel
  function togglePanel() {
    if (!open) {
      // Mark all current alerts as "seen"
      setSeenCount(alertLog.length)
    }
    setOpen(v => !v)
  }

  // Close on outside click
  useEffect(() => {
    function handler(e) {
      if (
        panelRef.current && !panelRef.current.contains(e.target) &&
        bellRef.current  && !bellRef.current.contains(e.target)
      ) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handler)
    return ()  => document.removeEventListener('mousedown', handler)
  }, [open])

  // Close on Escape
  useEffect(() => {
    function handler(e) { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  // Update seenCount if alertLog shrinks (e.g. cleared)
  useEffect(() => {
    if (alertLog.length < seenCount) setSeenCount(alertLog.length)
  }, [alertLog.length])

  const recent = [...alertLog].reverse().slice(0, 20) // newest first, max 20

  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 px-6 py-4 bg-white dark:bg-[#0D0F1A] border-b border-nest-border dark:border-[#2A2E4A] shadow-[0_1px_4px_rgba(0,0,0,0.06)] dark:shadow-none transition-colors">
      <h1 className="flex-1 text-lg font-bold tracking-tight text-gray-800 dark:text-gray-100">
        Room Comfort Dashboard
      </h1>

      {/* Dark mode toggle */}
      <button
        onClick={toggleDark}
        className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
          dark ? 'bg-accent' : 'bg-[#C2CEDC]'
        }`}
        title="Toggle dark mode"
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-300 ${
            dark ? 'translate-x-5' : ''
          }`}
        />
      </button>

      {/* User pill */}
      <div className="flex items-center gap-2 bg-white dark:bg-[#1E2236] border border-nest-border dark:border-[#2A2E4A] rounded-full py-1.5 pl-1.5 pr-4 transition-colors">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-400 to-pink-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
          S
        </div>
        <div className="leading-tight">
          <div className="text-xs font-semibold text-gray-800 dark:text-gray-100">Sara Samy</div>
          <div className="text-[10px] text-accent">● Online</div>
        </div>
      </div>

      {/* ── Notification bell + dropdown ─────────────────────── */}
      <div className="relative flex-shrink-0">
        {/* Bell button */}
        <button
          ref={bellRef}
          onClick={togglePanel}
          className={`relative w-9 h-9 rounded-full border flex items-center justify-center text-base transition-all ${
            open
              ? 'bg-nest-bg border-accent shadow-sm'
              : 'bg-white dark:bg-[#1E2236] border-nest-border dark:border-[#2A2E4A] hover:border-accent'
          }`}
          title="Notifications"
        >
          🔔
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[9px] rounded-full flex items-center justify-center font-bold leading-none">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </button>

        {/* ── Dropdown panel ──────────────────────────────────── */}
        {open && (
          <div
            ref={panelRef}
            className="absolute right-0 top-[calc(100%+10px)] w-[340px] bg-white dark:bg-[#1E2236] border border-nest-border dark:border-[#2A2E4A] rounded-2xl shadow-xl overflow-hidden z-50"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-nest-border dark:border-[#2A2E4A] bg-nest-bg dark:bg-[#161928]">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-gray-800 dark:text-gray-100">Alerts</span>
                {alertLog.length > 0 && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-[#2A2E4A] text-gray-500 dark:text-gray-400">
                    {alertLog.length} total
                  </span>
                )}
              </div>
              {alertLog.length > 0 && (
                <button
                  onClick={() => { setAlertLog([]); setSeenCount(0) }}
                  className="text-[11px] text-gray-400 hover:text-red-500 transition-colors font-medium"
                >
                  Clear all
                </button>
              )}
            </div>

            {/* Alert list */}
            <div className="max-h-[360px] overflow-y-auto">
              {recent.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2">
                  <span className="text-3xl">🔕</span>
                  <p className="text-xs text-gray-400">No alerts yet. Baby is calm!</p>
                </div>
              ) : (
                recent.map((a, idx) => {
                  const m = META[a.event] || DEFAULT_META
                  const isNew = idx < unread // first N items are unread
                  return (
                    <div
                      key={a.id ?? idx}
                      className={`flex items-start gap-3 px-4 py-3 border-b border-nest-border/60 dark:border-[#2A2E4A]/60 last:border-0 transition-colors ${
                        isNew
                          ? 'bg-blue-50/60 dark:bg-[#1A1E35]'
                          : 'hover:bg-nest-bg dark:hover:bg-[#161928]'
                      }`}
                    >
                      {/* Event icon */}
                      <span className="text-xl flex-shrink-0 mt-0.5">{m.icon}</span>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${m.pill}`}>
                            {a.event?.replace('_', ' ')}
                          </span>
                          {isNew && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                              NEW
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 leading-snug">
                          Sound level <strong className="text-gray-700 dark:text-gray-200">{a.db} dB</strong>
                          {a.level != null && (
                            <span className="ml-1 text-gray-400">· raw {a.level}</span>
                          )}
                        </div>
                        <div className="text-[10px] text-gray-400 mt-0.5">
                          {fmtDateTime(a.ts)}
                        </div>
                      </div>

                      {/* Colored dot */}
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${m.dot}`} />
                    </div>
                  )
                })
              )}
            </div>

            {/* Footer — View all */}
            {alertLog.length > 0 && (
              <div className="px-4 py-2.5 border-t border-nest-border dark:border-[#2A2E4A] bg-nest-bg dark:bg-[#161928]">
                <button
                  onClick={() => { setOpen(false); navigate('/alerts') }}
                  className="w-full text-center text-xs font-semibold text-accent hover:underline transition-colors"
                >
                  View all {alertLog.length} alerts →
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  )
}
