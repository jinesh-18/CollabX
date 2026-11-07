import { useEffect, useRef, useState } from "react";

import {
  Bell,
  Check,
  X,
  Trash2,
  CheckCheck,
  LoaderCircle,
  Mail,
  Users,
  Clock,
} from "lucide-react";

import api from "../services/api";

const getError = (error) =>
  error.response?.data?.message || error.message || "Something went wrong.";

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const seenNotificationIds = useRef(new Set());

  const loadData = async () => {
    setError("");

    try {
      const [notificationRes, invitationRes] = await Promise.all([
        api.get("/notifications"),
        api.get("/team/invitations/received"),
      ]);

      const fetchedNotifications = notificationRes.data.notifications || [];

      fetchedNotifications.forEach((notification) => {
        seenNotificationIds.current.add(notification._id);
      });

      setNotifications(fetchedNotifications);

      const count = notificationRes.data.unreadCount || 0;
      setUnreadCount(count);

      window.dispatchEvent(
        new CustomEvent("collabx_unread_count_updated", {
          detail: { count },
        }),
      );

      setInvitations(invitationRes.data.invitations || []);
    } catch (err) {
      setError(getError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const handleNewNotification = (event) => {
      const notification = event.detail?.notification;

      if (!notification?._id) return;

      if (seenNotificationIds.current.has(notification._id)) {
        return;
      }

      seenNotificationIds.current.add(notification._id);

      setNotifications((previous) => [notification, ...previous].slice(0, 50));

      if (!notification.isRead) {
        setUnreadCount((previous) => previous + 1);
      }

      setSuccess("You received a new notification!");

      api
        .get("/team/invitations/received")
        .then((response) => {
          setInvitations(response.data.invitations || []);
        })
        .catch((err) => {
          console.error("Invitation refresh failed:", err.message);
        });
    };

    window.addEventListener(
      "collabx_notification_received",
      handleNewNotification,
    );

    return () => {
      window.removeEventListener(
        "collabx_notification_received",
        handleNewNotification,
      );
    };
  }, []);

  const handleInvitation = async (invitationId, action) => {
    setBusyId(invitationId);
    setError("");
    setSuccess("");

    try {
      const response = await api.patch(
        `/team/invitations/${invitationId}/${action}`,
      );

      setSuccess(response.data.message);
      await loadData();
    } catch (err) {
      setError(getError(err));
      await loadData();
    } finally {
      setBusyId("");
    }
  };

  const markRead = async (notificationId) => {
    try {
      await api.patch(`/notifications/${notificationId}/read`);
      await loadData();

      window.dispatchEvent(new CustomEvent("collabx_notifications_updated"));
    } catch (err) {
      setError(getError(err));
    }
  };

  const markAllRead = async () => {
    try {
      await api.patch("/notifications/read-all");
      await loadData();
      setSuccess("All notifications marked as read.");

      window.dispatchEvent(new CustomEvent("collabx_notifications_updated"));
    } catch (err) {
      setError(getError(err));
    }
  };

  const deleteNotification = async (notificationId) => {
    try {
      await api.delete(`/notifications/${notificationId}`);
      await loadData();

      window.dispatchEvent(new CustomEvent("collabx_notifications_updated"));
    } catch (err) {
      setError(getError(err));
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-64 items-center justify-center gap-3 text-slate-400">
        <LoaderCircle className="animate-spin" size={22} />
        Loading notifications...
      </div>
    );
  }

  return (
    <div className="space-y-7 text-slate-100">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="mb-1 text-sm text-slate-400">Workspace / Updates</p>

          <h1 className="text-2xl font-bold sm:text-3xl">Notifications</h1>

          <p className="mt-2 text-sm text-slate-400">
            Stay updated with your team and projects.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={loadData}
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#111522] px-4 py-3 text-sm text-slate-300 hover:bg-white/5"
          >
            <Bell size={16} /> Refresh
          </button>

          <button
            onClick={markAllRead}
            disabled={unreadCount === 0}
            className="flex items-center gap-2 rounded-xl bg-indigo-500 px-4 py-3 text-sm font-semibold text-white disabled:opacity-40"
          >
            <CheckCheck size={16} /> Mark all read
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-300">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-300">
          {success}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/[0.07] bg-[#111522] p-5">
          <p className="text-sm text-slate-400">Unread notifications</p>
          <p className="mt-2 text-3xl font-bold">{unreadCount}</p>
        </div>

        <div className="rounded-2xl border border-white/[0.07] bg-[#111522] p-5">
          <p className="text-sm text-slate-400">Pending invitations</p>
          <p className="mt-2 text-3xl font-bold">{invitations.length}</p>
        </div>
      </div>

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Users size={19} className="text-indigo-400" />
          <h2 className="text-xl font-bold">Team Invitations</h2>
        </div>

        {invitations.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-[#111522] p-8 text-center">
            <Mail size={30} className="mx-auto text-slate-600" />

            <p className="mt-3 font-medium">No pending invitations</p>

            <p className="mt-1 text-sm text-slate-500">
              New project invitations will appear here.
            </p>
          </div>
        ) : (
          invitations.map((invitation) => (
            <div
              key={invitation._id}
              className="rounded-2xl border border-indigo-500/20 bg-[#111522] p-5"
            >
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                  <p className="font-semibold">
                    {invitation.sender?.name || "A CollabX user"} invited you
                  </p>

                  <p className="mt-1 text-sm text-slate-400">
                    Project: {invitation.project?.name || "Project"}
                  </p>

                  <p className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                    <Clock size={13} />
                    {new Date(invitation.createdAt).toLocaleString()}
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    disabled={busyId === invitation._id}
                    onClick={() => handleInvitation(invitation._id, "accept")}
                    className="flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {busyId === invitation._id ? (
                      <LoaderCircle size={15} className="animate-spin" />
                    ) : (
                      <Check size={15} />
                    )}
                    Accept
                  </button>

                  <button
                    disabled={busyId === invitation._id}
                    onClick={() => handleInvitation(invitation._id, "reject")}
                    className="flex items-center gap-2 rounded-lg bg-rose-500/10 px-4 py-2.5 text-sm text-rose-300 disabled:opacity-50"
                  >
                    <X size={15} /> Reject
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Bell size={19} className="text-indigo-400" />
          <h2 className="text-xl font-bold">All Notifications</h2>
        </div>

        {notifications.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-[#111522] p-8 text-center text-sm text-slate-400">
            You are all caught up. No notifications yet.
          </div>
        ) : (
          notifications.map((notification) => (
            <div
              key={notification._id}
              className={`flex flex-col justify-between gap-4 rounded-xl border p-4 sm:flex-row sm:items-center ${
                notification.isRead
                  ? "border-white/[0.07] bg-[#111522]"
                  : "border-indigo-500/20 bg-indigo-500/[0.06]"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="mt-1 rounded-lg bg-indigo-500/10 p-2 text-indigo-400">
                  <Bell size={17} />
                </div>

                <div>
                  <p className="text-sm text-slate-200">
                    {notification.message}
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    {new Date(notification.createdAt).toLocaleString()}
                  </p>

                  {!notification.isRead && (
                    <span className="mt-2 inline-block rounded-full bg-indigo-500/10 px-2 py-1 text-[10px] text-indigo-300">
                      Unread
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {!notification.isRead && (
                  <button
                    title="Mark as read"
                    onClick={() => markRead(notification._id)}
                    className="rounded-lg p-2 text-slate-400 hover:bg-emerald-500/10 hover:text-emerald-300"
                  >
                    <Check size={17} />
                  </button>
                )}

                <button
                  title="Delete notification"
                  onClick={() => deleteNotification(notification._id)}
                  className="rounded-lg p-2 text-slate-400 hover:bg-rose-500/10 hover:text-rose-300"
                >
                  <Trash2 size={17} />
                </button>
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
