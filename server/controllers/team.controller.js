
import Project from "../models/Project.js";
import User from "../models/User.js";
import Invitation from "../models/Invitation.js";
import Notification from "../models/Notification.js";
import logActivity from "../utils/activityLogger.js";

const validId = (id) =>
    typeof id === "string" && /^[0-9a-fA-F]{24}$/.test(id);

const getId = (value) =>
    String(value?._id || value?.id || value || "");

const isOwner = (project, userId) =>
    getId(project.owner) === String(userId);

const isMember = (project, userId) =>
    project.members.some(
        (member) => getId(member) === String(userId)
    );

const hasAccess = (project, userId) =>
    isOwner(project, userId) || isMember(project, userId);

const invitationUrl = (id) => {
    const base = (process.env.CLIENT_URL || "http://localhost:5173")
        .replace(/\/$/, "");

    return `${base}/notifications?invitation=${id}`;
};

// ==========================================
// REAL-TIME NOTIFICATION HELPER
// ==========================================

const emitNotification = async (req, notificationId, recipientId) => {
    try {
        const io = req.app.get("io");

        if (!io) {
            console.error("Socket.IO instance not found");
            return false;
        }

        const recipient = getId(recipientId);

        if (!recipient) {
            console.error("Invalid notification recipient:", recipientId);
            return false;
        }

        const notification = await Notification.findById(notificationId)
            .populate("sender", "name email")
            .populate("project", "name")
            .populate("invitation", "status");

        if (!notification) {
            console.error("Notification not found:", notificationId);
            return false;
        }

        const room = `user:${recipient}`;

        io.to(room).emit("notification:new", notification);

        console.log("Notification emitted to:", room);

        return true;
    } catch (error) {
        console.error("Socket notification error:", error);
        return false;
    }
};

// ==========================================
// GET PROJECT TEAM
// ==========================================

export const getProjectTeam = async (req, res) => {
    try {
        const { projectId } = req.params;

        if (!validId(projectId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid project ID",
            });
        }

        const project = await Project.findById(projectId)
            .populate("owner", "name email")
            .populate("members", "name email");

        if (!project) {
            return res.status(404).json({
                success: false,
                message: "Project not found",
            });
        }

        if (!hasAccess(project, req.user.id)) {
            return res.status(403).json({
                success: false,
                message: "You do not have access to this project",
            });
        }

        const owner = getId(project.owner) === String(req.user.id);

        const pending = owner
            ? await Invitation.find({
                project: projectId,
                status: "Pending",
            })
                .populate("recipient", "name email")
                .sort({ createdAt: -1 })
            : [];

        return res.json({
            success: true,
            team: {
                owner: project.owner,
                members: project.members,
                totalMembers: project.members.length + 1,
            },
            pendingInvitations: pending.map((item) => ({
                ...item.toObject(),
                invitationUrl: invitationUrl(item._id),
            })),
        });
    } catch (error) {
        console.error("getProjectTeam:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to load team",
        });
    }
};

// ==========================================
// SEND INVITATION
// ==========================================

export const sendInvitation = async (req, res) => {
    let invitation;

    try {
        const { projectId } = req.params;
        const email = req.body.email?.trim().toLowerCase();

        if (!validId(projectId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid project ID",
            });
        }

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({
                success: false,
                message: "Enter a valid email",
            });
        }

        const project = await Project.findById(projectId);

        if (!project) {
            return res.status(404).json({
                success: false,
                message: "Project not found",
            });
        }

        if (!isOwner(project, req.user.id)) {
            return res.status(403).json({
                success: false,
                message: "Only the owner can invite members",
            });
        }

        const recipient = await User.findOne({ email });

        if (!recipient) {
            return res.status(404).json({
                success: false,
                message: "No registered CollabX user found with this email",
            });
        }

        if (getId(recipient) === getId(project.owner)) {
            return res.status(400).json({
                success: false,
                message: "Owner is already part of this project",
            });
        }

        if (isMember(project, recipient._id)) {
            return res.status(409).json({
                success: false,
                message: "User is already a member",
            });
        }

        const existing = await Invitation.findOne({
            project: projectId,
            recipient: recipient._id,
            status: "Pending",
        });

        if (existing) {
            return res.status(409).json({
                success: false,
                message: "An invitation is already pending",
            });
        }

        const sender = await User.findById(req.user.id)
            .select("name email");

        if (!sender) {
            return res.status(401).json({
                success: false,
                message: "Sender account not found",
            });
        }

        invitation = await Invitation.create({
            project: projectId,
            sender: sender._id,
            recipient: recipient._id,
        });

        try {
            const notification = await Notification.create({
                recipient: recipient._id,
                sender: sender._id,
                project: projectId,
                invitation: invitation._id,
                type: "team_invitation",
                message: `${sender.name || "A user"} invited you to join ${project.name}.`,
            });

            await emitNotification(
                req,
                notification._id,
                recipient._id
            );
        } catch (notificationError) {
            await Invitation.findByIdAndDelete(invitation._id);
            throw notificationError;
        }

        return res.status(201).json({
            success: true,
            message: "Invitation sent successfully. The user has been notified.",
            invitation,
            invitationUrl: invitationUrl(invitation._id),
        });
    } catch (error) {
        console.error("sendInvitation:", error);

        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: "An invitation is already pending",
            });
        }

        return res.status(500).json({
            success: false,
            message: "Unable to send invitation",
        });
    }
};

// ==========================================
// CANCEL INVITATION — OWNER ONLY
// ==========================================

export const cancelInvitation = async (req, res) => {
    try {
        const { projectId, invitationId } = req.params;

        if (!validId(projectId) || !validId(invitationId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid ID",
            });
        }

        const project = await Project.findById(projectId);

        if (!project) {
            return res.status(404).json({
                success: false,
                message: "Project not found",
            });
        }

        if (!isOwner(project, req.user.id)) {
            return res.status(403).json({
                success: false,
                message: "Only owner can cancel invitations",
            });
        }

        const invitation = await Invitation.findOneAndUpdate(
            {
                _id: invitationId,
                project: projectId,
                status: "Pending",
            },
            {
                $set: {
                    status: "Cancelled",
                    respondedAt: new Date(),
                },
            },
            { new: true }
        );

        if (!invitation) {
            return res.status(404).json({
                success: false,
                message: "Pending invitation not found",
            });
        }

        await Notification.deleteMany({
            invitation: invitation._id,
            recipient: invitation.recipient,
        });

        return res.json({
            success: true,
            message: "Invitation cancelled successfully",
        });
    } catch (error) {
        console.error("cancelInvitation:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to cancel invitation",
        });
    }
};

// ==========================================
// GET MY RECEIVED INVITATIONS
// ==========================================

export const getMyInvitations = async (req, res) => {
    try {
        const invitations = await Invitation.find({
            recipient: req.user.id,
            status: "Pending",
        })
            .populate("sender", "name email")
            .populate("project", "name description")
            .sort({ createdAt: -1 });

        return res.json({
            success: true,
            count: invitations.length,
            invitations,
        });
    } catch (error) {
        console.error("getMyInvitations:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to load invitations",
        });
    }
};

// ==========================================
// ACCEPT INVITATION
// ==========================================

export const acceptInvitation = async (req, res) => {
    try {
        const { invitationId } = req.params;

        if (!validId(invitationId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid invitation ID",
            });
        }

        const invitation = await Invitation.findOneAndUpdate(
            {
                _id: invitationId,
                recipient: req.user.id,
                status: "Pending",
            },
            {
                $set: {
                    status: "Accepted",
                    respondedAt: new Date(),
                },
            },
            { new: true }
        );

        if (!invitation) {
            return res.status(404).json({
                success: false,
                message: "Invitation is no longer pending or does not belong to you",
            });
        }

        const project = await Project.findById(invitation.project);

        if (!project) {
            await Invitation.updateOne(
                { _id: invitation._id, status: "Accepted" },
                { $set: { status: "Rejected" } }
            );

            return res.status(404).json({
                success: false,
                message: "Project no longer exists",
            });
        }

        const user = await User.findById(req.user.id).select("name");

        const alreadyMember =
            isOwner(project, req.user.id) ||
            isMember(project, req.user.id);

        if (!alreadyMember) {
            project.members.addToSet(req.user.id);
            await project.save();

            await logActivity({
                project: project._id,
                user: req.user.id,
                action: "invitation_accepted",
                description: `${user?.name || "A member"} joined the project by accepting an invitation.`,
                entityType: "Team",
                entityId: req.user.id,
                metadata: {
                    invitationId: invitation._id,
                    memberId: req.user.id,
                },
            });
        }

        await Notification.deleteMany({
            invitation: invitation._id,
            recipient: req.user.id,
        });

        const notification = await Notification.create({
            recipient: invitation.sender,
            sender: req.user.id,
            project: project._id,
            type: "team_added",
            message: `${user?.name || "A user"} accepted your invitation to ${project.name}.`,
        });

        await emitNotification(
            req,
            notification._id,
            invitation.sender
        );

        return res.json({
            success: true,
            message: `You joined ${project.name} successfully`,
        });
    } catch (error) {
        console.error("acceptInvitation:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to accept invitation",
        });
    }
};

// ==========================================
// REJECT INVITATION
// ==========================================

export const rejectInvitation = async (req, res) => {
    try {
        const { invitationId } = req.params;

        if (!validId(invitationId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid invitation ID",
            });
        }

        const invitation = await Invitation.findOneAndUpdate(
            {
                _id: invitationId,
                recipient: req.user.id,
                status: "Pending",
            },
            {
                $set: {
                    status: "Rejected",
                    respondedAt: new Date(),
                },
            },
            { new: true }
        );

        if (!invitation) {
            return res.status(404).json({
                success: false,
                message: "Pending invitation not found",
            });
        }

        await Notification.deleteMany({
            invitation: invitation._id,
            recipient: req.user.id,
        });

        return res.json({
            success: true,
            message: "Invitation rejected",
        });
    } catch (error) {
        console.error("rejectInvitation:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to reject invitation",
        });
    }
};

// ==========================================
// OWNER REMOVES A MEMBER
// ==========================================

export const removeTeamMember = async (req, res) => {
    try {
        const { projectId, memberId } = req.params;

        if (!validId(projectId) || !validId(memberId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid ID",
            });
        }

        const project = await Project.findById(projectId);

        if (!project) {
            return res.status(404).json({
                success: false,
                message: "Project not found",
            });
        }

        if (!isOwner(project, req.user.id)) {
            return res.status(403).json({
                success: false,
                message: "Only owner can remove members",
            });
        }

        if (getId(project.owner) === memberId) {
            return res.status(400).json({
                success: false,
                message: "Owner cannot remove themselves. Transfer ownership first.",
            });
        }

        if (!isMember(project, memberId)) {
            return res.status(404).json({
                success: false,
                message: "Member not found",
            });
        }

        const removedMember = await User.findById(memberId).select("name");

        project.members.pull(memberId);
        await project.save();

        await logActivity({
            project: project._id,
            user: req.user.id,
            action: "team_member_removed",
            description: `${removedMember?.name || "A member"} was removed from the project.`,
            entityType: "Team",
            entityId: memberId,
            metadata: {
                memberId,
                memberName: removedMember?.name || "Unknown",
                reason: "owner_removed",
            },
        });

        const notification = await Notification.create({
            recipient: memberId,
            sender: req.user.id,
            project: projectId,
            type: "team_removed",
            message: `You were removed from project ${project.name}.`,
        });

        await emitNotification(
            req,
            notification._id,
            memberId
        );

        return res.json({
            success: true,
            message: "Member removed successfully",
        });
    } catch (error) {
        console.error("removeTeamMember:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to remove member",
        });
    }
};

// ==========================================
// MEMBER LEAVES PROJECT
// ==========================================

export const leaveProject = async (req, res) => {
    try {
        const { projectId } = req.params;

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

        if (isOwner(project, req.user.id)) {
            return res.status(400).json({
                success: false,
                message: "Owner cannot leave. Transfer ownership to a member first.",
            });
        }

        if (!isMember(project, req.user.id)) {
            return res.status(403).json({
                success: false,
                message: "You are not a member of this project",
            });
        }

        const ownerId = getId(project.owner);
        const leavingUser = await User.findById(req.user.id).select("name");

        project.members.pull(req.user.id);
        await project.save();

        await logActivity({
            project: project._id,
            user: req.user.id,
            action: "team_member_removed",
            description: `${leavingUser?.name || "A member"} left the project.`,
            entityType: "Team",
            entityId: req.user.id,
            metadata: {
                memberId: req.user.id,
                reason: "voluntary_leave",
            },
        });

        const notification = await Notification.create({
            recipient: ownerId,
            sender: req.user.id,
            project: projectId,
            type: "team_removed",
            message: `${leavingUser?.name || "A member"} left your project ${project.name}.`,
        });

        await emitNotification(
            req,
            notification._id,
            ownerId
        );

        return res.json({
            success: true,
            message: `You left ${project.name}`,
        });
    } catch (error) {
        console.error("leaveProject:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to leave project",
        });
    }
};

// ==========================================
// TRANSFER OWNERSHIP
// ==========================================

export const transferOwnership = async (req, res) => {
    try {
        const { projectId } = req.params;
        const { newOwnerId } = req.body || {};

        if (!validId(projectId) || !validId(newOwnerId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid ID",
            });
        }

        const project = await Project.findById(projectId);

        if (!project) {
            return res.status(404).json({
                success: false,
                message: "Project not found",
            });
        }

        if (!isOwner(project, req.user.id)) {
            return res.status(403).json({
                success: false,
                message: "Only current owner can transfer ownership",
            });
        }

        if (String(newOwnerId) === String(req.user.id)) {
            return res.status(400).json({
                success: false,
                message: "You are already the owner",
            });
        }

        if (!isMember(project, newOwnerId)) {
            return res.status(400).json({
                success: false,
                message: "New owner must be an existing project member",
            });
        }

        const previousOwnerId = getId(project.owner);

        project.members.pull(newOwnerId);
        project.members.addToSet(previousOwnerId);
        project.owner = newOwnerId;

        await project.save();

        const newOwner = await User.findById(newOwnerId).select("name");

        await logActivity({
            project: project._id,
            user: req.user.id,
            action: "team_member_removed",
            description: `Project ownership was transferred to ${newOwner?.name || "a team member"}.`,
            entityType: "Team",
            entityId: newOwnerId,
            metadata: {
                previousOwnerId,
                newOwnerId,
                reason: "ownership_transferred",
            },
        });

        const notification = await Notification.create({
            recipient: newOwnerId,
            sender: previousOwnerId,
            project: projectId,
            type: "team_added",
            message: `You are now the owner of ${project.name}.`,
        });

        await emitNotification(
            req,
            notification._id,
            newOwnerId
        );

        return res.json({
            success: true,
            message: "Ownership transferred successfully. You are now a regular member.",
        });
    } catch (error) {
        console.error("transferOwnership:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to transfer ownership",
        });
    }
};
