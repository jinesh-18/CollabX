import mongoose from "mongoose";

const invitationSchema = new mongoose.Schema(
    {
        project: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Project",
            required: true,
        },
        sender: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        recipient: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        status: {
            type: String,
            enum: ["Pending", "Accepted", "Rejected", "Cancelled"],
            default: "Pending",
        },
        respondedAt: {
            type: Date,
            default: null,
        },
    },
    { timestamps: true }
);

invitationSchema.index(
    { project: 1, recipient: 1 },
    {
        unique: true,
        partialFilterExpression: { status: "Pending" },
    }
);

export default mongoose.model("Invitation", invitationSchema);