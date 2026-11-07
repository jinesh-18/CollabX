import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
    {
        recipient: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        sender: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },

        project: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Project",
            default: null,
        },

        task: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Task",
            default: null,
        },

        invitation: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Invitation",
            default: null,
        },

        type: {
            type: String,
            enum: [
                "task_assigned",
                "task_updated",
                "task_completed",
                "team_added",
                "team_removed",
                "team_invitation",
                "reminder",
                "general",
            ],
            default: "general",
        },

        message: {
            type: String,
            required: true,
            trim: true,
            maxlength: 300,
        },

        isRead: {
            type: Boolean,
            default: false,
        },
    },
    { timestamps: true }
);

notificationSchema.index({ recipient: 1, createdAt: -1 });

const Notification = mongoose.model("Notification", notificationSchema);

export default Notification;