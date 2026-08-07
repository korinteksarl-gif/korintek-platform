import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login.jsx';
import AuthCallback from './pages/AuthCallback.jsx';
import Pending from './pages/Pending.jsx';
import Journal from './pages/Journal.jsx';
import Accounts from './pages/Accounts.jsx';
import Reports from './pages/Reports.jsx';
import Users from './pages/Users.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/pending" element={<Pending />} />
      <Route
        path="/journal"
        element={
          <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN', 'COMPTABLE']}>
            <Journal />
          </ProtectedRoute>
        }
      />
      <Route
        path="/comptes"
        element={
          <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN']}>
            <Accounts />
          </ProtectedRoute>
        }
      />
      <Route
        path="/rapports"
        element={
          <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN', 'COMPTABLE']}>
            <Reports />
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
      <Route path="/" element={<Navigate to="/journal" replace />} />
      <Route path="*" element={<Navigate to="/journal" replace />} />
    </Routes>
  );
}
