import { Outlet, useNavigate } from "react-router-dom";
import SideBarLayout from "../components/SidebarLayout";
import { useAuth } from "../hooks/useAuth";
import { Home, Package, Settings } from "lucide-react";

const driverSidebarItems = [
  { id: "overview",    label: "Overview",    icon: Home,     path: "/driver/dashboard" },
  { id: "deliveries",  label: "Deliveries",  icon: Package,  path: "/driver/dashboard/deliveries" },
  { id: "settings",    label: "Settings",    icon: Settings, path: "/driver/dashboard/settings" },
];

export default function DriverDashboardPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  return (
    <SideBarLayout
      sidebarItems={driverSidebarItems}
      handleLogout={() => {
        logout();
        navigate("/login");
      }}
    >
      <Outlet />
    </SideBarLayout>
  );
}