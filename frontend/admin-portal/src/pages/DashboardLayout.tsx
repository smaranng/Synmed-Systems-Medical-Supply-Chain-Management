import { Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import SideBarLayout from "../components/SidebarLayout";
import {
  Home,
  Building2,
  Package,
  Truck,
  ShipIcon,
  Settings,
} from "lucide-react";

const sidebarItems = [
  { label: "Overview", icon: Home, path: "/dashboard" },
  { label: "distributors", icon: Building2, path: "/dashboard/distributors" },
  { label: "Pharmacies", icon: Package, path: "/dashboard/pharmacies" },
  { label: "Orders", icon: Truck, path: "/dashboard/orders" },
  { label: "Transport & Shipments", icon: ShipIcon, path: "/dashboard/vehicles" },
  { label: "Settings", icon: Settings, path: "/dashboard/settings" },
];

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <SideBarLayout
      sidebarItems={sidebarItems}
      user={user}
      handleLogout={handleLogout}
    />
  );
}
