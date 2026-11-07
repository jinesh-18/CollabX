
import cron from "node-cron";
import Task from "../models/Task.js";
import Notification from "../models/Notification.js";

let isRunning = false;

const sendTaskNotification = async (io, task, flagField, message) => {
    const recipientId = task.assignedTo || task.createdBy;

    if (!recipientId) return;

    const claimedAt = new Date();

    // Atomically claim this reminder to prevent duplicate notifications.
    const claimedTask = await Task.findOneAndUpdate(
        {
            _id: task._id,
            dueDate: task.dueDate,
            assignedTo: task.assignedTo || null,
            [flagField]: null,
            status: { $ne: "Completed" },
        },
        {
            $set: { [flagField]: claimedAt },
        },
        { new: true }
    );

    if (!claimedTask) return;

    try {
        const notification = await Notification.create({
            recipient: recipientId,
            sender: null,
            project: task.project,
            task: task._id,
            type: "reminder",
            message,
        });

        const populatedNotification = await Notification.findById(
            notification._id
        )
            .populate("sender", "name email")
            .populate("project", "name")
            .populate("task", "title dueDate status");

        // Use the same private room and event as existing live notifications.
        io.to(`user:${String(recipientId)}`).emit(
            "notification:new",
            populatedNotification
        );
    } catch (error) {
        // Allow a retry if notification creation fails.
        await Task.updateOne(
            {
                _id: task._id,
                [flagField]: claimedAt,
            },
            {
                $set: { [flagField]: null },
            }
        );

        throw error;
    }
};

const checkTaskReminders = async (io) => {
    if (isRunning) return;

    isRunning = true;

    try {
        const now = new Date();
        const reminderLimit = new Date(
            now.getTime() + 24 * 60 * 60 * 1000
        );

        // Tasks due within the next 24 hours.
        const upcomingTasks = await Task.find({
            dueDate: {
                $gt: now,
                $lte: reminderLimit,
            },
            status: { $ne: "Completed" },
            reminderSentAt: null,
        }).select(
            "_id title project assignedTo createdBy dueDate status reminderSentAt"
        );

        for (const task of upcomingTasks) {
            await sendTaskNotification(
                io,
                task,
                "reminderSentAt",
                `Reminder: "${task.title}" is due within 24 hours.`
            );
        }

        // Tasks whose deadlines have already passed.
        const overdueTasks = await Task.find({
            dueDate: { $lte: now },
            status: { $ne: "Completed" },
            overdueNotifiedAt: null,
        }).select(
            "_id title project assignedTo createdBy dueDate status overdueNotifiedAt"
        );

        for (const task of overdueTasks) {
            await sendTaskNotification(
                io,
                task,
                "overdueNotifiedAt",
                `Overdue: "${task.title}" has passed its due date.`
            );
        }
    } catch (error) {
        console.error("Task Reminder Job Error:", error);
    } finally {
        isRunning = false;
    }
};

export const startTaskReminderJob = (io) => {
    console.log("Task Reminder Scheduler started.");

    // Run once when the server starts.
    checkTaskReminders(io);

    // Then check every minute.
    cron.schedule("* * * * *", () => {
        checkTaskReminders(io);
    });
};
