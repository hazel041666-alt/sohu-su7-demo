import { Navigate, Route, Routes } from 'react-router-dom'
import DemoPage from './pages/DemoPage'
import MockReservationPage from './pages/MockReservationPage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<DemoPage />} />
      <Route path="/mock-reservation" element={<MockReservationPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
