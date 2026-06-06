import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import SideBarLayout from '../components/SidebarLayout';
import { useAuth } from '../hooks/useAuth';
import {
  Home,
  MapPin,
  ShoppingCart,
  Package,
  User
} from 'lucide-react';
import { LocationModal } from '../../../shared/components/LocationModal';
import { locationService } from '../../../shared/services/locationService';
import { NotificationProvider } from '../context/NotificationContext';

const sidebarItems = [
  { id: 'overview',    label: 'Overview',         icon: Home,         path: '/dashboard' },
  { id: 'pharmacies',  label: 'Find Pharmacies',   icon: MapPin,       path: '/dashboard/pharmacies' },
  { id: 'cart',        label: 'My Cart',           icon: ShoppingCart, path: '/dashboard/cart' },
  { id: 'orders',      label: 'My Orders',         icon: Package,      path: '/dashboard/orders' },
  { id: 'profile',     label: 'Profile',           icon: User,         path: '/dashboard/profile' },
];

export default function DashboardPage() {
  const { logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [locationChecked, setLocationChecked] = useState(false);

  useEffect(() => {
    if (!locationChecked) checkUserLocation();
  }, [locationChecked]);

  const checkUserLocation = async () => {
    try {
      await locationService.getNearbyPharmacies(1000);
      setLocationChecked(true);
    } catch (err: any) {
      if (err.message === "LOCATION_REQUIRED") setShowLocationModal(true);
      setLocationChecked(true);
    }
  };

  const handleLocationSet = async (latitude: number, longitude: number, address?: string) => {
    try {
      await locationService.updateLocation(latitude, longitude, address);
      setShowLocationModal(false);
      navigate('/dashboard/pharmacies');
    } catch (err: any) {
      alert(err.message || "Failed to update location");
    }
  };

  // ✅ Pharmacy search page → keep "pharmacies" highlighted
  const activeTab = (() => {
    if (location.pathname.includes("/dashboard/pharmacy/")) return "pharmacies";
    return (
      sidebarItems
        .slice()
        .sort((a, b) => b.path.length - a.path.length)
        .find((item) => location.pathname.startsWith(item.path))
        ?.id || "overview"
    );
  })();

  return (
    <>
      <LocationModal
        isOpen={showLocationModal}
        onClose={() => setShowLocationModal(false)}
        onLocationSet={handleLocationSet}
        portalType="customer"
      />
      <NotificationProvider>
        <SideBarLayout
          sidebarItems={sidebarItems}
          activeTab={activeTab}
          handleLogout={() => { logout(); navigate('/'); }}
          renderContent={() => <Outlet />}
        />
      </NotificationProvider>
    </>
  );
}