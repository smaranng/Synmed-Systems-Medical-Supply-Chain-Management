import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import AdminFullScreenLoader from "./components/AdminFullScreenLoader";

import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegistrationPage";
import DashboardLayout from "./pages/DashboardLayout";
import OverviewPage from "./pages/OverviewPage";
import distributorsPage from "./pages/distributorsPage";
import PharmaciesPage from "./pages/PharmaciesPage";
import OrdersPage from "./pages//OrdersPage";
import VehiclesPage from "./pages/VehiclesPage";
import SettingsPage from "./pages/SettingsPage";

export default function App() {
  const { isAuthenticated, isLoading } = useAuth();

  // Show loading state while checking authentication
  if (isLoading) {
    return <AdminFullScreenLoader />;
  }

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/login"
        element={!isAuthenticated ? <LoginPage /> : <Navigate to="/dashboard" />}
      />

      {/* Protected Dashboard */}
      <Route
        path="/dashboard"
        element={isAuthenticated ? <DashboardLayout /> : <Navigate to="/login" />}
      >
        <Route index element={<OverviewPage />} />
        <Route path="distributors" element={<distributorsPage />} />
        <Route path="pharmacies" element={<PharmaciesPage />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="vehicles" element={<VehiclesPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}
