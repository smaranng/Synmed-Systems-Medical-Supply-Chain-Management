import { User, LogOut, UserCircle2Icon } from "lucide-react";
import { Button } from "../components/ui/Button";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useCartContext } from "../context/CartContext";
import OrderNotificationBadge from "./OrderNotificationBadge";

interface SidebarItem {
  id: string;
  label: string;
  icon: any;
  path: string;
}

interface SideBarLayoutProps {
  sidebarItems: SidebarItem[];
  activeTab: string;
  handleLogout: () => void;
  renderContent: () => React.ReactNode;
}

export default function SideBarLayout({
  sidebarItems,
  activeTab,
  handleLogout,
  renderContent,
}: SideBarLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { count } = useCartContext();

  const isActive = (item: SidebarItem) => {
    // When browsing a specific pharmacy's search page, keep "Pharmacies" highlighted
    if (item.id === "pharmacies") {
      return (
        activeTab === "pharmacies" ||
        location.pathname.includes("/dashboard/pharmacy/")
      );
    }
    return activeTab === item.id;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="fixed top-0 left-0 w-64 h-screen bg-[#123B6B] text-white flex flex-col z-50">
        {/* Header */}
        <div className="p-6 border-b border-white">
          <div className="flex items-center space-x-2">
            <div className="w-10 h-10 bg-[#4BA3C3] rounded-lg flex items-center justify-center">
              <UserCircle2Icon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-semibold text-white">Customer Portal</h1>
              <p className="text-xs text-blue-200">SYNMED Systems</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {sidebarItems.map((item) => {
            const Icon = item.icon;
            const isCart = item.id === "cart";
            const active = isActive(item);

            return (
              <button
                key={item.id}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg relative transition-colors ${
                  active
                    ? "bg-white text-[#0A1D37]"
                    : "text-blue-200 hover:bg-[#13284B]"
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="font-medium">{item.label}</span>
                {isCart && count > 0 && (
                  <span className="ml-auto flex items-center justify-center w-6 h-6 bg-red-500 text-white text-xs font-bold rounded-full">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* User Section */}
        <div className="p-6 border-t border-white">
          <div className="flex items-center space-x-3 mb-4">
            <div className="h-10 w-10 bg-white/10 rounded-full flex items-center justify-center">
              <User className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="font-semibold text-white">{user?.name || "Customer"}</p>
              <p className="text-xs text-blue-200">{user?.email || "customer@example.com"}</p>
            </div>
          </div>

          <Button
            variant="outline"
            onClick={handleLogout}
            className="w-full bg-white text-[#0A1D37] border-white hover:bg-gray-100"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="ml-64 p-8 min-h-screen">{renderContent()}</div>

      {/* Order Notification Badge */}
      <OrderNotificationBadge />
    </div>
  );
}