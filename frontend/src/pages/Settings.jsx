import { useState, useEffect } from 'react'
import { useSensor } from '../context/SensorContext'

function Card({ title, children }) {
  return (
    <div className="bg-white dark:bg-[#1E2236] rounded-2xl border border-nest-border dark:border-[#2A2E4A] p-5 shadow-sm">
      <div className="text-sm font-bold text-gray-800 dark:text-gray-100 mb-4 pb-3 border-b border-nest-border dark:border-[#2A2E4A]">
        {title}
      </div>
      {children}
    </div>
  )
}

function Row({ label, children }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-nest-border dark:border-[#2A2E4A] last:border-0">
      <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
      {children}
    </div>
  )
}

function Btn({ children, onClick, cls = '' }) {
  return (
    <button
      onClick={onClick}
      className={`w-full mt-2 py-2.5 px-4 rounded-xl text-xs font-semibold transition-colors ${cls || 'bg-accent text-white hover:brightness-110'}`}
    >
      {children}
    </button>
  )
}

export default function Settings() {
  const { device, motionThreshold, setMotionThreshold } = useSensor()
  const [sensitivity, setSensitivity] = useState(5)
  const [toast, setToast] = useState(null)
  const [thresholds, setThresholds] = useState({
    quiet: 70, lightActivity: 110, restless: 250, crying: 400,
  })

  // Load current thresholds from server on mount
  useEffect(() => {
    fetch('/api/settings/thresholds')
      .then(r => r.json())
      .then(t => setThresholds({
        quiet:         t.QUIET          ?? 100,
        lightActivity: t.LIGHT_ACTIVITY ?? 250,
        restless:      t.RESTLESS       ?? 450,
        crying:        t.CRYING         ?? 600,
      }))
      .catch(() => {})
  }, [])

  const showToast = (msg, type = 'ok') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  async function sendCommand(command, extra = {}) {
    if (!device?.deviceId) return showToast('No device connected', 'err')
    try {
      const res = await fetch(`/api/devices/${device.deviceId}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command, ...extra }),
      })
      if (!res.ok) throw new Error()
      showToast(`✅ Command "${command}" sent`)
    } catch {
      showToast('❌ Failed — device may be offline', 'err')
    }
  }

  return (
    <div className="flex flex-col">
      <div className="text-base font-bold text-gray-800 dark:text-gray-100 mb-4 flex-shrink-0">⚙️ Settings</div>

      <div className="grid grid-cols-2 gap-4 max-w-3xl">

        {/* Sound Thresholds */}
        <Card title="Sound Thresholds (ESP32 scale 0–1023)">
          <div className="text-[10px] text-gray-400 mb-3 leading-relaxed">
            Ambient noise floor is ~50–80. Set <span className="font-semibold">Quiet</span> above your room's idle level.
          </div>
          {[
            { label: '🟢 Quiet below',          key: 'quiet',         color: 'text-green-500'  },
            { label: '🟡 Light Activity below',  key: 'lightActivity', color: 'text-yellow-500' },
            { label: '🟠 Restless below',        key: 'restless',      color: 'text-orange-500' },
            { label: '🔴 Crying from',           key: 'crying',        color: 'text-red-500'    },
          ].map(({ label, key, color }) => (
            <Row key={key} label={<span className={`text-xs font-semibold ${color}`}>{label}</span>}>
              <input
                type="number" min={1} max={1023}
                value={thresholds[key]}
                onChange={e => setThresholds(prev => ({ ...prev, [key]: Number(e.target.value) }))}
                className="w-20 text-center text-xs py-1.5 px-2 rounded-lg border border-nest-border dark:border-[#2A2E4A] bg-nest-bg dark:bg-[#161928] text-gray-800 dark:text-gray-100 focus:outline-none focus:border-accent"
              />
            </Row>
          ))}
          <Btn onClick={async () => {
            try {
              const res = await fetch('/api/settings/thresholds', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(thresholds),
              })
              if (!res.ok) throw new Error()
              showToast('✅ Thresholds applied live — no restart needed')
            } catch {
              showToast('❌ Failed to apply thresholds', 'err')
            }
          }}>
            Apply Thresholds
          </Btn>
        </Card>

        {/* Sensitivity */}
        <Card title="Sensor Sensitivity">
          <Row label={`Sensitivity: ${sensitivity}`}>
            <input
              type="range" min={1} max={20} value={sensitivity}
              onChange={e => setSensitivity(+e.target.value)}
              className="w-36 accent-[#3B9E72]"
            />
          </Row>
          <div className="flex gap-2 mt-3">
            <Btn onClick={() => sendCommand('set_sensitivity', { value: sensitivity })}>
              Send to Device
            </Btn>
            <Btn onClick={() => sendCommand('recalibrate_sound')} cls="bg-nest-bg dark:bg-[#161928] text-accent border border-accent text-xs font-semibold hover:bg-nest-green transition-colors py-2.5 px-4 rounded-xl">
              Calibrate Sensor
            </Btn>
          </div>
        </Card>

        {/* Motion Threshold */}
        <Card title="Motion Threshold">
          <Row label={`Alert after: ${Math.round(motionThreshold / 1000)}s of motion`}>
            <input
              type="range" min={5000} max={60000} step={1000}
              value={motionThreshold}
              onChange={e => setMotionThreshold(+e.target.value)}
              className="w-36 accent-[#3B9E72]"
            />
          </Row>
          <div className="mt-3 text-[11px] text-gray-400 leading-relaxed">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-orange-400 inline-block" />
              Motion active → comfort <span className="font-semibold text-orange-400">–5 pts</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
              Sustained ≥ {Math.round(motionThreshold / 1000)}s → comfort{' '}
              <span className="font-semibold text-red-500">–25 pts</span>
            </div>
          </div>
        </Card>

        {/* Comfort weights */}
        <Card title="Comfort Scoring Weights">
          {[
            { label: 'Temperature weight', val: '35%' },
            { label: 'Humidity weight',    val: '25%' },
            { label: 'Sound weight',       val: '40%' },
            { label: 'Ideal Temperature',  val: '20 °C' },
            { label: 'Ideal Humidity',     val: '50 %' },
          ].map(({ label, val }) => (
            <Row key={label} label={label}>
              <span className="text-xs font-bold text-accent">{val}</span>
            </Row>
          ))}
        </Card>

        {/* Device commands */}
        <Card title="Device Commands">
          <div className="flex flex-col gap-2">
            <Btn onClick={() => sendCommand('status')}>Request Status</Btn>
            <Btn
              onClick={() => sendCommand('recalibrate_sound')}
              cls="bg-nest-bg dark:bg-[#161928] text-accent border border-accent text-xs font-semibold hover:bg-nest-green transition-colors py-2.5 px-4 rounded-xl"
            >
              Recalibrate Sound
            </Btn>
            <Btn
              onClick={() => sendCommand('reset_motion')}
              cls="bg-nest-bg dark:bg-[#161928] text-accent border border-accent text-xs font-semibold hover:bg-nest-green transition-colors py-2.5 px-4 rounded-xl"
            >
              Reset Motion Count
            </Btn>
            <Btn
              onClick={() => {
                if (window.confirm('Restart the ESP32 device?'))
                  sendCommand('restart')
              }}
              cls="bg-red-500 text-white text-xs font-semibold hover:bg-red-600 transition-colors py-2.5 px-4 rounded-xl"
            >
              Restart Device
            </Btn>
          </div>
        </Card>

      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-semibold border transition-all ${
            toast.type === 'err'
              ? 'bg-white dark:bg-[#1E2236] border-red-300 text-red-500'
              : 'bg-white dark:bg-[#1E2236] border-accent text-accent'
          }`}
        >
          {toast.msg}
        </div>
      )}
    </div>
  )
}
