import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './context/AuthContext'
import { SocketProvider } from './context/SocketContext'

// Pages
import LoginPage from './pages/LoginPage'
import SuperAdminDashboard from './pages/superadmin/Dashboard'
import BoothsPage from './pages/superadmin/BoothsPage'
import StudentsPage from './pages/superadmin/StudentsPage'
import CandidatesPage from './pages/superadmin/CandidatesPage'
import UsersPage from './pages/superadmin/UsersPage'
import ResultsPage from './pages/superadmin/ResultsPage'
import ElectionControlPage from './pages/superadmin/ElectionControlPage'
import BoothAdminPanel from './pages/boothadmin/BoothAdminPanel'
import VotingDevice from './pages/device/VotingDevice'
import DeviceSetup from './pages/device/DeviceSetup'
import SuperAdminLayout from './layouts/SuperAdminLayout'
import BoothAdminLayout from './layouts/BoothAdminLayout'
import PositionsPage from './pages/superadmin/PositionsPage'

// Protected route wrapper
const ProtectedRoute = ({ children, roles }) => {
  const { user, loading } = useAuth()
  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin w-10 h-10 border-2 border-primary-500 border-t-transparent rounded-full"/></div>
  if (!user) return <Navigate to="/login" replace />
  if (roles && !roles.includes(user.role)) return <Navigate to="/unauthorized" replace />
  return children
}

const AppRoutes = () => {
  const { user } = useAuth()

  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={user ? <Navigate to={user.role === 'super_admin' ? '/admin' : '/booth'} replace /> : <LoginPage />} />
      <Route path="/device" element={<DeviceSetup />} />
      <Route path="/device/:boothCode" element={<VotingDevice />} />

      {/* Super Admin */}
      <Route path="/admin" element={
        <ProtectedRoute roles={['super_admin']}>
          <SocketProvider><SuperAdminLayout /></SocketProvider>
        </ProtectedRoute>
      }>
        <Route index element={<SuperAdminDashboard />} />
        <Route path="booths" element={<BoothsPage />} />
        <Route path="students" element={<StudentsPage />} />
        <Route path="candidates" element={<CandidatesPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="positions" element={<PositionsPage />} />
        <Route path="results" element={<ResultsPage />} />
        <Route path="election" element={<ElectionControlPage />} />
      </Route>

      {/* Booth Admin */}
      <Route path="/booth" element={
        <ProtectedRoute roles={['booth_admin']}>
          <SocketProvider><BoothAdminLayout /></SocketProvider>
        </ProtectedRoute>
      }>
        <Route index element={<BoothAdminPanel />} />
      </Route>

      {/* Redirects */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/unauthorized" element={
        <div className="flex flex-col items-center justify-center min-h-screen gap-4">
          <h1 className="text-3xl font-bold text-red-400">Access Denied</h1>
          <p className="text-white/60">You don't have permission to view this page.</p>
          <a href="/login" className="btn-primary">Go to Login</a>
        </div>
      } />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AppRoutes />
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: 'rgba(15, 23, 42, 0.95)',
              color: '#f1f5f9',
              border: '1px solid rgba(255,255,255,0.1)',
              backdropFilter: 'blur(12px)',
              borderRadius: '12px',
            },
            success: { iconTheme: { primary: '#22c55e', secondary: '#fff' } },
            error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
          }}
        />
      </BrowserRouter>
    </AuthProvider>
  )
}
