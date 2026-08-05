import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login.jsx';
import AuthCallback from './pages/AuthCallback.jsx';
import Pending from './pages/Pending.jsx';
import Pipeline from './pages/Pipeline.jsx';
import Users from './pages/Users.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/pending" element={<Pending />} />
      <Route
        path="/pipeline"
        element={
          <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN', 'SALES']}>
            <Pipeline />
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
      <Route path="/" element={<Navigate to="/pipeline" replace />} />
      <Route path="*" element={<Navigate to="/pipeline" replace />} />
    </Routes>
  );
}
