import { useSensor } from '../context/SensorContext'
import StatusCard     from '../components/overview/StatusCard'
import SleepNestDonut from '../components/overview/SleepNestDonut'
import CurrentState   from '../components/overview/CurrentState'
import TrendChart     from '../components/overview/TrendChart'
import Timeline       from '../components/overview/Timeline'
import Insights       from '../components/overview/Insights'

export default function Overview() {
  return (
    <div
      className="grid gap-3"
      style={{
        gridTemplateColumns: '1fr 200px 1fr',
        gridTemplateAreas: `
          "left   center   curstate"
          "trend  trend    rightbot"
        `,
      }}
    >
      {/* ── Top-left: Status Card ─────────────────── */}
      <StatusCard style={{ gridArea: 'left' }} />

      {/* ── Top-center: Sleep Nest Donut ───────────── */}
      <SleepNestDonut style={{ gridArea: 'center' }} />

      {/* ── Top-right: Current State ───────────────── */}
      <CurrentState style={{ gridArea: 'curstate' }} />

      {/* ── Bottom-left: Trend Chart ───────────────── */}
      <TrendChart style={{ gridArea: 'trend' }} />

      {/* ── Bottom-right: Timeline + Insights ─────── */}
      <div style={{ gridArea: 'rightbot' }} className="flex flex-col gap-3">
        <Timeline />
        <Insights />
      </div>
    </div>
  )
}
