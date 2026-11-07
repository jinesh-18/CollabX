import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  Activity as ActivityIcon,
  FolderKanban,
  CheckSquare,
  Users,
  Clock3,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  CircleDot,
  UserPlus,
  UserMinus,
  FolderPlus,
  Pencil,
  Trash2,
  AlertCircle,
  CalendarDays,
  ListFilter,
  LoaderCircle,
} from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const LIMIT = 20;

const FILTERS = ["All", "Project", "Task", "Team"];

const ACTION_CONFIG = {
  project_created: {
    label: "Project Created",
    icon: FolderPlus,
    color: "text-violet-400",
    bg: "bg-violet-500/10",
  },
  project_updated: {
    label: "Project Updated",
    icon: Pencil,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
  },
  project_deleted: {
    label: "Project Deleted",
    icon: Trash2,
    color: "text-red-400",
    bg: "bg-red-500/10",
  },
  task_created: {
    label: "Task Created",
    icon: CheckSquare,
    color: "text-cyan-400",
    bg: "bg-cyan-500/10",
  },
  task_updated: {
    label: "Task Updated",
    icon: Pencil,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
  },
  task_completed: {
    label: "Task Completed",
    icon: CheckCircle2,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
  },
  task_assigned: {
    label: "Task Assigned",
    icon: UserPlus,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
  },
  team_member_added: {
    label: "Member Added",
    icon: UserPlus,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
  },
  team_member_removed: {
    label: "Team Updated",
    icon: UserMinus,
    color: "text-orange-400",
    bg: "bg-orange-500/10",
  },
  invitation_accepted: {
    label: "Invitation Accepted",
    icon: CheckCircle2,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
  },
};

const getToken = () => {
  const possibleKeys = ["token", "collabx_token", "authToken", "accessToken"];

  for (const key of possibleKeys) {
    const value = localStorage.getItem(key);
    if (value) return value;
  }

  const storedUser = localStorage.getItem("user");

  if (storedUser) {
    try {
      const parsed = JSON.parse(storedUser);
      return parsed.token || parsed.accessToken || null;
    } catch {
      return null;
    }
  }

  return null;
};

const formatDate = (date) => {
  if (!date) return "Date unavailable";

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return "Date unavailable";
  }

  return parsed.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const timeAgo = (date) => {
  if (!date) return "";

  const timestamp = new Date(date).getTime();

  if (Number.isNaN(timestamp)) return "";

  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));

  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;

  return new Date(date).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
};

const getProjectId = (project) =>
  typeof project === "string" ? project : project?._id || project?.id;

const getActionConfig = (action) =>
  ACTION_CONFIG[action] || {
    label: action?.replaceAll("_", " ") || "Activity",
    icon: ActivityIcon,
    color: "text-indigo-400",
    bg: "bg-indigo-500/10",
  };

export default function Activity() {
  const [activities, setActivities] = useState([]);
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState("All");
  const [filter, setFilter] = useState("All");

  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    total: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPreviousPage: false,
  });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const fetchActivities = useCallback(async (showRefresh = false) => {
    const token = getToken();

    if (!token) {
      setError("Authentication token not found. Please login again.");
      setLoading(false);
      setRefreshing(false);
      return;
    }

    if (showRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      const headers = {
        Authorization: `Bearer ${token}`,
      };

      // Fetch projects for project selector.
      const projectResponse = await axios.get(`${API_URL}/projects`, {
        headers,
      });

      const projectData =
        projectResponse.data?.projects || projectResponse.data?.data || [];

      setProjects(Array.isArray(projectData) ? projectData : []);

      let projectList = Array.isArray(projectData) ? projectData : [];

      // Fetch activities for all accessible projects.
      const requests = projectList.map((project) => {
        const projectId = getProjectId(project);

        if (!projectId) return Promise.resolve(null);

        return axios.get(`${API_URL}/activities/project/${projectId}`, {
          headers,
          params: {
            page: 1,
            limit: LIMIT,
          },
        });
      });

      const responses = await Promise.allSettled(requests);

      const combinedActivities = [];

      responses.forEach((result) => {
        if (result.status !== "fulfilled" || !result.value) return;

        const data = result.value.data;

        if (data?.success && Array.isArray(data.activities)) {
          combinedActivities.push(...data.activities);
        }
      });

      // Avoid duplicate records and sort newest first.
      const uniqueActivities = Array.from(
        new Map(combinedActivities.map((item) => [item._id, item])).values(),
      ).sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );

      setActivities(uniqueActivities);
    } catch (err) {
      console.error("Activity fetch error:", err);

      setError(
        err.response?.data?.message ||
          "Unable to load activities. Please try again.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  const filteredActivities = useMemo(() => {
    return activities.filter((item) => {
      const matchesType =
        filter === "All" ||
        (filter === "Project" && item.entityType === "Project") ||
        (filter === "Task" && item.entityType === "Task") ||
        (filter === "Team" && item.entityType === "Team");

      const matchesProject =
        selectedProject === "All" ||
        getProjectId(item.project) === selectedProject;

      return matchesType && matchesProject;
    });
  }, [activities, filter, selectedProject]);

  const totalPages = Math.max(1, Math.ceil(filteredActivities.length / LIMIT));

  const currentPage = Math.min(page, totalPages);

  const paginatedActivities = filteredActivities.slice(
    (currentPage - 1) * LIMIT,
    currentPage * LIMIT,
  );

  const stats = useMemo(
    () => ({
      total: activities.length,
      projects: activities.filter((a) => a.entityType === "Project").length,
      tasks: activities.filter((a) => a.entityType === "Task").length,
      team: activities.filter((a) => a.entityType === "Team").length,
    }),
    [activities],
  );

  const changeFilter = (value) => {
    setFilter(value);
    setPage(1);
  };

  const changeProject = (value) => {
    setSelectedProject(value);
    setPage(1);
  };

  return (
    <div className="min-h-screen space-y-7 pb-10 text-white">
      {/* HEADER */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-indigo-400">
            <ActivityIcon size={14} />
            Workspace Insights
          </div>

          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Activity Timeline
          </h1>

          <p className="mt-2 text-sm text-slate-400">
            Every important update across your projects, tasks and team.
          </p>
        </div>

        <button
          onClick={() => fetchActivities(true)}
          disabled={refreshing || loading}
          className="inline-flex w-fit items-center gap-2 rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-sm font-medium text-slate-300 transition hover:border-indigo-500/40 hover:bg-indigo-500/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          {
            label: "Total Activities",
            value: stats.total,
            icon: ActivityIcon,
            color: "text-indigo-400",
            bg: "bg-indigo-500/10",
          },
          {
            label: "Projects",
            value: stats.projects,
            icon: FolderKanban,
            color: "text-violet-400",
            bg: "bg-violet-500/10",
          },
          {
            label: "Tasks",
            value: stats.tasks,
            icon: CheckSquare,
            color: "text-cyan-400",
            bg: "bg-cyan-500/10",
          },
          {
            label: "Team",
            value: stats.team,
            icon: Users,
            color: "text-emerald-400",
            bg: "bg-emerald-500/10",
          },
        ].map((stat) => {
          const Icon = stat.icon;

          return (
            <div
              key={stat.label}
              className="group rounded-2xl border border-white/[0.07] bg-slate-900/70 p-4 transition hover:-translate-y-1 hover:border-indigo-500/30 sm:p-5"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-slate-400 sm:text-sm">
                  {stat.label}
                </p>

                <div className={`rounded-xl p-2 ${stat.bg} ${stat.color}`}>
                  <Icon size={18} />
                </div>
              </div>

              <p className="mt-4 text-3xl font-bold tracking-tight">
                {stat.value}
              </p>

              <p className="mt-1 text-[11px] text-slate-500">
                Recorded in workspace
              </p>
            </div>
          );
        })}
      </div>

      {/* ACTIVITY PANEL */}
      <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-slate-900/60">
        {/* PANEL HEADER */}
        <div className="flex flex-col justify-between gap-4 border-b border-white/[0.07] p-5 lg:flex-row lg:items-center">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <CircleDot size={18} className="text-indigo-400" />
              Recent Activity
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              A chronological record of workspace events
            </p>
          </div>

          {/* PROJECT FILTER */}
          <div className="flex flex-wrap items-center gap-2">
            <ListFilter size={16} className="text-slate-500" />

            <select
              value={selectedProject}
              onChange={(e) => changeProject(e.target.value)}
              className="max-w-[220px] rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-xs text-slate-300 outline-none transition focus:border-indigo-500"
            >
              <option value="All">All Projects</option>

              {projects.map((project) => (
                <option
                  key={getProjectId(project)}
                  value={getProjectId(project)}
                >
                  {project.name || project.title || "Untitled Project"}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* FILTER TABS */}
        <div className="flex flex-wrap gap-2 border-b border-white/[0.07] px-5 py-4">
          {FILTERS.map((item) => {
            const active = filter === item;

            return (
              <button
                key={item}
                onClick={() => changeFilter(item)}
                className={`rounded-xl px-4 py-2 text-xs font-semibold transition ${
                  active
                    ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/20"
                    : "bg-slate-800/70 text-slate-400 hover:bg-slate-700 hover:text-white"
                }`}
              >
                {item}
              </button>
            );
          })}
        </div>

        {/* CONTENT */}
        <div className="p-5">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <LoaderCircle
                size={34}
                className="animate-spin text-indigo-400"
              />

              <p className="mt-4 text-sm font-medium text-slate-300">
                Loading workspace activity...
              </p>

              <p className="mt-1 text-xs text-slate-500">
                Fetching updates from your projects
              </p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="rounded-2xl bg-red-500/10 p-4 text-red-400">
                <AlertCircle size={30} />
              </div>

              <h3 className="mt-4 font-semibold">Unable to load activity</h3>

              <p className="mt-2 max-w-sm text-sm text-slate-400">{error}</p>

              <button
                onClick={() => fetchActivities()}
                className="mt-5 rounded-xl bg-indigo-500 px-5 py-2.5 text-sm font-semibold transition hover:bg-indigo-400"
              >
                Try Again
              </button>
            </div>
          ) : paginatedActivities.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="rounded-2xl border border-white/10 bg-slate-800/70 p-5 text-slate-500">
                <ActivityIcon size={34} />
              </div>

              <h3 className="mt-5 text-base font-semibold">
                No activity found
              </h3>

              <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
                Project updates, task changes and team activities will appear
                here automatically as your workspace evolves.
              </p>

              {(filter !== "All" || selectedProject !== "All") && (
                <button
                  onClick={() => {
                    setFilter("All");
                    setSelectedProject("All");
                    setPage(1);
                  }}
                  className="mt-5 text-sm font-semibold text-indigo-400 hover:text-indigo-300"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <>
              {/* TIMELINE */}
              <div className="relative">
                <div className="absolute bottom-5 left-[19px] top-5 w-px bg-gradient-to-b from-indigo-500/40 via-slate-700 to-transparent" />

                <div className="space-y-1">
                  {paginatedActivities.map((item) => {
                    const config = getActionConfig(item.action);
                    const Icon = config.icon;

                    const userName = item.user?.name || "Unknown User";

                    const projectName =
                      typeof item.project === "object"
                        ? item.project?.name
                        : null;

                    return (
                      <div
                        key={item._id}
                        className="group relative flex gap-4 rounded-xl p-3 transition hover:bg-white/[0.025] sm:p-4"
                      >
                        <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.07] bg-slate-950 shadow-lg">
                          <Icon size={18} className={config.color} />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-white">
                              {userName}
                            </span>

                            <span
                              className={`rounded-md px-2 py-1 text-[10px] font-semibold ${config.bg} ${config.color}`}
                            >
                              {config.label}
                            </span>
                          </div>

                          <p className="mt-2 text-sm leading-6 text-slate-300">
                            {item.description}
                          </p>

                          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-slate-500">
                            <span className="flex items-center gap-1.5">
                              <Clock3 size={12} />
                              {timeAgo(item.createdAt)}
                            </span>

                            <span className="flex items-center gap-1.5">
                              <CalendarDays size={12} />
                              {formatDate(item.createdAt)}
                            </span>

                            {projectName && (
                              <span className="flex items-center gap-1.5">
                                <FolderKanban size={12} />
                                {projectName}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* PAGINATION */}
              <div className="mt-6 flex flex-col justify-between gap-4 border-t border-white/[0.07] pt-5 sm:flex-row sm:items-center">
                <p className="text-xs text-slate-500">
                  Showing{" "}
                  <span className="font-semibold text-slate-300">
                    {(currentPage - 1) * LIMIT + 1}
                    {" - "}
                    {Math.min(currentPage * LIMIT, filteredActivities.length)}
                  </span>{" "}
                  of{" "}
                  <span className="font-semibold text-slate-300">
                    {filteredActivities.length}
                  </span>{" "}
                  activities
                </p>

                <div className="flex items-center gap-2">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                    className="rounded-lg border border-white/10 p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <ChevronLeft size={17} />
                  </button>

                  <span className="min-w-20 text-center text-xs text-slate-400">
                    Page {currentPage} of {totalPages}
                  </span>

                  <button
                    disabled={currentPage >= totalPages}
                    onClick={() =>
                      setPage((prev) => Math.min(totalPages, prev + 1))
                    }
                    className="rounded-lg border border-white/10 p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <ChevronRight size={17} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* FOOTER */}
      <div className="flex items-center justify-center gap-2 text-center text-[11px] text-slate-600">
        <ActivityIcon size={13} />
        CollabX Workspace Activity
      </div>
    </div>
  );
}
