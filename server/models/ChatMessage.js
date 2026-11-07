
import mongoose from "mongoose";

const chatMessageSchema = new mongoose.Schema(
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

        content: {
            type: String,
            required: true,
            trim: true,
            maxlength: 2000,
        },

        // Users who have hidden this message from their own chat
        hiddenFor: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
            },
        ],

        // Soft deletion: preserve the message record for everyone
        isDeleted: {
            type: Boolean,
            default: false,
        },

        editedAt: {
            type: Date,
            default: null,
        },

        deletedAt: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

chatMessageSchema.index({ project: 1, createdAt: -1 });

const ChatMessage = mongoose.model("ChatMessage", chatMessageSchema);

export default ChatMessage;
