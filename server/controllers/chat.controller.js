
import mongoose from "mongoose";
import Project from "../models/Project.js";
import ChatMessage from "../models/ChatMessage.js";

const validId = (id) =>
    typeof id === "string" && /^[0-9a-fA-F]{24}$/.test(id);

const getId = (value) =>
    String(value?._id || value?.id || value || "");

const hasAccess = (project, userId) => {
    const currentUserId = String(userId);

    const isOwner = getId(project.owner) === currentUserId;

    const isMember = (project.members || []).some(
        (member) => getId(member) === currentUserId
    );

    return isOwner || isMember;
};

const getProjectRecipients = (project) => {
    const recipientIds = new Set([
        getId(project.owner),
        ...(project.members || []).map(getId),
    ]);

    return [...recipientIds]
        .filter(Boolean)
        .map((id) => `user:${id}`);
};

const emitToProject = (req, project, event, data) => {
    const io = req.app.get("io");

    if (io) {
        io.to(getProjectRecipients(project)).emit(event, data);
    }
};

// GET CHAT HISTORY
export const getChatMessages = async (req, res) => {
    try {
        const { projectId } = req.params;
        const userId = req.user.id;

        if (!validId(projectId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid project ID",
            });
        }

        const project = await Project.findById(projectId);

        if (!project) {
            return res.status(404).json({
                success: false,
                message: "Project not found",
            });
        }

        if (!hasAccess(project, userId)) {
            return res.status(403).json({
                success: false,
                message: "You do not have access to this project chat",
            });
        }

        const messages = await ChatMessage.find({
            project: projectId,
            hiddenFor: { $ne: userId },
        })
            .populate("sender", "name email")
            .sort({ createdAt: -1 })
            .limit(100)
            .lean();

        messages.reverse();

        return res.json({
            success: true,
            count: messages.length,
            messages,
        });
    } catch (error) {
        console.error("getChatMessages:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to load chat messages",
        });
    }
};

// SEND CHAT MESSAGE
export const sendChatMessage = async (req, res) => {
    try {
        const { projectId } = req.params;
        const userId = req.user.id;

        const content =
            typeof req.body?.content === "string"
                ? req.body.content.trim()
                : "";

        if (!validId(projectId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid project ID",
            });
        }

        if (!content) {
            return res.status(400).json({
                success: false,
                message: "Message cannot be empty",
            });
        }

        if (content.length > 2000) {
            return res.status(400).json({
                success: false,
                message: "Message cannot exceed 2000 characters",
            });
        }

        const project = await Project.findById(projectId);

        if (!project) {
            return res.status(404).json({
                success: false,
                message: "Project not found",
            });
        }

        if (!hasAccess(project, userId)) {
            return res.status(403).json({
                success: false,
                message: "You do not have permission to send messages",
            });
        }

        const message = await ChatMessage.create({
            project: project._id,
            sender: userId,
            content,
        });

        const populatedMessage = await ChatMessage.findById(message._id)
            .populate("sender", "name email")
            .lean();

        emitToProject(req, project, "chat:message:new", populatedMessage);

        return res.status(201).json({
            success: true,
            message: "Message sent successfully",
            data: populatedMessage,
        });
    } catch (error) {
        console.error("sendChatMessage:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to send message",
        });
    }
};

// EDIT OWN MESSAGE
export const editChatMessage = async (req, res) => {
    try {
        const { projectId, messageId } = req.params;
        const userId = req.user.id;

        const content =
            typeof req.body?.content === "string"
                ? req.body.content.trim()
                : "";

        if (!validId(projectId) || !validId(messageId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid project or message ID",
            });
        }

        if (!content) {
            return res.status(400).json({
                success: false,
                message: "Message cannot be empty",
            });
        }

        if (content.length > 2000) {
            return res.status(400).json({
                success: false,
                message: "Message cannot exceed 2000 characters",
            });
        }

        const project = await Project.findById(projectId);

        if (!project) {
            return res.status(404).json({
                success: false,
                message: "Project not found",
            });
        }

        if (!hasAccess(project, userId)) {
            return res.status(403).json({
                success: false,
                message: "You do not have access to this project chat",
            });
        }

        const message = await ChatMessage.findOne({
            _id: messageId,
            project: projectId,
        });

        if (!message) {
            return res.status(404).json({
                success: false,
                message: "Message not found",
            });
        }

        if (getId(message.sender) !== String(userId)) {
            return res.status(403).json({
                success: false,
                message: "You can only edit your own messages",
            });
        }

        if (message.isDeleted) {
            return res.status(400).json({
                success: false,
                message: "Deleted messages cannot be edited",
            });
        }

        message.content = content;
        message.editedAt = new Date();

        await message.save();

        const updatedMessage = await ChatMessage.findById(message._id)
            .populate("sender", "name email")
            .lean();

        emitToProject(
            req,
            project,
            "chat:message:updated",
            updatedMessage
        );

        return res.json({
            success: true,
            message: "Message updated successfully",
            data: updatedMessage,
        });
    } catch (error) {
        console.error("editChatMessage:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to edit message",
        });
    }
};

// DELETE MESSAGE
// mode=everyone -> soft-delete for all project members
// mode=me       -> hide only for the current user
export const deleteChatMessage = async (req, res) => {
    try {
        const { projectId, messageId } = req.params;
        const userId = req.user.id;
        const mode = req.query.mode;

        if (!validId(projectId) || !validId(messageId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid project or message ID",
            });
        }

        if (!["me", "everyone"].includes(mode)) {
            return res.status(400).json({
                success: false,
                message: "Invalid delete mode",
            });
        }

        const project = await Project.findById(projectId);

        if (!project) {
            return res.status(404).json({
                success: false,
                message: "Project not found",
            });
        }

        if (!hasAccess(project, userId)) {
            return res.status(403).json({
                success: false,
                message: "You do not have access to this project chat",
            });
        }

        const message = await ChatMessage.findOne({
            _id: messageId,
            project: projectId,
        });

        if (!message) {
            return res.status(404).json({
                success: false,
                message: "Message not found",
            });
        }

        if (mode === "everyone") {
            // Only the original sender can delete for everyone
            if (getId(message.sender) !== String(userId)) {
                return res.status(403).json({
                    success: false,
                    message: "You can only delete your own message for everyone",
                });
            }

            if (!message.isDeleted) {
                message.content = "This message was deleted";
                message.isDeleted = true;
                message.deletedAt = new Date();

                await message.save();
            }

            const deletedMessage = await ChatMessage.findById(message._id)
                .populate("sender", "name email")
                .lean();

            emitToProject(
                req,
                project,
                "chat:message:deleted",
                deletedMessage
            );

            return res.json({
                success: true,
                message: "Message deleted for everyone",
                data: deletedMessage,
            });
        }

        // Hide only for the current user
        await ChatMessage.updateOne(
            { _id: messageId, project: projectId },
            { $addToSet: { hiddenFor: new mongoose.Types.ObjectId(userId) } }
        );

        const io = req.app.get("io");

        if (io) {
            io.to(`user:${userId}`).emit("chat:message:hidden", {
                project: projectId,
                messageId,
            });
        }

        return res.json({
            success: true,
            message: "Message deleted for you",
            data: { messageId },
        });
    } catch (error) {
        console.error("deleteChatMessage:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to delete message",
        });
    }
};
