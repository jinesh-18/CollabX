import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Search,
  CalendarDays,
  UserRound,
  FolderKanban,
  X,
  Trash2,
  Pencil,
  LoaderCircle,
  AlertCircle,
  CheckCircle2,
  Circle,
  Clock3,
  RefreshCw,
} from "lucide-react";
import api from "../services/api";

const emptyForm = {
  title: "",
  description: "",
  projectId: "",
  assignedTo: "",
  status: "Todo",
  priority: "Medium",
  dueDate: "",
};

const columns = [
  { id: "Todo", label: "To Do", icon: Circle },
  { id: "In Progress", label: "In Progress", icon: Clock3 },
  { id: "In Review", label: "In Review", icon: RefreshCw },
  { id: "Completed", label: "Completed", icon: CheckCircle2 },
];

const priorityStyles = {
  High: "border-rose-500/20 bg-rose-500/10 text-rose-300",
  Medium: "border-amber-500/20 bg-amber-500/10 text-amber-300",
  Low: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
};

const getError = (error) =>
  error.response?.data?.message || error.message || "Something went wrong.";

const dateForInput = (date) => {
  if (!date) return "";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "";
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
};

const getId = (value) =>
  typeof value === "object" && value !== null ? value._id : value;

export default function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [projectFilter, setProjectFilter] = useState("All");
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const loadData = async () => {
    setLoading(true);
    setError("");

    try {
      const [taskResponse, projectResponse] = await Promise.all([
        api.get("/tasks"),
        api.get("/projects"),
      ]);

      setTasks(taskResponse.data.tasks || []);
      setProjects(projectResponse.data.projects || []);
    } catch (err) {
      setError(getError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredTasks = useMemo(() => {
    const term = search.toLowerCase();

    return tasks.filter((task) => {
      const matchesSearch =
        task.title?.toLowerCase().includes(term) ||
        task.description?.toLowerCase().includes(term) ||
        task.project?.name?.toLowerCase().includes(term) ||
        task.assignedTo?.name?.toLowerCase().includes(term);

      const matchesPriority =
        priorityFilter === "All" || task.priority === priorityFilter;

      const matchesProject =
        projectFilter === "All" || getId(task.project) === projectFilter;

      return matchesSearch && matchesPriority && matchesProject;
    });
  }, [tasks, search, priorityFilter, projectFilter]);

  const getProjectMembers = (projectId) => {
    const project = projects.find((item) => item._id === projectId);
    if (!project) return [];

    const people = [
      ...(project.owner ? [project.owner] : []),
      ...(project.members || []),
    ];

    const uniquePeople = new Map();

    people.forEach((person) => {
      if (person?._id) uniquePeople.set(person._id, person);
    });

    return Array.from(uniquePeople.values());
  };

  const openCreateModal = () => {
    setEditingId(null);
    setForm({
      ...emptyForm,
      projectId: projects[0]?._id || "",
    });
    setShowModal(true);
  };

  const openEditModal = (task) => {
    setEditingId(task._id);

    setForm({
      title: task.title || "",
      description: task.description || "",
      projectId: getId(task.project) || "",
      assignedTo: getId(task.assignedTo) || "",
      status: task.status || "Todo",
      priority: task.priority || "Medium",
      dueDate: dateForInput(task.dueDate),
    });

    setShowModal(true);
  };

  const handleProjectChange = (projectId) => {
    setForm((current) => ({
      ...current,
      projectId,
      assignedTo: "",
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!form.title.trim() || !form.projectId) return;

    setSaving(true);
    setError("");

    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      assignedTo: form.assignedTo || null,
      status: form.status,
      priority: form.priority,
      dueDate: form.dueDate || null,
    };

    try {
      if (editingId) {
        await api.put(`/tasks/${editingId}`, payload);
      } else {
        await api.post("/tasks", {
          ...payload,
          projectId: form.projectId,
        });
      }

      setShowModal(false);
      setEditingId(null);
      setForm(emptyForm);

      await loadData();
    } catch (err) {
      setError(getError(err));
    } finally {
      setSaving(false);
    }
  };

  const changeTaskStatus = async (taskId, status) => {
    setError("");

    try {
      const response = await api.put(`/tasks/${taskId}`, { status });

      setTasks((current) =>
        current.map((task) =>
          task._id === taskId ? response.data.task : task,
        ),
      );
    } catch (err) {
      setError(getError(err));
    }
  };

  const deleteTask = async (taskId) => {
    if (!window.confirm("Delete this task permanently?")) return;

    setError("");

    try {
      await api.delete(`/tasks/${taskId}`);

      setTasks((current) => current.filter((task) => task._id !== taskId));
    } catch (err) {
      setError(getError(err));
    }
  };

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(
    (task) => task.status === "Completed",
  ).length;
  const pendingTasks = tasks.filter(
    (task) => task.status !== "Completed",
  ).length;

  return (
    <div className="space-y-7 text-slate-100">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="mb-1 text-sm text-slate-400">Workspace / Tasks</p>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Tasks Board
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Organize tasks, manage priorities and track progress.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          disabled={projects.length === 0}
          className="flex items-center justify-center gap-2 rounded-xl bg-indigo-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus size={18} /> Create Task
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-300">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError("")} aria-label="Dismiss error">
            <X size={17} />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          ["Total Tasks", totalTasks, FolderKanban],
          ["Pending Tasks", pendingTasks, Clock3],
          ["Completed Tasks", completedTasks, CheckCircle2],
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

      <div className="flex flex-col gap-3 lg:flex-row">
        <div className="relative flex-1">
          <Search
            size={18}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks..."
            className="w-full rounded-xl border border-white/[0.08] bg-[#111522] py-3 pl-11 pr-4 text-sm outline-none placeholder:text-slate-500 focus:border-indigo-500"
          />
        </div>

        <select
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          className="rounded-xl border border-white/[0.08] bg-[#111522] px-4 py-3 text-sm text-slate-300 outline-none focus:border-indigo-500"
        >
          <option value="All">All Projects</option>
          {projects.map((project) => (
            <option key={project._id} value={project._id}>
              {project.name}
            </option>
          ))}
        </select>

        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="rounded-xl border border-white/[0.08] bg-[#111522] px-4 py-3 text-sm text-slate-300 outline-none focus:border-indigo-500"
        >
          <option value="All">All Priorities</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-3 rounded-2xl border border-white/[0.07] bg-[#111522] py-20 text-slate-400">
          <LoaderCircle className="animate-spin" size={21} />
          Loading tasks from database...
        </div>
      ) : projects.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-[#111522] py-16 text-center">
          <FolderKanban size={35} className="mx-auto text-slate-600" />
          <h3 className="mt-4 font-semibold">Create a project first</h3>
          <p className="mt-1 text-sm text-slate-500">
            Tasks must belong to a project.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-4">
          {columns.map((column) => {
            const columnTasks = filteredTasks.filter(
              (task) => task.status === column.id,
            );
            const ColumnIcon = column.icon;

            return (
              <div
                key={column.id}
                className="min-h-[350px] rounded-2xl border border-white/[0.07] bg-[#0e1320] p-3"
              >
                <div className="mb-4 flex items-center justify-between px-1 pt-1">
                  <div className="flex items-center gap-2">
                    <ColumnIcon size={17} className="text-indigo-400" />
                    <h3 className="text-sm font-semibold">{column.label}</h3>
                  </div>

                  <span className="rounded-lg bg-white/[0.06] px-2 py-1 text-xs text-slate-400">
                    {columnTasks.length}
                  </span>
                </div>

                <div className="space-y-3">
                  {columnTasks.map((task) => (
                    <div
                      key={task._id}
                      className="rounded-xl border border-white/[0.07] bg-[#151b2a] p-4 transition hover:border-indigo-500/30"
                    >
                      <div className="mb-3 flex items-start justify-between gap-2">
                        <span
                          className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${priorityStyles[task.priority] || priorityStyles.Medium}`}
                        >
                          {task.priority}
                        </span>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openEditModal(task)}
                            title="Edit task"
                            className="rounded-md p-1.5 text-slate-500 hover:bg-white/5 hover:text-white"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => deleteTask(task._id)}
                            title="Delete task"
                            className="rounded-md p-1.5 text-slate-500 hover:bg-rose-500/10 hover:text-rose-400"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      <h4 className="text-sm font-semibold leading-5">
                        {task.title}
                      </h4>

                      <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-400">
                        {task.description || "No description added."}
                      </p>

                      <div className="mt-4 flex items-center gap-1.5 text-xs text-slate-500">
                        <FolderKanban size={13} />
                        <span className="truncate">
                          {task.project?.name || "Project"}
                        </span>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-3">
                        <div className="flex min-w-0 items-center gap-1.5 text-xs text-slate-400">
                          <UserRound size={13} />
                          <span className="truncate">
                            {task.assignedTo?.name || "Unassigned"}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 text-xs text-slate-500">
                          <CalendarDays size={13} />
                          {task.dueDate
                            ? new Date(task.dueDate).toLocaleDateString()
                            : "No date"}
                        </div>
                      </div>

                      <div className="mt-3">
                        <select
                          value={task.status}
                          onChange={(e) =>
                            changeTaskStatus(task._id, e.target.value)
                          }
                          className="w-full rounded-lg border border-white/[0.08] bg-[#0c101b] px-2.5 py-2 text-xs text-slate-300 outline-none focus:border-indigo-500"
                        >
                          {columns.map((item) => (
                            <option key={item.id} value={item.id}>
                              Move to: {item.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}

                  {columnTasks.length === 0 && (
                    <div className="rounded-xl border border-dashed border-white/[0.07] py-10 text-center text-xs text-slate-600">
                      No tasks here
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm">
          <div className="my-auto w-full max-w-lg rounded-2xl border border-white/10 bg-[#151a29] p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">
                  {editingId ? "Edit Task" : "Create Task"}
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  Task details are saved to MongoDB.
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
              <div>
                <label className="mb-2 block text-sm text-slate-300">
                  Task title *
                </label>
                <input
                  required
                  maxLength={150}
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Build authentication API"
                  className="w-full rounded-xl border border-white/10 bg-[#0c101b] px-4 py-3 text-sm outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-slate-300">
                  Description
                </label>
                <textarea
                  rows={3}
                  maxLength={2000}
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  placeholder="Describe what needs to be done..."
                  className="w-full resize-none rounded-xl border border-white/10 bg-[#0c101b] px-4 py-3 text-sm outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-slate-300">
                  Project *
                </label>
                <select
                  required
                  disabled={Boolean(editingId)}
                  value={form.projectId}
                  onChange={(e) => handleProjectChange(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#0c101b] px-3 py-3 text-sm outline-none focus:border-indigo-500 disabled:opacity-60"
                >
                  <option value="">Select a project</option>
                  {projects.map((project) => (
                    <option key={project._id} value={project._id}>
                      {project.name}
                    </option>
                  ))}
                </select>
                {editingId && (
                  <p className="mt-1 text-xs text-slate-500">
                    A task's project cannot be changed after creation.
                  </p>
                )}
              </div>

              <div>
                <label className="mb-2 block text-sm text-slate-300">
                  Assign to
                </label>
                <select
                  value={form.assignedTo}
                  onChange={(e) =>
                    setForm({ ...form, assignedTo: e.target.value })
                  }
                  className="w-full rounded-xl border border-white/10 bg-[#0c101b] px-3 py-3 text-sm outline-none focus:border-indigo-500"
                >
                  <option value="">Unassigned</option>
                  {getProjectMembers(form.projectId).map((person) => (
                    <option key={person._id} value={person._id}>
                      {person.name} ({person.email})
                    </option>
                  ))}
                </select>
              </div>

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
                    {columns.map((column) => (
                      <option key={column.id} value={column.id}>
                        {column.label}
                      </option>
                    ))}
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

              <div>
                <label className="mb-2 block text-sm text-slate-300">
                  Due date
                </label>
                <input
                  type="date"
                  value={form.dueDate}
                  onChange={(e) =>
                    setForm({ ...form, dueDate: e.target.value })
                  }
                  className="w-full rounded-xl border border-white/10 bg-[#0c101b] px-3 py-3 text-sm outline-none focus:border-indigo-500"
                />
              </div>

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
                      : "Create Task"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
