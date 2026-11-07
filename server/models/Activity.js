import mongoose from "mongoose";

const activitySchema = new mongoose.Schema(
    {
        project: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Project",
            required: true,
        },

        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        action: {
            type: String,
            required: true,
            enum: [
                "project_created",
                "project_updated",
                "project_deleted",
                "task_created",
                "task_updated",
                "task_completed",
                "task_assigned",
                "team_member_added",
                "team_member_removed",
                "invitation_accepted",
            ],
        },

        description: {
            type: String,
            required: true,
            maxlength: 300,
        },

        entityType: {
            type: String,
            enum: ["Project", "Task", "Team"],
            required: true,
        },

        entityId: {
            type: mongoose.Schema.Types.ObjectId,
            default: null,
        },

        metadata: {
            type: mongoose.Schema.Types.Mixed,
            default: {},
        },
    },
    {
        timestamps: true,
    }
);

activitySchema.index({ project: 1, createdAt: -1 });

const Activity = mongoose.model("Activity", activitySchema);

export default Activity;