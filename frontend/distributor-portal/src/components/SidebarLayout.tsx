import { User, LogOut, UserSquare2Icon } from "lucide-react";
import { Button } from "../components/ui/Button";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

interface SidebarItem {
  id: string;
  label: string;
  icon: any;
  path: string;
}

interface SideBarLayoutProps {
  sidebarItems: SidebarItem[];
  handleLogout: () => void;
  children: React.ReactNode;
}

export default function SideBarLayout({
  sidebarItems,
  handleLogout,
  children,
}: SideBarLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const activeTab =
    sidebarItems
      .slice()
      .sort((a, b) => b.path.length - a.path.length)
      .find((item) => location.pathname.startsWith(item.path))?.id ||
    "overview";

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <div className="fixed left-0 top-0 w-64 h-screen bg-[#c13c08] flex flex-col">
        <div className="p-6 flex-1 overflow-y-auto">
          <div className="flex items-center space-x-3 mb-8">
            <div className="w-10 h-10 bg-[#cd7605] rounded-lg flex items-center justify-center">
              <UserSquare2Icon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">
                {user?.role === "driver" ? "Driver Portal" : "Distributor Portal"}
              </h2>
              <p className="text-sm text-orange-100">SYNMED Systems</p>
            </div>
          </div>

          <div className="-mx-6 border-t border-white mb-6" />

          <nav className="space-y-2">
            {sidebarItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => navigate(item.path)}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                    activeTab === item.id
                      ? "bg-white text-orange-700"
                      : "text-white hover:bg-orange-500"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-6 border-t border-white">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
              <User className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-medium text-white">{user?.name}</p>
              <p className="text-xs text-orange-100">
                {user?.email ?? user?.phone ?? user?.username}
              </p>
            </div>
          </div>

          <Button
            onClick={handleLogout}
            variant="outline"
            className="w-full bg-white text-orange-700"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </div>
      <div className="ml-64 flex-1 p-8 overflow-y-auto">{children}</div>
    </div>
  );
}