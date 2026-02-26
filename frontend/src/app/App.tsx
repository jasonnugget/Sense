import { Routes, Route } from 'react-router-dom'
import TopBar from '../components/TopBar'
import ActivityPanel from '../components/ActivityPanel'
import Dashboard from '../pages/Dashboard'
import CameraPage from '../pages/CameraPage'
import './App.css'

export default function App() {
  return (
    <div className="appContainer">
      <TopBar />

      <Routes>
        <Route
          path="/"
          element={
            <div className="mainLayout">
              <ActivityPanel />
              <Dashboard />
            </div>
          }
        />

        <Route path="/camera/:cameraId" element={<CameraPage />} />
      </Routes>
    </div>
  )
}