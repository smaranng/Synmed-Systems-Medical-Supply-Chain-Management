import { Outlet, useNavigate } from "react-router-dom";
import SideBarLayout from "../components/SidebarLayout";
import { useAuth } from "../hooks/useAuth";
import {
  Home,
  Package,
  Truck,
  FileText,
  Settings,
  PackageSearch,
  ShoppingCart,
} from "lucide-react";
import { LocationModal } from "../../../shared/components/LocationModal";
import { locationService } from "../../../shared/services/locationService";
import { useState, useEffect } from "react";

const sidebarItems = [
  { id: "overview",         label: "Overview",          icon: Home,          path: "/dashboard" },
  { id: "orders",           label: "Orders",            icon: ShoppingCart,  path: "/dashboard/orders" },
  { id: "vehicles-drivers", label: "Vehicles & Drivers", icon: Truck,        path: "/dashboard/vehicles-drivers" },
  //{ id: "shipments",        label: "Shipments",         icon: Package,       path: "/dashboard/shipments" },
  //{ id: "invoices",         label: "Invoices",          icon: FileText,      path: "/dashboard/invoices" },
  { id: "products",         label: "Products",          icon: PackageSearch, path: "/dashboard/products" },
  { id: "settings",         label: "Settings",          icon: Settings,      path: "/dashboard/settings" },
];

export default function DashboardPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [locationChecked, setLocationChecked] = useState(false);

  useEffect(() => {
    if (!locationChecked) checkUserLocation();
  }, [locationChecked]);

  const checkUserLocation = async () => {
    try {
      await locationService.getNearbyPharmacies(1000, "distributor");
      setLocationChecked(true);
    } catch (err: any) {
      if (err.message === "LOCATION_REQUIRED") setShowLocationModal(true);
      setLocationChecked(true);
    }
  };

  const handleLocationSet = async (latitude: number, longitude: number, address?: string) => {
    try {
      await locationService.updateLocation(latitude, longitude, address, "distributor");
      setShowLocationModal(false);
      navigate("/dashboard");
    } catch (err: any) {
      alert(err.message || "Failed to update location");
    }
  };

  return (
    <>
      <LocationModal
        isOpen={showLocationModal}
        onClose={() => setShowLocationModal(false)}
        onLocationSet={handleLocationSet}
        portalType="distributor"
      />
      <SideBarLayout
        sidebarItems={sidebarItems}
        handleLogout={() => {
          logout();
          navigate("/");
        }}
      >
        <Outlet />
      </SideBarLayout>
    </>
  );
}