import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { SensorProvider } from './context/SensorContext'
import Layout from './components/layout/Layout'
import Overview     from './pages/Overview'
import Monitoring   from './pages/Monitoring'
import Sleep        from './pages/Sleep'
import Alerts       from './pages/Alerts'
import History      from './pages/History'
import BabySitter   from './pages/BabySitterView'
import Settings     from './pages/Settings'

export default function App() {
  return (
    <SensorProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Navigate to="/babysitter" replace />} />
            <Route path="overview"    element={<Overview />} />
            <Route path="monitoring"  element={<Monitoring />} />
            <Route path="sleep"       element={<Sleep />} />
            <Route path="alerts"      element={<Alerts />} />
            <Route path="history"     element={<History />} />
            <Route path="babysitter"  element={<BabySitter />} />
            <Route path="settings"    element={<Settings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </SensorProvider>
  )
}
