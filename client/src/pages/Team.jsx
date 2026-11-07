import { useEffect, useState } from "react";
import {
  Users,
  UserPlus,
  Search,
  Mail,
  Crown,
  Trash2,
  LoaderCircle,
  AlertCircle,
  X,
  ShieldCheck,
  FolderKanban,
  RefreshCw,
  UserRound,
  Clock,
  Copy,
  MessageCircle,
  LogOut,
  ArrowRightLeft,
} from "lucide-react";

import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { getSocket } from "../services/socket";

const getError = (error) =>
  error.response?.data?.message || error.message || "Something went wrong.";

const getId = (value) => {
  if (!value) return null;
  return typeof value === "object" ? value._id || value.id : value;
};

export default function Team() {
  const { user: currentUser } = useAuth();

  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [team, setTeam] = useState(null);
  const [pendingInvitations, setPendingInvitations] = useState([]);

  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [busy, setBusy] = useState(false);

  const [email, setEmail] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const currentUserId = getId(currentUser);

  const selectedProject = projects.find(
    (project) => project._id === selectedProjectId,
  );

  const owner = team?.owner || selectedProject?.owner;
  const members = team?.members || [];

  const isOwner =
    Boolean(currentUserId && owner) &&
    String(currentUserId) === String(getId(owner));

  const loadProjects = async () => {
    setLoadingProjects(true);

    try {
      const response = await api.get("/projects");
      const list = response.data.projects || [];

      setProjects(list);

      if (list.length) {
        const owned = list.find(
          (p) => String(getId(p.owner)) === String(currentUserId),
        );

        setSelectedProjectId((old) =>
          list.some((project) => project._id === old)
            ? old
            : owned?._id || list[0]?._id || "",
        );
      } else {
        setSelectedProjectId("");
      }
    } catch (err) {
      setError(getError(err));
    } finally {
      setLoadingProjects(false);
    }
  };

  const loadTeam = async () => {
    if (!selectedProjectId) return;

    setLoadingTeam(true);

    try {
      const response = await api.get(`/team/${selectedProjectId}`);

      setTeam(response.data.team);
      setPendingInvitations(response.data.pendingInvitations || []);
    } catch (err) {
      setTeam(null);
      setPendingInvitations([]);
      setError(getError(err));
    } finally {
      setLoadingTeam(false);
    }
  };

  useEffect(() => {
    if (currentUserId) loadProjects();
  }, [currentUserId]);

  useEffect(() => {
    setTeam(null);
    setPendingInvitations([]);

    if (selectedProjectId) loadTeam();
  }, [selectedProjectId]);

  // REAL-TIME TEAM UPDATES
  useEffect(() => {
    if (!selectedProjectId) return;

    const socket = getSocket();

    if (!socket) {
      console.warn("Team page: Socket is not initialized.");
      return;
    }

    console.log("Team page listening for real-time updates:", socket.id);

    const handleTeamNotification = async (notification) => {
      const notificationProjectId = getId(notification?.project);

      // Ignore notifications belonging to other projects
      if (
        !notificationProjectId ||
        String(notificationProjectId) !== String(selectedProjectId)
      ) {
        return;
      }

      console.log("Team page received notification:", notification);

      // Refresh team when membership or invitation changes
      const relevantTypes = ["team_added", "team_removed", "team_invitation"];

      if (!relevantTypes.includes(notification.type)) {
        return;
      }

      try {
        const response = await api.get(`/team/${selectedProjectId}`);

        setTeam(response.data.team);
        setPendingInvitations(response.data.pendingInvitations || []);

        console.log("Team updated automatically!");

        if (notification.type === "team_added") {
          setSuccess("Team updated! A new member has joined.");
        }
      } catch (err) {
        console.error("Real-time team refresh failed:", err);
      }
    };

    socket.on("notification:new", handleTeamNotification);

    return () => {
      socket.off("notification:new", handleTeamNotification);
      console.log("Team page socket listener removed.");
    };
  }, [selectedProjectId]);

  const handleSendInvitation = async (event) => {
    event.preventDefault();

    if (!email.trim()) return;

    setBusy(true);
    setError("");
    setSuccess("");

    try {
      const response = await api.post(
        `/team/${selectedProjectId}/invitations`,
        { email: email.trim().toLowerCase() },
      );

      setSuccess(response.data.message);
      setEmail("");

      await loadTeam();
    } catch (err) {
      setError(getError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleCancelInvitation = async (invitation) => {
    if (
      !window.confirm("Cancel this invitation? The old link will stop working.")
    ) {
      return;
    }

    setBusy(true);

    try {
      const response = await api.delete(
        `/team/${selectedProjectId}/invitations/${invitation._id}`,
      );

      setSuccess(response.data.message);
      await loadTeam();
    } catch (err) {
      setError(getError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveMember = async (member) => {
    if (!window.confirm(`Remove ${member.name} from this project?`)) {
      return;
    }

    setBusy(true);

    try {
      const response = await api.delete(
        `/team/${selectedProjectId}/members/${getId(member)}`,
      );

      setSuccess(response.data.message);
      await loadTeam();
    } catch (err) {
      setError(getError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleLeaveProject = async () => {
    if (!window.confirm("Are you sure you want to leave this project?")) {
      return;
    }

    setBusy(true);

    try {
      const response = await api.post(`/team/${selectedProjectId}/leave`);

      setSuccess(response.data.message);

      await loadProjects();
      setTeam(null);
    } catch (err) {
      setError(getError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleTransferOwnership = async () => {
    const eligibleMembers = members.filter(
      (member) => String(getId(member)) !== String(currentUserId),
    );

    if (!eligibleMembers.length) {
      setError("You need at least one existing member to transfer ownership.");
      return;
    }

    const options = eligibleMembers
      .map((member, index) => `${index + 1}. ${member.name} (${member.email})`)
      .join("\n");

    const answer = window.prompt(
      `Enter the number of the new owner:\n\n${options}`,
    );

    if (answer === null) return;

    const index = Number(answer) - 1;

    if (
      !Number.isInteger(index) ||
      index < 0 ||
      index >= eligibleMembers.length
    ) {
      setError("Invalid member selection.");
      return;
    }

    const newOwner = eligibleMembers[index];

    if (
      !window.confirm(
        `Transfer ownership to ${newOwner.name}? You will become a regular member.`,
      )
    ) {
      return;
    }

    setBusy(true);

    try {
      const response = await api.patch(
        `/team/${selectedProjectId}/transfer-ownership`,
        { newOwnerId: getId(newOwner) },
      );

      setSuccess(response.data.message);

      await loadTeam();
      await loadProjects();
    } catch (err) {
      setError(getError(err));
    } finally {
      setBusy(false);
    }
  };

  const copyInvitation = async (url) => {
    try {
      await navigator.clipboard.writeText(url);
      setSuccess("Invitation link copied!");
    } catch {
      setError("Unable to copy link. Please copy it manually.");
    }
  };

  const shareWhatsApp = (url) => {
    const text = `Join my CollabX project: ${url}`;

    window.open(
      `https://wa.me/?text=${encodeURIComponent(text)}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  const filteredMembers = members.filter((member) => {
    const term = search.toLowerCase();

    return (
      member.name?.toLowerCase().includes(term) ||
      member.email?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-7 text-slate-100">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="mb-1 text-sm text-slate-400">Workspace / Team</p>

          <h1 className="text-2xl font-bold sm:text-3xl">Team Members</h1>

          <p className="mt-2 text-sm text-slate-400">
            Manage your project team and collaborate together.
          </p>
        </div>

        <button
          onClick={loadTeam}
          disabled={!selectedProjectId || loadingTeam}
          className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#111522] px-4 py-3 text-sm font-semibold text-slate-300 hover:bg-white/5 disabled:opacity-50"
        >
          <RefreshCw size={16} className={loadingTeam ? "animate-spin" : ""} />
          Refresh Team
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-300">
          <AlertCircle size={18} />
          <span className="flex-1">{error}</span>

          <button onClick={() => setError("")}>
            <X size={17} />
          </button>
        </div>
      )}

      {success && (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-300">
          <ShieldCheck size={18} />
          <span className="flex-1">{success}</span>

          <button onClick={() => setSuccess("")}>
            <X size={17} />
          </button>
        </div>
      )}

      <div className="rounded-2xl border border-white/[0.07] bg-[#111522] p-5">
        <div className="mb-3 flex items-center gap-2">
          <FolderKanban size={18} className="text-indigo-400" />
          <h2 className="font-semibold">Select Project</h2>
        </div>

        {loadingProjects ? (
          <p className="text-sm text-slate-400">Loading projects...</p>
        ) : projects.length === 0 ? (
          <p className="text-sm text-slate-400">
            No projects found. Create a project first.
          </p>
        ) : (
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-[#0c101b] px-4 py-3 text-sm text-slate-200"
          >
            {projects.map((project) => (
              <option key={project._id} value={project._id}>
                {project.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {selectedProjectId && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/[0.07] bg-[#111522] p-5">
              <p className="text-sm text-slate-400">Total Team Members</p>

              <p className="mt-3 text-3xl font-bold">
                {team?.totalMembers ?? 0}
              </p>
            </div>

            <div className="rounded-2xl border border-white/[0.07] bg-[#111522] p-5">
              <p className="text-sm text-slate-400">Project Owner</p>

              <p className="mt-3 text-xl font-bold">
                {owner?.name || "Loading..."}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-white/[0.07] bg-[#111522] p-5 sm:p-6">
            <div className="mb-5 flex items-center gap-3">
              <UserPlus size={20} className="text-indigo-400" />

              <div>
                <h2 className="font-semibold">Invite Team Member</h2>

                <p className="mt-1 text-xs text-slate-500">
                  Invite a registered CollabX user.
                </p>
              </div>
            </div>

            {isOwner ? (
              <form
                onSubmit={handleSendInvitation}
                className="flex flex-col gap-3 sm:flex-row"
              >
                <div className="relative flex-1">
                  <Mail
                    size={17}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
                  />

                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter registered user's email"
                    className="w-full rounded-xl border border-white/10 bg-[#0c101b] py-3 pl-11 pr-4 text-sm outline-none focus:border-indigo-500"
                  />
                </div>

                <button
                  disabled={busy || !email.trim()}
                  className="flex items-center justify-center gap-2 rounded-xl bg-indigo-500 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {busy ? (
                    <LoaderCircle className="animate-spin" size={17} />
                  ) : (
                    <UserPlus size={17} />
                  )}
                  Send Invitation
                </button>
              </form>
            ) : (
              <p className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-300">
                Only the project owner can invite members.
              </p>
            )}
          </div>

          {isOwner && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold">Pending Invitations</h2>

              {pendingInvitations.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 bg-[#111522] p-6 text-sm text-slate-400">
                  No pending invitations.
                </div>
              ) : (
                pendingInvitations.map((invitation) => (
                  <div
                    key={invitation._id}
                    className="flex flex-col gap-4 rounded-xl border border-white/10 bg-[#111522] p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-medium">
                        {invitation.recipient?.name}
                      </p>

                      <p className="text-sm text-slate-400">
                        {invitation.recipient?.email}
                      </p>

                      <span className="mt-2 inline-flex items-center gap-1 text-xs text-amber-300">
                        <Clock size={13} /> Pending
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => copyInvitation(invitation.invitationUrl)}
                        className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs hover:bg-white/5"
                      >
                        <Copy size={14} /> Copy Link
                      </button>

                      <button
                        onClick={() => shareWhatsApp(invitation.invitationUrl)}
                        className="flex items-center gap-2 rounded-lg bg-green-600/15 px-3 py-2 text-xs text-green-300 hover:bg-green-600/25"
                      >
                        <MessageCircle size={14} /> WhatsApp
                      </button>

                      <button
                        disabled={busy}
                        onClick={() => handleCancelInvitation(invitation)}
                        className="flex items-center gap-2 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-300 hover:bg-rose-500/20"
                      >
                        <X size={14} /> Cancel
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          <div className="space-y-4">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-xl font-bold">Your Team</h2>

                <p className="mt-1 text-sm text-slate-400">
                  People working on this project.
                </p>
              </div>

              <div className="relative">
                <Search
                  size={17}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                />

                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search members..."
                  className="w-full rounded-xl border border-white/10 bg-[#111522] py-2.5 pl-9 pr-3 text-sm outline-none sm:w-64"
                />
              </div>
            </div>

            {loadingTeam ? (
              <div className="flex items-center justify-center gap-3 rounded-2xl bg-[#111522] py-16 text-slate-400">
                <LoaderCircle className="animate-spin" size={21} />
                Loading team...
              </div>
            ) : (
              team && (
                <div className="space-y-3">
                  {owner && (
                    <div className="flex flex-col justify-between gap-4 rounded-2xl border border-amber-500/20 bg-[#111522] p-5 sm:flex-row sm:items-center">
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 text-lg font-bold text-amber-300">
                          {owner.name?.charAt(0)?.toUpperCase() || "O"}
                        </div>

                        <div>
                          <h3 className="font-semibold">{owner.name}</h3>

                          <p className="text-sm text-slate-400">
                            {owner.email}
                          </p>
                        </div>
                      </div>

                      <span className="flex w-fit items-center gap-2 rounded-full bg-amber-500/10 px-3 py-1.5 text-xs text-amber-300">
                        <Crown size={14} /> Project Owner
                      </span>
                    </div>
                  )}

                  {filteredMembers.map((member) => (
                    <div
                      key={getId(member)}
                      className="flex flex-col justify-between gap-4 rounded-2xl border border-white/[0.07] bg-[#111522] p-5 sm:flex-row sm:items-center"
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-500/10 text-lg font-bold text-indigo-300">
                          {member.name?.charAt(0)?.toUpperCase() || "U"}
                        </div>

                        <div>
                          <h3 className="font-semibold">{member.name}</h3>

                          <p className="text-sm text-slate-400">
                            {member.email}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-indigo-500/10 px-3 py-1.5 text-xs text-indigo-300">
                          Member
                        </span>

                        {isOwner && (
                          <>
                            <button
                              title="Make project owner"
                              onClick={() => {
                                if (
                                  window.confirm(
                                    `Transfer ownership to ${member.name}?`,
                                  )
                                ) {
                                  api
                                    .patch(
                                      `/team/${selectedProjectId}/transfer-ownership`,
                                      {
                                        newOwnerId: getId(member),
                                      },
                                    )
                                    .then(async (response) => {
                                      setSuccess(response.data.message);
                                      await loadTeam();
                                      await loadProjects();
                                    })
                                    .catch((err) => setError(getError(err)));
                                }
                              }}
                              className="rounded-lg p-2.5 text-slate-400 hover:bg-amber-500/10 hover:text-amber-300"
                            >
                              <ArrowRightLeft size={17} />
                            </button>

                            <button
                              title="Remove member"
                              onClick={() => handleRemoveMember(member)}
                              className="rounded-lg p-2.5 text-slate-400 hover:bg-rose-500/10 hover:text-rose-400"
                            >
                              <Trash2 size={17} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}

                  {filteredMembers.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-white/10 bg-[#111522] py-12 text-center">
                      <UserRound size={32} className="mx-auto text-slate-600" />

                      <p className="mt-3 font-medium">
                        {members.length
                          ? "No matching members"
                          : "No accepted team members yet"}
                      </p>
                    </div>
                  )}
                </div>
              )
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            {isOwner ? (
              <button
                onClick={handleTransferOwnership}
                disabled={busy || members.length === 0}
                className="flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-300 disabled:opacity-50"
              >
                <ArrowRightLeft size={16} />
                Transfer Ownership
              </button>
            ) : (
              <button
                onClick={handleLeaveProject}
                disabled={busy}
                className="flex items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300"
              >
                <LogOut size={16} />
                Leave Project
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
