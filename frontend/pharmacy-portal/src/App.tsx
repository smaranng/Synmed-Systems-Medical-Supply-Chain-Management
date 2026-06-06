
import { Routes, Route, Navigate } from 'react-router-dom';
import DashboardLayout from './components/DashboardLayout';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import SearchPage from "./pages/SearchDistributorInventory";
import DashboardPage from './pages/DashboardPage';
import InventoryPage from './pages/InventoryPage';
import ProcurementPage from './pages/ProcurementPage';
import ProcurementCheckoutConfirmation from './pages/ProcurementCheckoutConfirmation';
import OfflinePurchase from './pages/OfflinePurchase';
import OfflineCheckoutConfirmation from './pages/OfflineCheckoutConfirmation';
import OfflineOrderConfirmation from './pages/OfflineOrderConfirmation';
import ICNPage from './pages/ICNPage';
import OrdersPage from './pages/OrdersPage';
import MyOrders from './pages/MyOrders';
import SettingsPage from './pages/SettingsPage';
import { useAuth } from './hooks/useAuth';
import CartPage from './pages/CartPage';
import Distributors from './pages/Distributors';
import DeliveredOrderInventoryUpdate from './pages/InventoryUpdation';

function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { isAuthenticated, isLoading } = useAuth();

  // ⛔ wait for auth restoration
  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return isAuthenticated ? children : <Navigate to="/login" replace />;
}


function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/login" element={<LoginPage />} />

      {/* Protected Dashboard */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="inventory" element={<InventoryPage />} />
        <Route path="procurement" element={<ProcurementPage />} />
        {/* <Route path="procurement/setup" element={<ProcurementSetupPage />} /> */}
        {/* ICN CHNAGED */}
        <Route path="icn/:pharmaID?" element={<ICNPage />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="distributor" element={<Distributors />} />
        <Route path="distributor/:distributorID/search" element={<SearchPage />} />
        <Route path="order" element={<MyOrders />} />
        <Route path="settings" element={<SettingsPage />} />
        {/* ✅ param name matches useParams({ pharmaID }) in OfflinePurchase */}
        <Route path="offline-orders/:pharmaID" element={<OfflinePurchase />} />
        <Route path="offline-checkout" element={<OfflineCheckoutConfirmation />} />
        <Route path="offline-order-confirmation/:orderId" element={<OfflineOrderConfirmation />} />
        <Route path="cart" element={<CartPage />} />
        <Route path="procurement/checkout" element={<ProcurementCheckoutConfirmation />} />
        <Route path="inventory-update/:pharmaID?" element={<DeliveredOrderInventoryUpdate />} />
      </Route>

      <Route path="*" element={<Navigate to="/" />} />
    </Routes>

  );
}

export default App;