import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";

import {
  LayoutDashboard,
  FolderKanban,
  CheckSquare,
  MessageSquare,
  Users,
  Activity,
  Bell,
  Search,
  Menu,
  X,
  Plus,
  ChevronDown,
  Command,
  Settings,
  LogOut,
  Code2,
} from "lucide-react";

import { useAuth } from "../context/AuthContext";
import api from "../services/api";

const navigationGroups = [
  {
    title: "Workspace",
    links: [
      { name: "Overview", path: "/dashboard", icon: LayoutDashboard },
      { name: "Projects", path: "/projects", icon: FolderKanban },
      { name: "My Tasks", path: "/tasks", icon: CheckSquare },
    ],
  },
  {
    title: "Collaboration",
    links: [
      { name: "Messages", path: "/chat", icon: MessageSquare },
      { name: "Team", path: "/team", icon: Users },
      { name: "Activity", path: "/activity", icon: Activity },
    ],
  },
  {
    title: "Developer Tools",
    links: [
      {
        name: "Developer Assist",
        path: "/developer-assist",
        icon: Code2,
      },
    ],
  },
];

const pageTitles = {
  "/dashboard": "Overview",
  "/projects": "Projects",
  "/tasks": "My Tasks",
  "/chat": "Messages",
  "/team": "Team",
  "/activity": "Activity",
  "/notifications": "Notifications",
  "/developer-assist": "Developer Assist",
};

function getInitials(name = "User") {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

export default function DashboardLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const location = useLocation();
  const navigate = useNavigate();

  const { user, logout } = useAuth();

  const currentPage = pageTitles[location.pathname] || "Workspace";
  const userName = user?.name || "User";
  const userEmail = user?.email || "";
  const userInitials = getInitials(userName);

  const fetchUnreadCount = async () => {
    try {
      const response = await api.get("/notifications");
      setUnreadCount(response.data.unreadCount || 0);
    } catch (error) {
      console.error("Unread notification count failed:", error.message);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  useEffect(() => {
    fetchUnreadCount();

    const handleNewNotification = (event) => {
      const notification = event.detail?.notification;

      if (notification && !notification.isRead) {
        setUnreadCount((previous) => previous + 1);
      }
    };

    const handleCountUpdate = (event) => {
      if (typeof event.detail?.count === "number") {
        setUnreadCount(event.detail.count);
      } else {
        fetchUnreadCount();
      }
    };

    window.addEventListener(
      "collabx_notification_received",
      handleNewNotification,
    );

    window.addEventListener("collabx_unread_count_updated", handleCountUpdate);

    window.addEventListener("collabx_notifications_updated", fetchUnreadCount);

    return () => {
      window.removeEventListener(
        "collabx_notification_received",
        handleNewNotification,
      );

      window.removeEventListener(
        "collabx_unread_count_updated",
        handleCountUpdate,
      );

      window.removeEventListener(
        "collabx_notifications_updated",
        fetchUnreadCount,
      );
    };
  }, []);

  useEffect(() => {
    fetchUnreadCount();
    setMobileOpen(false);
  }, [location.pathname]);

  const sidebarContent = (
    <>
      <div className="flex h-[76px] items-center gap-3 border-b border-white/[0.07] px-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500 text-white shadow-lg shadow-indigo-500/20">
          <Command size={22} />
        </div>

        <div>
          <h1 className="text-lg font-bold tracking-tight text-white">
            Collab<span className="text-indigo-400">X</span>
          </h1>
          <p className="text-[10px] tracking-widest text-slate-500">
            WORKSPACE
          </p>
        </div>
      </div>

      <div className="border-b border-white/[0.07] p-4">
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] p-3 text-left transition hover:bg-white/[0.06]"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-sm font-bold text-white">
            C
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">
              CollabX Team
            </p>
            <p className="text-xs text-slate-500">Free Workspace</p>
          </div>

          <ChevronDown size={16} className="text-slate-500" />
        </button>
      </div>

      <div className="flex-1 space-y-7 overflow-y-auto px-4 py-6">
        {navigationGroups.map((group) => (
          <div key={group.title}>
            <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600">
              {group.title}
            </p>

            <div className="space-y-1">
              {group.links.map((link) => {
                const Icon = link.icon;

                return (
                  <NavLink
                    key={link.path}
                    to={link.path}
                    className={({ isActive }) =>
                      `flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition ${
                        isActive
                          ? "bg-indigo-500/10 text-indigo-300"
                          : "text-slate-400 hover:bg-white/[0.04] hover:text-white"
                      }`
                    }
                  >
                    <Icon size={18} />
                    <span>{link.name}</span>
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}

        <div>
          <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600">
            General
          </p>

          <NavLink
            to="/notifications"
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition ${
                isActive
                  ? "bg-indigo-500/10 text-indigo-300"
                  : "text-slate-400 hover:bg-white/[0.04] hover:text-white"
              }`
            }
          >
            <Bell size={18} />
            <span className="flex-1">Notifications</span>

            {unreadCount > 0 && (
              <span className="min-w-5 rounded-full bg-indigo-500 px-1.5 py-0.5 text-center text-[10px] font-bold text-white">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </NavLink>

          <button
            type="button"
            onClick={() => navigate("/projects")}
            className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-400 transition hover:bg-white/[0.04] hover:text-white"
          >
            <Settings size={18} />
            <span>Workspace Settings</span>
          </button>
        </div>
      </div>

      <div className="px-4 pb-4">
        <button
          type="button"
          onClick={() => navigate("/projects")}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-400"
        >
          <Plus size={17} />
          Create New Project
        </button>
      </div>

      <div className="border-t border-white/[0.07] p-4">
        <div className="flex items-center gap-3 rounded-xl p-2">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-sm font-bold text-white">
            {userInitials}
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">
              {userName}
            </p>
            <p className="truncate text-xs text-slate-500">{userEmail}</p>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            title="Logout"
            aria-label="Logout"
            className="rounded-lg p-2 text-slate-500 transition hover:bg-red-500/10 hover:text-red-400"
          >
            <LogOut size={17} />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-[#080b14] text-slate-100">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[260px] flex-col border-r border-white/[0.07] bg-[#0c101b] lg:flex">
        {sidebarContent}
      </aside>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/70 lg:hidden"
          onClick={() => setMobileOpen(false)}
        >
          <aside
            className="flex h-full w-[280px] flex-col border-r border-white/[0.07] bg-[#0c101b]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex justify-end px-4 pt-3">
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-white/5"
              >
                <X size={20} />
              </button>
            </div>

            {sidebarContent}
          </aside>
        </div>
      )}

      <main className="min-h-screen lg:ml-[260px]">
        <header className="sticky top-0 z-30 flex h-[76px] items-center justify-between border-b border-white/[0.07] bg-[#080b14]/90 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="rounded-lg p-2 text-slate-400 hover:bg-white/5 lg:hidden"
            >
              <Menu size={21} />
            </button>

            <div>
              <h2 className="text-sm font-semibold text-white sm:text-base">
                {currentPage}
              </h2>
              <p className="hidden text-xs text-slate-500 sm:block">
                Welcome back to your workspace
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <div className="relative hidden md:block">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
              />

              <input
                placeholder="Search workspace..."
                className="w-48 rounded-xl border border-white/[0.07] bg-[#111522] py-2.5 pl-9 pr-3 text-xs text-white outline-none transition placeholder:text-slate-500 focus:border-indigo-500 xl:w-64"
              />
            </div>

            <button
              type="button"
              onClick={() => navigate("/notifications")}
              className="relative rounded-xl border border-white/[0.07] bg-[#111522] p-2.5 text-slate-400 transition hover:text-white"
              title="Notifications"
              aria-label="Open notifications"
            >
              <Bell size={18} />

              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-500 px-1 text-[9px] font-bold text-white">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>

            <div
              title={userName}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-sm font-bold text-white"
            >
              {userInitials}
            </div>
          </div>
        </header>

        <div className="p-4 sm:p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
