import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from '@/components/ProtectedRoute';
import AdminLayout from '@/components/AdminLayout';
import Landing from '@/pages/Landing';
import Order from '@/pages/Order';
import Track from '@/pages/Track';
import Privacy from '@/pages/Privacy';
import RoleGate from '@/components/RoleGate';
import Dashboard from '@/pages/Dashboard';
import POS from '@/pages/POS';
import Orders from '@/pages/Orders';
import Tables from '@/pages/Tables';
import Kitchen from '@/pages/Kitchen';
import MenuManagement from '@/pages/MenuManagement';
import Inventory from '@/pages/Inventory';
import Suppliers from '@/pages/Suppliers';
import Expenses from '@/pages/Expenses';
import Customers from '@/pages/Customers';
import Promotions from '@/pages/Promotions';
import Discounts from '@/pages/Discounts';
import Reports from '@/pages/Reports';
import CashierShifts from '@/pages/CashierShifts';
import Users from '@/pages/Users';
import AuditLogs from '@/pages/AuditLogs';
import Settings from '@/pages/Settings';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
// Add page imports here

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Render the main app
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      <Route path="/" element={<Landing />} />
      <Route path="/order" element={<Order />} />
      <Route path="/track" element={<Track />} />
      <Route path="/track/:id" element={<Track />} />
      <Route path="/privacy" element={<Privacy />} />

      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<RoleGate><Dashboard /></RoleGate>} />
          <Route path="pos" element={<POS />} />
          <Route path="orders" element={<Orders />} />
          <Route path="tables" element={<Tables />} />
          <Route path="kitchen" element={<Kitchen />} />
          <Route path="menu" element={<RoleGate><MenuManagement /></RoleGate>} />
          <Route path="inventory" element={<RoleGate><Inventory /></RoleGate>} />
          <Route path="suppliers" element={<RoleGate><Suppliers /></RoleGate>} />
          <Route path="expenses" element={<RoleGate><Expenses /></RoleGate>} />
          <Route path="customers" element={<Customers />} />
          <Route path="promotions" element={<RoleGate><Promotions /></RoleGate>} />
          <Route path="discounts" element={<RoleGate><Discounts /></RoleGate>} />
          <Route path="reports" element={<RoleGate><Reports /></RoleGate>} />
          <Route path="shifts" element={<CashierShifts />} />
          <Route path="users" element={<RoleGate><Users /></RoleGate>} />
          <Route path="audit" element={<RoleGate><AuditLogs /></RoleGate>} />
          <Route path="settings" element={<RoleGate><Settings /></RoleGate>} />
        </Route>
      </Route>

      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App