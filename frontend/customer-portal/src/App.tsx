import { Routes, Route, Navigate } from "react-router-dom";
import HomePage from "./pages/HomePage";
import DashboardOverview from "./pages/DashboardOverview";
import DashboardPage from "./pages/DashboardPage";
import SearchPage from "./pages/SearchPage";
import PharmaciesNearYou from "./pages/PharmaciesNearYou";
import CartPage from "./pages/CartPage";
import CheckoutConfirmationPage from "./pages/CheckoutConfirmationPage";
import OrderTrackingPage from "./pages/OrderTrackingPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ProfilePage from "./pages/ProfilePage";
import { useAuth } from "./hooks/useAuth";

function App() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Protected routes */}
      <Route
        path="/dashboard"
        element={isAuthenticated ? <DashboardPage /> : <Navigate to="/login" />}
      >
        <Route index element={<DashboardOverview />} />
        <Route path="pharmacies" element={<PharmaciesNearYou />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="cart" element={<CartPage />} />
        <Route path="checkout-confirm" element={<CheckoutConfirmationPage />} />
        <Route path="orders" element={<OrderTrackingPage />} />
        <Route path="profile" element={<ProfilePage />} />

        {/* ✅ Pharmacy-specific search now nested inside dashboard layout */}
        <Route path="pharmacy/:pharmaID/search" element={<SearchPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default App;