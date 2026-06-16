import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Navigation from './components/Navigation'
import HomePage from './pages/HomePage'
import AnalyzePage from './pages/AnalyzePage'
import HistoryPage from './pages/HistoryPage'
import DashboardPage from './pages/DashboardPage'

const basename = import.meta.env.BASE_URL.replace(/\/$/, '')

function App() {
  return (
    <Router basename={basename || undefined}>
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/analyze" element={<AnalyzePage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
        </Routes>
      </div>
    </Router>
  )
}

export default App
