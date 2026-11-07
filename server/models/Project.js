import mongoose from "mongoose";

const projectSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            maxlength: 100,
        },

        description: {
            type: String,
            trim: true,
            maxlength: 1000,
            default: "",
        },

        status: {
            type: String,
            enum: ["Planning", "In Progress", "Completed", "On Hold"],
            default: "Planning",
        },

        priority: {
            type: String,
            enum: ["Low", "Medium", "High"],
            default: "Medium",
        },

        owner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        members: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
            },
        ],

        deadline: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

// Projects owned by a user, newest first
projectSchema.index({ owner: 1, createdAt: -1 });

// Projects where a user is a member, newest first
projectSchema.index({ members: 1, createdAt: -1 });

const Project = mongoose.model("Project", projectSchema);

export default Project;