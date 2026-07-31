import { Routes, Route, Navigate } from 'react-router-dom';
import Catalogue from './pages/Catalogue.jsx';
import Enroll from './pages/Enroll.jsx';
import Verify from './pages/Verify.jsx';
import Login from './pages/Login.jsx';
import AuthCallback from './pages/AuthCallback.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Courses from './pages/Courses.jsx';
import Users from './pages/Users.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/catalogue" element={<Catalogue />} />
      <Route path="/inscription" element={<Enroll />} />
      <Route path="/verifier" element={<Verify />} />
      <Route path="/verifier/:numero" element={<Verify />} />

      {/* Staff */}
      <Route path="/login" element={<Login />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'TRAINER']}>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/formations"
        element={
          <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN']}>
            <Courses />
          </ProtectedRoute>
        }
      />
      <Route
        path="/users"
        element={
          <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
            <Users />
          </ProtectedRoute>
        }
      />

      <Route path="/" element={<Navigate to="/catalogue" replace />} />
      <Route path="*" element={<Navigate to="/catalogue" replace />} />
    </Routes>
  );
}
