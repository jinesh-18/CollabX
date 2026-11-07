
import Notification from "../models/Notification.js";

const validId = (id) =>
    typeof id === "string" && /^[0-9a-fA-F]{24}$/.test(id);

// GET MY NOTIFICATIONS
export const getNotifications = async (req, res) => {
    try {
        const notifications = await Notification.find({
            recipient: req.user.id,
        })
            .populate("sender", "name email")
            .populate("project", "name")
            .populate("task", "title")
            .populate("invitation", "status")
            .sort({ createdAt: -1 })
            .limit(50);

        const unreadCount = await Notification.countDocuments({
            recipient: req.user.id,
            isRead: false,
        });

        return res.status(200).json({
            success: true,
            unreadCount,
            count: notifications.length,
            notifications,
        });
    } catch (error) {
        console.error("Notifications Error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to load notifications",
        });
    }
};

// MARK ONE AS READ
export const markNotificationRead = async (req, res) => {
    try {
        const { id } = req.params;

        if (!validId(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid notification ID",
            });
        }

        const notification = await Notification.findOneAndUpdate(
            {
                _id: id,
                recipient: req.user.id,
            },
            { isRead: true },
            { new: true }
        );

        if (!notification) {
            return res.status(404).json({
                success: false,
                message: "Notification not found",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Notification marked as read",
            notification,
        });
    } catch (error) {
        console.error("Mark Notification Error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to update notification",
        });
    }
};

// MARK ALL AS READ
export const markAllNotificationsRead = async (req, res) => {
    try {
        await Notification.updateMany(
            { recipient: req.user.id, isRead: false },
            { isRead: true }
        );

        return res.status(200).json({
            success: true,
            message: "All notifications marked as read",
        });
    } catch (error) {
        console.error("Mark All Notifications Error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to update notifications",
        });
    }
};

// DELETE NOTIFICATION
export const deleteNotification = async (req, res) => {
    try {
        const { id } = req.params;

        if (!validId(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid notification ID",
            });
        }

        const notification = await Notification.findOneAndDelete({
            _id: id,
            recipient: req.user.id,
        });

        if (!notification) {
            return res.status(404).json({
                success: false,
                message: "Notification not found",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Notification deleted successfully",
        });
    } catch (error) {
        console.error("Delete Notification Error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to delete notification",
        });
    }
};
