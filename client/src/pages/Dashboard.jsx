import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import {
  FolderKanban,
  CheckSquare,
  Users,
  Bell,
  ArrowUpRight,
  Plus,
  Activity,
  LoaderCircle,
  AlertCircle,
} from "lucide-react";

import api from "../services/api";
import { useAuth } from "../context/AuthContext";

const getId = (value) => {
  if (!value) return null;
  if (typeof value === "object") return value._id || value.id || null;
  return value;
};

const isCompleted = (status) =>
  ["completed", "done"].includes(String(status || "").toLowerCase());

export default function Dashboard() {
  const { user } = useAuth();

  const [data, setData] = useState({
    projects: [],
    tasks: [],
    notifications: [],
    teamMembersCount: 0,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    // Refresh only notifications without reloading the entire dashboard
    const refreshNotifications = async () => {
      try {
        const response = await api.get("/notifications");

        if (!cancelled) {
          setData((previous) => ({
            ...previous,
            notifications: response.data.notifications || [],
          }));
        }
      } catch (err) {
        console.error("Unable to refresh notifications:", err);
      }
    };

    // Listen for new live notifications
    const handleNewNotification = () => {
      refreshNotifications();
    };

    // Listen when notifications are read, deleted, or updated
    const handleNotificationsUpdated = () => {
      refreshNotifications();
    };

    window.addEventListener(
      "collabx_notification_received",
      handleNewNotification,
    );

    window.addEventListener(
      "collabx_notifications_updated",
      handleNotificationsUpdated,
    );

    const loadDashboard = async () => {
      setLoading(true);
      setError("");

      try {
        const [projectResult, taskResult, notificationResult] =
          await Promise.allSettled([
            api.get("/projects"),
            api.get("/tasks"),
            api.get("/notifications"),
          ]);

        if (projectResult.status === "rejected") {
          throw projectResult.reason;
        }

        const projects = projectResult.value.data.projects || [];

        const tasks =
          taskResult.status === "fulfilled"
            ? taskResult.value.data.tasks || []
            : [];

        const notifications =
          notificationResult.status === "fulfilled"
            ? notificationResult.value.data.notifications || []
            : [];

        const currentUserId = getId(user);

        // Load actual team data for every accessible project
        const teamResults = await Promise.allSettled(
          projects.map((project) => api.get(`/team/${project._id}`)),
        );

        const uniqueMembers = new Set();

        teamResults.forEach((result) => {
          if (result.status !== "fulfilled") return;

          const team = result.value.data.team;
          if (!team) return;

          const allPeople = [team.owner, ...(team.members || [])];

          allPeople.forEach((person) => {
            const id = getId(person);

            // Exclude logged-in user from collaborator count
            if (id && String(id) !== String(currentUserId)) {
              uniqueMembers.add(String(id));
            }
          });
        });

        if (!cancelled) {
          setData({
            projects,
            tasks,
            notifications,
            teamMembersCount: uniqueMembers.size,
          });
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err.response?.data?.message ||
              err.message ||
              "Unable to load dashboard.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadDashboard();

    return () => {
      cancelled = true;

      window.removeEventListener(
        "collabx_notification_received",
        handleNewNotification,
      );

      window.removeEventListener(
        "collabx_notifications_updated",
        handleNotificationsUpdated,
      );
    };
  }, [user]);

  const completedTasks = data.tasks.filter((task) => isCompleted(task.status));

  const activeTasks = data.tasks.length - completedTasks.length;

  const unreadNotifications = data.notifications.filter(
    (notification) => !notification.isRead,
  );

  const stats = [
    {
      label: "Total Projects",
      value: data.projects.length,
      icon: FolderKanban,
      color: "text-indigo-400",
      bg: "bg-indigo-500/10",
      link: "/projects",
    },
    {
      label: "Active Tasks",
      value: activeTasks,
      icon: CheckSquare,
      color: "text-cyan-400",
      bg: "bg-cyan-500/10",
      link: "/tasks",
    },
    {
      label: "Team Members",
      value: data.teamMembersCount,
      icon: Users,
      color: "text-purple-400",
      bg: "bg-purple-500/10",
      link: "/team",
    },
    {
      label: "Unread Notifications",
      value: unreadNotifications.length,
      icon: Bell,
      color: "text-amber-400",
      bg: "bg-amber-500/10",
      link: "/notifications",
    },
  ];

  const getProgress = (project) => {
    if (String(project.status).toLowerCase() === "completed") {
      return 100;
    }

    const projectTasks = data.tasks.filter(
      (task) => String(getId(task.project)) === String(project._id),
    );

    if (projectTasks.length === 0) return 0;

    const completed = projectTasks.filter((task) =>
      isCompleted(task.status),
    ).length;

    return Math.round((completed / projectTasks.length) * 100);
  };

  const getPriorityClass = (priority) => {
    const value = String(priority || "Medium").toLowerCase();

    if (value === "high") return "bg-red-500/10 text-red-400";
    if (value === "low") return "bg-emerald-500/10 text-emerald-400";

    return "bg-amber-500/10 text-amber-400";
  };

  const getStatusClass = (status) => {
    const value = String(status || "").toLowerCase();

    if (isCompleted(value)) return "bg-emerald-500/10 text-emerald-400";
    if (value === "in progress") return "bg-indigo-500/10 text-indigo-400";
    if (value === "in review") return "bg-purple-500/10 text-purple-400";

    return "bg-slate-700 text-slate-300";
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center gap-3 text-slate-400">
        <LoaderCircle size={23} className="animate-spin" />
        Loading your workspace...
      </div>
    );
  }

  return (
    <div className="space-y-8 text-white">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="mb-2 text-sm text-indigo-400">Workspace overview</p>
          <h1 className="text-3xl font-bold">Good to see you again 👋</h1>
          <p className="mt-2 text-sm text-slate-400">
            Here's what's happening with your projects today.
          </p>
        </div>

        <Link
          to="/projects"
          className="flex items-center justify-center gap-2 rounded-xl bg-indigo-500 px-5 py-3 text-sm font-semibold hover:bg-indigo-400"
        >
          <Plus size={17} />
          New Project
        </Link>
      </section>

      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-300">
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;

          return (
            <Link
              key={stat.label}
              to={stat.link}
              className="rounded-2xl border border-white/10 bg-slate-900/70 p-5 transition hover:-translate-y-1 hover:border-indigo-500/40"
            >
              <div className="flex items-center justify-between">
                <div className={`rounded-xl p-3 ${stat.bg} ${stat.color}`}>
                  <Icon size={21} />
                </div>
                <ArrowUpRight size={17} className="text-slate-500" />
              </div>

              <p className="mt-5 text-3xl font-bold">{stat.value}</p>
              <p className="mt-1 text-sm text-slate-400">{stat.label}</p>
            </Link>
          );
        })}
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5 xl:col-span-2">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="font-semibold">Your Projects</h2>
              <p className="mt-1 text-xs text-slate-400">
                Overview of your saved projects
              </p>
            </div>

            <Link
              to="/projects"
              className="text-xs text-indigo-400 hover:text-indigo-300"
            >
              View all
            </Link>
          </div>

          {data.projects.length > 0 ? (
            <div className="space-y-5">
              {data.projects.slice(0, 5).map((project) => {
                const progress = getProgress(project);

                return (
                  <div key={project._id}>
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">
                          {project.name || "Untitled project"}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {project.status || "Planning"}
                        </p>
                      </div>

                      <span className="text-sm font-semibold text-indigo-300">
                        {progress}%
                      </span>
                    </div>

                    <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                      <div
                        className="h-full rounded-full bg-indigo-500 transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-12 text-center">
              <FolderKanban size={34} className="mx-auto text-slate-600" />
              <p className="mt-3 font-medium">No projects yet</p>
              <Link
                to="/projects"
                className="mt-4 inline-block text-sm text-indigo-400"
              >
                Create a project →
              </Link>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="font-semibold">Task Summary</h2>
              <p className="mt-1 text-xs text-slate-400">
                Your current workload
              </p>
            </div>
            <CheckSquare size={19} className="text-indigo-400" />
          </div>

          <div className="space-y-4">
            <div className="rounded-xl bg-slate-950 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">Total Tasks</span>
                <span className="text-xl font-bold">{data.tasks.length}</span>
              </div>
            </div>

            <div className="rounded-xl bg-slate-950 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">Completed</span>
                <span className="text-xl font-bold text-emerald-400">
                  {completedTasks.length}
                </span>
              </div>
            </div>

            <div className="rounded-xl bg-slate-950 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">Remaining</span>
                <span className="text-xl font-bold text-amber-400">
                  {activeTasks}
                </span>
              </div>
            </div>
          </div>

          <Link
            to="/tasks"
            className="mt-5 flex items-center justify-center gap-2 rounded-xl border border-white/10 py-3 text-sm text-slate-300 hover:bg-white/5"
          >
            Manage Tasks <ArrowUpRight size={16} />
          </Link>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Recent Tasks</h2>
            <p className="mt-1 text-xs text-slate-400">
              Tasks saved in your workspace
            </p>
          </div>
          <Link
            to="/tasks"
            className="text-xs text-indigo-400 hover:text-indigo-300"
          >
            View all
          </Link>
        </div>

        {data.tasks.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[550px] text-left">
              <thead>
                <tr className="border-b border-white/10 text-xs text-slate-500">
                  <th className="pb-3 font-medium">Task</th>
                  <th className="pb-3 font-medium">Priority</th>
                  <th className="pb-3 font-medium">Status</th>
                </tr>
              </thead>

              <tbody>
                {data.tasks.slice(0, 5).map((task) => (
                  <tr
                    key={task._id}
                    className="border-b border-white/5 last:border-0"
                  >
                    <td className="py-4 pr-4 text-sm font-medium">
                      {task.title || "Untitled task"}
                    </td>
                    <td className="py-4 pr-4">
                      <span
                        className={`rounded-lg px-2.5 py-1.5 text-xs ${getPriorityClass(task.priority)}`}
                      >
                        {task.priority || "Medium"}
                      </span>
                    </td>
                    <td className="py-4">
                      <span
                        className={`rounded-lg px-2.5 py-1.5 text-xs ${getStatusClass(task.status)}`}
                      >
                        {task.status || "Todo"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-10 text-center text-sm text-slate-400">
            No tasks available. Create your first task.
          </div>
        )}
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <Link
          to="/team"
          className="flex items-center gap-4 rounded-2xl border border-white/10 bg-slate-900/70 p-5 hover:border-indigo-500/40"
        >
          <div className="rounded-xl bg-purple-500/10 p-3 text-purple-400">
            <Users size={22} />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold">Manage your team</h3>
            <p className="mt-1 text-xs text-slate-400">
              Invite members and manage your project team.
            </p>
          </div>
          <ArrowUpRight size={18} className="text-slate-500" />
        </Link>

        <Link
          to="/activity"
          className="flex items-center gap-4 rounded-2xl border border-white/10 bg-slate-900/70 p-5 hover:border-indigo-500/40"
        >
          <div className="rounded-xl bg-cyan-500/10 p-3 text-cyan-400">
            <Activity size={22} />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold">Workspace activity</h3>
            <p className="mt-1 text-xs text-slate-400">
              Check your recent workspace updates.
            </p>
          </div>
          <ArrowUpRight size={18} className="text-slate-500" />
        </Link>
      </section>
    </div>
  );
}
