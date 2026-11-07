import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Search,
  Send,
  MessageSquare,
  ArrowLeft,
  LoaderCircle,
  Users,
  FolderKanban,
  AlertCircle,
  MoreVertical,
  Pencil,
  Trash2,
  X,
  Check,
} from "lucide-react";

import api from "../services/api";
import { getSocket } from "../services/socket";
import { useAuth } from "../context/AuthContext";

const getId = (value) => String(value?._id || value?.id || value || "");

const getError = (error) =>
  error.response?.data?.message || error.message || "Something went wrong.";

const formatTime = (date) =>
  new Date(date).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

export default function Chat() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();

  const projectId = searchParams.get("projectId");

  const [projects, setProjects] = useState([]);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");

  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);

  const [error, setError] = useState("");

  const [menuMessageId, setMenuMessageId] = useState(null);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editContent, setEditContent] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingMessageId, setDeletingMessageId] = useState(null);

  const messagesEndRef = useRef(null);

  const currentUserId = getId(user);

  // LOAD PROJECTS
  useEffect(() => {
    const loadProjects = async () => {
      try {
        setError("");

        const response = await api.get("/projects");

        setProjects(response.data.projects || []);
      } catch (err) {
        setError(getError(err));
      } finally {
        setLoadingProjects(false);
      }
    };

    loadProjects();
  }, []);

  // SELECTED PROJECT
  const activeProject = useMemo(
    () => projects.find((project) => project._id === projectId),
    [projects, projectId],
  );

  // SEARCH PROJECTS
  const filteredProjects = useMemo(
    () =>
      projects.filter((project) =>
        project.name?.toLowerCase().includes(search.toLowerCase()),
      ),
    [projects, search],
  );

  // LOAD CHAT HISTORY + SOCKET EVENTS
  useEffect(() => {
    if (!projectId) {
      setMessages([]);
      return;
    }

    let active = true;

    const loadMessages = async () => {
      setLoadingMessages(true);
      setError("");
      setMessages([]);
      setMenuMessageId(null);
      setEditingMessageId(null);

      try {
        const response = await api.get(`/chat/${projectId}/messages`);

        if (active) {
          setMessages(response.data.messages || []);
        }
      } catch (err) {
        if (active) {
          setError(getError(err));
        }
      } finally {
        if (active) {
          setLoadingMessages(false);
        }
      }
    };

    loadMessages();

    // Socket is initialized by AuthContext after authentication.
    const socket = getSocket();

    const isCurrentProject = (item) =>
      String(item.project?._id || item.project) === String(projectId);

    // NEW MESSAGE
    const handleNewMessage = (newMessage) => {
      if (!isCurrentProject(newMessage)) return;

      setMessages((current) => {
        const exists = current.some((item) => item._id === newMessage._id);

        return exists ? current : [...current, newMessage];
      });
    };

    // UPDATED MESSAGE
    const handleUpdatedMessage = (updatedMessage) => {
      if (!isCurrentProject(updatedMessage)) return;

      setMessages((current) =>
        current.map((item) =>
          item._id === updatedMessage._id ? updatedMessage : item,
        ),
      );
    };

    // DELETED MESSAGE
    const handleDeletedMessage = (deletedMessage) => {
      if (!isCurrentProject(deletedMessage)) return;

      setMessages((current) =>
        current.map((item) =>
          item._id === deletedMessage._id ? deletedMessage : item,
        ),
      );

      setMenuMessageId(null);
      setEditingMessageId(null);
    };

    // HIDDEN MESSAGE
    const handleHiddenMessage = (data) => {
      if (String(data.project) !== String(projectId)) return;

      setMessages((current) =>
        current.filter((item) => item._id !== data.messageId),
      );
    };

    // REGISTER SOCKET LISTENERS
    socket?.on("chat:message:new", handleNewMessage);
    socket?.on("chat:message:updated", handleUpdatedMessage);
    socket?.on("chat:message:deleted", handleDeletedMessage);
    socket?.on("chat:message:hidden", handleHiddenMessage);

    // CLEANUP
    return () => {
      active = false;

      socket?.off("chat:message:new", handleNewMessage);
      socket?.off("chat:message:updated", handleUpdatedMessage);
      socket?.off("chat:message:deleted", handleDeletedMessage);
      socket?.off("chat:message:hidden", handleHiddenMessage);
    };
  }, [projectId]);

  // SCROLL TO LATEST MESSAGE
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages]);

  // SELECT PROJECT
  const selectProject = (id) => {
    setSearchParams({ projectId: id });
    setSearch("");
    setError("");
  };

  // SEND MESSAGE
  const sendMessage = async (event) => {
    event.preventDefault();

    const content = message.trim();

    if (!content || !projectId || sending) return;

    setSending(true);
    setError("");

    try {
      const response = await api.post(`/chat/${projectId}/messages`, {
        content,
      });

      const savedMessage = response.data.data;

      setMessages((current) => {
        const exists = current.some((item) => item._id === savedMessage._id);

        return exists ? current : [...current, savedMessage];
      });

      setMessage("");
    } catch (err) {
      setError(getError(err));
    } finally {
      setSending(false);
    }
  };

  // START EDITING
  const startEditing = (item) => {
    setEditingMessageId(item._id);
    setEditContent(item.content);
    setMenuMessageId(null);
  };

  // SAVE EDITED MESSAGE
  const saveEdit = async (messageId) => {
    const content = editContent.trim();

    if (!content || savingEdit) return;

    setSavingEdit(true);
    setError("");

    try {
      const response = await api.patch(
        `/chat/${projectId}/messages/${messageId}`,
        { content },
      );

      const updatedMessage = response.data.data;

      setMessages((current) =>
        current.map((item) => (item._id === messageId ? updatedMessage : item)),
      );

      setEditingMessageId(null);
      setEditContent("");
    } catch (err) {
      setError(getError(err));
    } finally {
      setSavingEdit(false);
    }
  };

  // CANCEL EDITING
  const cancelEditing = () => {
    setEditingMessageId(null);
    setEditContent("");
  };

  // DELETE MESSAGE FOR ME OR EVERYONE
  const deleteMessage = async (item, mode) => {
    if (deletingMessageId) return;

    const confirmation =
      mode === "everyone"
        ? "Delete this message for everyone? This cannot be undone."
        : "Delete this message from your chat?";

    if (!window.confirm(confirmation)) return;

    setDeletingMessageId(item._id);
    setMenuMessageId(null);
    setError("");

    try {
      const response = await api.delete(
        `/chat/${projectId}/messages/${item._id}?mode=${mode}`,
      );

      if (mode === "me") {
        setMessages((current) =>
          current.filter((message) => message._id !== item._id),
        );
      } else {
        const deletedMessage = response.data.data;

        setMessages((current) =>
          current.map((message) =>
            message._id === item._id ? deletedMessage : message,
          ),
        );
      }
    } catch (err) {
      setError(getError(err));
    } finally {
      setDeletingMessageId(null);
    }
  };

  // BACK TO PROJECT LIST
  const goBack = () => {
    setSearchParams({});
  };

  return (
    <div className="space-y-6 text-slate-100">
      <div>
        <p className="mb-1 text-sm text-slate-400">Workspace / Messages</p>

        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Project Chat
        </h1>

        <p className="mt-2 text-sm text-slate-400">
          Communicate with your project team in real time.
        </p>
      </div>

      {/* ERROR MESSAGE */}
      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-300">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />

          <span className="flex-1">{error}</span>

          <button onClick={() => setError("")}>Dismiss</button>
        </div>
      )}

      <div className="grid min-h-[600px] grid-cols-1 overflow-hidden rounded-2xl border border-white/[0.07] bg-[#111522] lg:grid-cols-[300px_1fr]">
        {/* PROJECT LIST */}
        <aside
          className={`${
            projectId ? "hidden lg:flex" : "flex"
          } min-h-0 flex-col border-r border-white/[0.07]`}
        >
          <div className="border-b border-white/[0.07] p-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold">Your Projects</h2>

              <span className="rounded-full bg-indigo-500/10 px-2.5 py-1 text-xs text-indigo-300">
                {projects.length}
              </span>
            </div>

            <div className="relative">
              <Search
                size={17}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
              />

              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search projects..."
                className="w-full rounded-xl border border-white/[0.07] bg-[#0c101b] py-2.5 pl-10 pr-3 text-sm outline-none placeholder:text-slate-500 focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto p-3">
            {loadingProjects ? (
              <div className="flex justify-center py-10 text-slate-400">
                <LoaderCircle className="animate-spin" />
              </div>
            ) : filteredProjects.length ? (
              filteredProjects.map((project) => (
                <button
                  key={project._id}
                  onClick={() => selectProject(project._id)}
                  className={`flex w-full items-center gap-3 rounded-xl p-3 text-left transition ${
                    projectId === project._id
                      ? "bg-indigo-500/10"
                      : "hover:bg-white/[0.04]"
                  }`}
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400">
                    <FolderKanban size={20} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {project.name}
                    </p>

                    <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                      <Users size={12} />
                      {(project.members?.length || 0) + 1} members
                    </p>
                  </div>
                </button>
              ))
            ) : (
              <p className="py-8 text-center text-sm text-slate-500">
                No projects found.
              </p>
            )}
          </div>
        </aside>

        {/* CHAT AREA */}
        <section
          className={`${
            projectId ? "flex" : "hidden lg:flex"
          } min-h-[600px] min-w-0 flex-col`}
        >
          {projectId && activeProject ? (
            <>
              {/* CHAT HEADER */}
              <header className="flex items-center gap-3 border-b border-white/[0.07] px-4 py-4">
                <button
                  onClick={goBack}
                  className="rounded-lg p-2 text-slate-400 hover:bg-white/5 lg:hidden"
                >
                  <ArrowLeft size={19} />
                </button>

                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400">
                  <FolderKanban size={20} />
                </div>

                <div className="min-w-0">
                  <h2 className="truncate text-sm font-semibold">
                    {activeProject.name}
                  </h2>

                  <p className="text-xs text-slate-500">
                    Project team conversation
                  </p>
                </div>
              </header>

              {/* MESSAGES */}
              <div className="flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
                <div className="py-2 text-center">
                  <span className="rounded-full bg-white/[0.05] px-3 py-1 text-[10px] text-slate-500">
                    Project conversation
                  </span>
                </div>

                {loadingMessages ? (
                  <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-400">
                    <LoaderCircle size={18} className="animate-spin" />
                    Loading messages...
                  </div>
                ) : messages.length === 0 ? (
                  <div className="py-16 text-center">
                    <MessageSquare
                      size={35}
                      className="mx-auto text-slate-600"
                    />

                    <p className="mt-3 text-sm text-slate-400">
                      No messages yet.
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      Start the conversation with your team!
                    </p>
                  </div>
                ) : (
                  messages.map((item) => {
                    const senderId = getId(item.sender);
                    const isMine = senderId === currentUserId;
                    const isEditing = editingMessageId === item._id;
                    const isDeleted = item.isDeleted;

                    return (
                      <div
                        key={item._id}
                        className={`flex ${
                          isMine ? "justify-end" : "justify-start"
                        }`}
                      >
                        <div
                          className={`flex max-w-[90%] flex-col sm:max-w-[80%] ${
                            isMine ? "items-end" : "items-start"
                          }`}
                        >
                          {!isMine && (
                            <span className="mb-1 ml-1 text-[11px] text-slate-500">
                              {item.sender?.name || "Team member"}
                            </span>
                          )}

                          <div className="group relative flex items-start gap-1">
                            <div
                              className={`min-w-[100px] rounded-2xl px-4 py-3 text-sm leading-6 ${
                                isDeleted
                                  ? "border border-white/[0.06] bg-[#171c29] italic text-slate-500"
                                  : isMine
                                    ? "rounded-br-sm bg-indigo-500 text-white"
                                    : "rounded-bl-sm border border-white/[0.06] bg-[#1a2030] text-slate-200"
                              }`}
                            >
                              {isEditing ? (
                                <div className="min-w-[200px] space-y-2">
                                  <textarea
                                    value={editContent}
                                    onChange={(e) =>
                                      setEditContent(e.target.value)
                                    }
                                    maxLength={2000}
                                    rows={3}
                                    autoFocus
                                    className="w-full resize-y rounded-lg border border-white/20 bg-black/20 p-2 text-sm text-white outline-none focus:border-white/50"
                                  />

                                  <div className="flex justify-end gap-2">
                                    <button
                                      type="button"
                                      onClick={cancelEditing}
                                      disabled={savingEdit}
                                      className="rounded-lg p-2 text-white/80 hover:bg-white/10"
                                      title="Cancel"
                                    >
                                      <X size={16} />
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => saveEdit(item._id)}
                                      disabled={
                                        !editContent.trim() || savingEdit
                                      }
                                      className="rounded-lg bg-white/20 p-2 text-white hover:bg-white/30 disabled:opacity-40"
                                      title="Save changes"
                                    >
                                      {savingEdit ? (
                                        <LoaderCircle
                                          size={16}
                                          className="animate-spin"
                                        />
                                      ) : (
                                        <Check size={16} />
                                      )}
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <p className="whitespace-pre-wrap break-words">
                                    {item.content}
                                  </p>

                                  {item.editedAt && !isDeleted && (
                                    <span className="ml-2 text-[10px] opacity-70">
                                      (edited)
                                    </span>
                                  )}
                                </>
                              )}
                            </div>

                            {!isDeleted && !isEditing && (
                              <div className="relative">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setMenuMessageId((current) =>
                                      current === item._id ? null : item._id,
                                    )
                                  }
                                  className="rounded-lg p-1.5 text-slate-500 opacity-100 transition hover:bg-white/10 hover:text-white sm:opacity-0 sm:group-hover:opacity-100"
                                  title="Message options"
                                >
                                  <MoreVertical size={17} />
                                </button>

                                {menuMessageId === item._id && (
                                  <div
                                    className={`absolute top-8 z-20 w-48 overflow-hidden rounded-xl border border-white/10 bg-[#202638] py-1 shadow-xl ${
                                      isMine ? "right-0" : "left-0"
                                    }`}
                                  >
                                    {isMine && (
                                      <button
                                        type="button"
                                        onClick={() => startEditing(item)}
                                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-slate-200 hover:bg-white/10"
                                      >
                                        <Pencil size={15} />
                                        Edit message
                                      </button>
                                    )}

                                    {isMine && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          deleteMessage(item, "everyone")
                                        }
                                        disabled={
                                          deletingMessageId === item._id
                                        }
                                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-rose-300 hover:bg-rose-500/10"
                                      >
                                        <Trash2 size={15} />
                                        Delete for everyone
                                      </button>
                                    )}

                                    <button
                                      type="button"
                                      onClick={() => deleteMessage(item, "me")}
                                      disabled={deletingMessageId === item._id}
                                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-slate-300 hover:bg-white/10"
                                    >
                                      <X size={15} />
                                      Delete for me
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          <span className="mt-1 px-1 text-[10px] text-slate-600">
                            {formatTime(item.createdAt)}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* MESSAGE INPUT */}
              <form
                onSubmit={sendMessage}
                className="border-t border-white/[0.07] p-3 sm:p-4"
              >
                <div className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-[#0c101b] p-2">
                  <input
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Write a message..."
                    maxLength={2000}
                    disabled={sending || loadingMessages}
                    className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm outline-none placeholder:text-slate-500"
                  />

                  <button
                    type="submit"
                    disabled={!message.trim() || sending || loadingMessages}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500 text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {sending ? (
                      <LoaderCircle size={17} className="animate-spin" />
                    ) : (
                      <Send size={17} />
                    )}
                  </button>
                </div>

                <p className="mt-2 text-center text-[10px] text-slate-600">
                  Messages are stored securely in the project chat.
                </p>
              </form>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
              <MessageSquare size={42} className="text-slate-600" />

              <h3 className="mt-4 font-semibold">Select a project</h3>

              <p className="mt-2 max-w-sm text-sm text-slate-500">
                Choose a project from the left to view its conversation and chat
                with your team.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
