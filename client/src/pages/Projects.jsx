import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  Plus,
  Search,
  CalendarDays,
  Users,
  FolderKanban,
  X,
  Trash2,
  Pencil,
  LoaderCircle,
  AlertCircle,
  CheckCircle2,
  Clock3,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import api from "../services/api";

const emptyForm = {
  name: "",
  description: "",
  status: "Planning",
  priority: "Medium",
  deadline: "",
};

const statusStyles = {
  "In Progress": "bg-indigo-500/10 text-indigo-300 border-indigo-500/20",
  Planning: "bg-amber-500/10 text-amber-300 border-amber-500/20",
  Completed: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
  "On Hold": "bg-rose-500/10 text-rose-300 border-rose-500/20",
};

const PAGE_SIZE = 10;

const getError = (error) =>
  error.response?.data?.message || error.message || "Something went wrong.";

const dateForInput = (date) => {
  if (!date) return "";

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) return "";

  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
};

export default function Projects() {
  const navigate = useNavigate();

  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filter, setFilter] = useState("All");

  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    total: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPrevPage: false,
  });

  const [refreshKey, setRefreshKey] = useState(0);

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);

  // Open selected project's chat
  const openProjectChat = (projectId) => {
    navigate(`/chat?projectId=${projectId}`);
  };

  // Debounce search to avoid an API request on every keystroke
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 350);

    return () => clearTimeout(timer);
  }, [search]);

  // Fetch projects whenever page, search or filter changes
  useEffect(() => {
    let cancelled = false;

    const loadProjects = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await api.get("/projects", {
          params: {
            page,
            limit: PAGE_SIZE,
            search: debouncedSearch,
            status: filter,
          },
        });

        if (cancelled) return;

        const data = response.data;

        setProjects(data.projects || []);

        setPagination({
          total: data.total || 0,
          totalPages: data.totalPages || 0,
          hasNextPage: data.hasNextPage || false,
          hasPrevPage: data.hasPrevPage || false,
        });

        // Handle a page that becomes invalid after deletion
        if (page > 1 && (data.totalPages === 0 || page > data.totalPages)) {
          setPage(data.totalPages || 1);
        }
      } catch (err) {
        if (!cancelled) {
          setError(getError(err));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadProjects();

    return () => {
      cancelled = true;
    };
  }, [page, debouncedSearch, filter, refreshKey]);

  // Fetch tasks only once instead of on every page change
  useEffect(() => {
    let cancelled = false;

    const loadTasks = async () => {
      try {
        const response = await api.get("/tasks");

        if (!cancelled) {
          setTasks(response.data.tasks || []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(getError(err));
        }
      }
    };

    loadTasks();

    return () => {
      cancelled = true;
    };
  }, []);

  // Calculate task statistics in one pass: O(projects + tasks)
  const projectStats = useMemo(() => {
    const result = {};

    for (const project of projects) {
      result[project._id] = {
        total: 0,
        completed: 0,
        progress: 0,
      };
    }

    for (const task of tasks) {
      const projectId = task.project?._id || task.project;

      if (!projectId || !result[projectId]) continue;

      result[projectId].total += 1;

      if (task.status === "Completed") {
        result[projectId].completed += 1;
      }
    }

    for (const stats of Object.values(result)) {
      stats.progress = stats.total
        ? Math.round((stats.completed / stats.total) * 100)
        : 0;
    }

    return result;
  }, [projects, tasks]);

  // These status counts represent the currently displayed page
  const activeProjects = projects.filter(
    (project) => project.status === "In Progress",
  ).length;

  const completedProjects = projects.filter(
    (project) => project.status === "Completed",
  ).length;

  // Visible page numbers
  const pageNumbers = useMemo(() => {
    const totalPages = pagination.totalPages;

    if (!totalPages) return [];

    const start = Math.max(1, Math.min(page - 2, totalPages - 4));
    const end = Math.min(totalPages, start + 4);

    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  }, [page, pagination.totalPages]);

  const openCreateModal = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEditModal = (project) => {
    setEditingId(project._id);

    setForm({
      name: project.name || "",
      description: project.description || "",
      status: project.status || "Planning",
      priority: project.priority || "Medium",
      deadline: dateForInput(project.deadline),
    });

    setShowModal(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!form.name.trim()) return;

    setSaving(true);
    setError("");

    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      status: form.status,
      priority: form.priority,
      deadline: form.deadline || null,
    };

    try {
      if (editingId) {
        await api.put(`/projects/${editingId}`, payload);
      } else {
        await api.post("/projects", payload);
      }

      setShowModal(false);
      setEditingId(null);
      setForm(emptyForm);

      // Newly created projects appear on the first page
      if (!editingId && page !== 1) {
        setPage(1);
      }

      setRefreshKey((current) => current + 1);
    } catch (err) {
      setError(getError(err));
    } finally {
      setSaving(false);
    }
  };

  const deleteProject = async (id) => {
    if (!window.confirm("Delete this project? This action cannot be undone.")) {
      return;
    }

    setError("");

    try {
      await api.delete(`/projects/${id}`);

      // Move to previous page if the deleted project was its only item
      if (projects.length === 1 && page > 1) {
        setPage((current) => current - 1);
      } else {
        setRefreshKey((current) => current + 1);
      }

      // Remove deleted project's tasks from local state
      setTasks((current) =>
        current.filter((task) => (task.project?._id || task.project) !== id),
      );
    } catch (err) {
      setError(getError(err));
    }
  };

  const changeFilter = (value) => {
    setFilter(value);
    setPage(1);
  };

  return (
    <div className="space-y-7 text-slate-100">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="mb-1 text-sm text-slate-400">Workspace / Projects</p>

          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Projects
          </h1>

          <p className="mt-2 text-sm text-slate-400">
            Manage and track your team's projects.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="flex items-center justify-center gap-2 rounded-xl bg-indigo-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-400"
        >
          <Plus size={18} />
          Create Project
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-300">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />

          <span className="flex-1">{error}</span>

          <button onClick={() => setError("")} aria-label="Dismiss error">
            <X size={17} />
          </button>
        </div>
      )}

      {/* Project Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          ["Total Projects", pagination.total, FolderKanban],
          ["In Progress (page)", activeProjects, Clock3],
          ["Completed (page)", completedProjects, CheckCircle2],
        ].map(([label, value, Icon]) => (
          <div
            key={label}
            className="rounded-2xl border border-white/[0.07] bg-[#111522] p-5"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-400">{label}</p>
              <Icon size={19} className="text-indigo-400" />
            </div>

            <p className="mt-3 text-3xl font-bold">{value}</p>
          </div>
        ))}
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search
            size={18}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
          />

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects..."
            className="w-full rounded-xl border border-white/[0.08] bg-[#111522] py-3 pl-11 pr-4 text-sm outline-none placeholder:text-slate-500 focus:border-indigo-500"
          />
        </div>

        <select
          value={filter}
          onChange={(e) => changeFilter(e.target.value)}
          className="rounded-xl border border-white/[0.08] bg-[#111522] px-4 py-3 text-sm text-slate-300 outline-none focus:border-indigo-500"
        >
          <option value="All">All</option>
          <option value="Planning">Planning</option>
          <option value="In Progress">In Progress</option>
          <option value="Completed">Completed</option>
          <option value="On Hold">On Hold</option>
        </select>
      </div>

      {/* Projects List */}
      {loading ? (
        <div className="flex items-center justify-center gap-3 rounded-2xl border border-white/[0.07] bg-[#111522] py-20 text-slate-400">
          <LoaderCircle className="animate-spin" size={21} />
          Loading projects from database...
        </div>
      ) : projects.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-[#111522] py-16 text-center">
          <FolderKanban size={35} className="mx-auto text-slate-600" />

          <h3 className="mt-4 font-semibold">No projects found</h3>

          <p className="mt-1 text-sm text-slate-500">
            {search || filter !== "All"
              ? "Try changing your search or status filter."
              : "Create a project to start organizing your work."}
          </p>

          {!search && filter === "All" && (
            <button
              onClick={openCreateModal}
              className="mt-5 text-sm font-semibold text-indigo-400 hover:text-indigo-300"
            >
              + Create your first project
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            {projects.map((project) => {
              const stats = projectStats[project._id] || {
                total: 0,
                completed: 0,
                progress: 0,
              };

              const memberCount =
                (project.members?.length || 0) + (project.owner ? 1 : 0);

              return (
                <div
                  key={project._id}
                  onClick={() => openProjectChat(project._id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openProjectChat(project._id);
                    }
                  }}
                  className="cursor-pointer rounded-2xl border border-white/[0.07] bg-[#111522] p-5 transition hover:border-indigo-500/50 sm:p-6"
                >
                  {/* Project Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400">
                        <FolderKanban size={21} />
                      </div>

                      <div className="min-w-0">
                        <h3 className="truncate font-semibold">
                          {project.name}
                        </h3>

                        <p className="mt-1 text-xs text-slate-500">
                          {project.priority || "Medium"} priority
                        </p>
                      </div>
                    </div>

                    {/* Edit and Delete */}
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditModal(project);
                        }}
                        title="Edit project"
                        className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white"
                      >
                        <Pencil size={16} />
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteProject(project._id);
                        }}
                        title="Delete project"
                        className="rounded-lg p-2 text-slate-400 hover:bg-rose-500/10 hover:text-rose-400"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="mt-5 min-h-10 text-sm leading-6 text-slate-400">
                    {project.description || "No description added."}
                  </p>

                  {/* Status and Members */}
                  <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-medium ${
                        statusStyles[project.status] || statusStyles.Planning
                      }`}
                    >
                      {project.status}
                    </span>

                    <div className="flex items-center gap-1 text-xs text-slate-500">
                      <Users size={14} />
                      {memberCount} members
                    </div>
                  </div>

                  {/* Task Progress */}
                  <div className="mt-6">
                    <div className="mb-2 flex justify-between text-xs">
                      <span className="text-slate-400">
                        Task completion ({stats.completed}/{stats.total})
                      </span>

                      <span className="font-semibold text-slate-200">
                        {stats.progress}%
                      </span>
                    </div>

                    <div className="h-2 overflow-hidden rounded-full bg-white/[0.07]">
                      <div
                        className="h-full rounded-full bg-indigo-500 transition-all"
                        style={{ width: `${stats.progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Deadline and Created Date */}
                  <div className="mt-5 flex items-center justify-between border-t border-white/[0.06] pt-4">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <CalendarDays size={14} />

                      {project.deadline
                        ? new Date(project.deadline).toLocaleDateString()
                        : "No deadline"}
                    </div>

                    <span className="text-xs text-slate-500">
                      Created {new Date(project.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  {/* Open Project Chat */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openProjectChat(project._id);
                    }}
                    className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-indigo-500/20 bg-indigo-500/10 py-3 text-sm font-semibold text-indigo-300 transition hover:bg-indigo-500/20"
                  >
                    <MessageSquare size={17} />
                    Open Project Chat
                  </button>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex flex-col items-center justify-between gap-4 rounded-2xl border border-white/[0.07] bg-[#111522] p-4 sm:flex-row">
              <p className="text-sm text-slate-400">
                Showing{" "}
                <span className="font-semibold text-slate-200">
                  {(page - 1) * PAGE_SIZE + 1}
                </span>
                {" - "}
                <span className="font-semibold text-slate-200">
                  {Math.min(page * PAGE_SIZE, pagination.total)}
                </span>
                {" of "}
                <span className="font-semibold text-slate-200">
                  {pagination.total}
                </span>
                {" projects"}
              </p>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((current) => current - 1)}
                  disabled={!pagination.hasPrevPage || loading}
                  aria-label="Previous page"
                  className="rounded-lg border border-white/10 p-2 text-slate-300 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <ChevronLeft size={18} />
                </button>

                {pageNumbers.map((number) => (
                  <button
                    key={number}
                    onClick={() => setPage(number)}
                    disabled={loading}
                    className={`h-9 min-w-9 rounded-lg px-3 text-sm font-medium transition ${
                      page === number
                        ? "bg-indigo-500 text-white"
                        : "text-slate-400 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    {number}
                  </button>
                ))}

                <button
                  onClick={() => setPage((current) => current + 1)}
                  disabled={!pagination.hasNextPage || loading}
                  aria-label="Next page"
                  className="rounded-lg border border-white/10 p-2 text-slate-300 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Create / Edit Project Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm">
          <div className="my-auto w-full max-w-lg rounded-2xl border border-white/10 bg-[#151a29] p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">
                  {editingId ? "Edit Project" : "Create Project"}
                </h2>

                <p className="mt-1 text-sm text-slate-400">
                  Project details are saved to MongoDB.
                </p>
              </div>

              <button
                onClick={() => setShowModal(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Project Name */}
              <div>
                <label className="mb-2 block text-sm text-slate-300">
                  Project name *
                </label>

                <input
                  required
                  maxLength={100}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. CollabX"
                  className="w-full rounded-xl border border-white/10 bg-[#0c101b] px-4 py-3 text-sm outline-none focus:border-indigo-500"
                />
              </div>

              {/* Description */}
              <div>
                <label className="mb-2 block text-sm text-slate-300">
                  Description
                </label>

                <textarea
                  rows={3}
                  maxLength={1000}
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  placeholder="What is this project about?"
                  className="w-full resize-none rounded-xl border border-white/10 bg-[#0c101b] px-4 py-3 text-sm outline-none focus:border-indigo-500"
                />
              </div>

              {/* Status and Priority */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm text-slate-300">
                    Status
                  </label>

                  <select
                    value={form.status}
                    onChange={(e) =>
                      setForm({ ...form, status: e.target.value })
                    }
                    className="w-full rounded-xl border border-white/10 bg-[#0c101b] px-3 py-3 text-sm outline-none focus:border-indigo-500"
                  >
                    <option>Planning</option>
                    <option>In Progress</option>
                    <option>Completed</option>
                    <option>On Hold</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm text-slate-300">
                    Priority
                  </label>

                  <select
                    value={form.priority}
                    onChange={(e) =>
                      setForm({ ...form, priority: e.target.value })
                    }
                    className="w-full rounded-xl border border-white/10 bg-[#0c101b] px-3 py-3 text-sm outline-none focus:border-indigo-500"
                  >
                    <option>Low</option>
                    <option>Medium</option>
                    <option>High</option>
                  </select>
                </div>
              </div>

              {/* Deadline */}
              <div>
                <label className="mb-2 block text-sm text-slate-300">
                  Deadline
                </label>

                <input
                  type="date"
                  value={form.deadline}
                  onChange={(e) =>
                    setForm({ ...form, deadline: e.target.value })
                  }
                  className="w-full rounded-xl border border-white/10 bg-[#0c101b] px-3 py-3 text-sm outline-none focus:border-indigo-500"
                />
              </div>

              {/* Modal Actions */}
              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 rounded-xl border border-white/10 py-3 text-sm font-semibold text-slate-300 hover:bg-white/5"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-500 py-3 text-sm font-semibold text-white hover:bg-indigo-400 disabled:opacity-60"
                >
                  {saving && (
                    <LoaderCircle size={16} className="animate-spin" />
                  )}

                  {saving
                    ? "Saving..."
                    : editingId
                      ? "Save Changes"
                      : "Create Project"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
