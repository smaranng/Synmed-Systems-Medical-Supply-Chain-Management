import { NavLink, Outlet } from "react-router-dom";
import { User, LogOut, UserRoundCog } from "lucide-react";
import { Button } from "../components/ui/Button";

interface SidebarItem {
  label: string;
  icon: any;
  path: string;
}

interface SideBarLayoutProps {
  sidebarItems: SidebarItem[];
  user: any;
  handleLogout: () => void;
}

export default function SideBarLayout({
  sidebarItems,
  user,
  handleLogout,
}: SideBarLayoutProps) {
  return (
    <div className="h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <div className="w-80 bg-[#4A0F73] shadow-lg flex flex-col">
        <div className="p-6 flex-1">
          {/* Header */}
          <div className="flex items-center space-x-3 mb-8">
            <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center">
              <UserRoundCog className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Admin Portal</h2>
              <p className="text-sm text-purple-100">SYNMED Systems</p>
            </div>
          </div>

          <div className="-mx-6 border-t border-purple-300 mb-6" />

          {/* Navigation */}
          <nav className="space-y-2">
            {sidebarItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end
                  className={({ isActive }) =>
                    `w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                      isActive
                        ? "bg-white text-purple-700 border-r-2 border-white"
                        : "text-white hover:bg-purple-500"
                    }`
                  }
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-purple-300">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
              <User className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {user?.name}
              </p>
              <p className="text-xs text-purple-100 truncate">
                {user?.email}
              </p>
            </div>
          </div>

          <Button
            variant="outline"
            onClick={handleLogout}
            className="w-full bg-white text-purple-700 border-white hover:bg-gray-100"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-8">
        <Outlet />
      </div>
    </div>
  );
}
