import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import RegisterPage from "./pages/RegisterPage";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import DashboardOverview from "./pages/DashboardOverview";
import OrdersPage from "./pages/OrdersPage";
import ShipmentsPage from "./pages/ShipmentsPage";
//import InvoicesPage from "./pages/InvoicesPage";
import ProductsPage from "./pages/ProductsPage";
import SettingsPage from "./pages/SettingsPage";
import VehiclesDriversPage from "./pages/VehiclesDriversPage";
import AddDriverPage from "./pages/AddDriverPage";
import AddVehiclePage from "./pages/AddVehiclePage";
import DriverDashboardPage from "./pages/DriverDashboardPage";
// import DriverOverview from "./pages/driver/DriverOverview";
// import DriverDeliveries from "./pages/driver/DriverDeliveries";
// import DriverSettings from "./pages/driver/DriverSettings";

// ── Role-aware protected route ────────────────────────────────────────────────

interface ProtectedRouteProps {
  children: JSX.Element;
  allowedRoles?: string[];   // if omitted → any authenticated user
}

function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  if (allowedRoles && user?.role && !allowedRoles.includes(user.role)) {
    // Redirect driver trying to access distributor dashboard (and vice-versa)
    return <Navigate to={user.role === "driver" ? "/driver/dashboard" : "/dashboard"} replace />;
  }

  return children;
}

// ─────────────────────────────────────────────────────────────────────────────

function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/login" element={<LoginPage />} />

      {/* ── Distributor dashboard (role: distributor) ── */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute allowedRoles={["distributor"]}>
            <DashboardPage />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardOverview />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="shipments" element={<ShipmentsPage />} />
        {/* <Route path="invoices" element={<InvoicesPage />} /> */}
        <Route path="products" element={<ProductsPage />} />
        <Route path="settings" element={<SettingsPage />} />

        {/* Vehicles & Drivers section */}
        <Route path="vehicles-drivers" element={<VehiclesDriversPage />} />
        <Route path="vehicles-drivers/add-driver" element={<AddDriverPage />} />
        <Route path="vehicles-drivers/add-vehicle" element={<AddVehiclePage />} />
      </Route>

      {/* ── Driver dashboard (role: driver) ── */}
      <Route
        path="/driver/dashboard"
        element={
          <ProtectedRoute allowedRoles={["driver"]}>
            <DriverDashboardPage />
          </ProtectedRoute>
        }
      >
        {/* <Route index element={<DriverOverview />} />
        <Route path="deliveries" element={<DriverDeliveries />} />
        <Route path="settings" element={<DriverSettings />} /> */}
      </Route>

      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default App;