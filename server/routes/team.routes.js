import express from "express";

import {
    getProjectTeam,
    sendInvitation,
    cancelInvitation,
    getMyInvitations,
    acceptInvitation,
    rejectInvitation,
    removeTeamMember,
    leaveProject,
    transferOwnership,
} from "../controllers/team.controller.js";

import protect from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(protect);

// Received invitations
router.get("/invitations/received", getMyInvitations);
router.patch("/invitations/:invitationId/accept", acceptInvitation);
router.patch("/invitations/:invitationId/reject", rejectInvitation);

// Project team
router.get("/:projectId", getProjectTeam);
router.post("/:projectId/invitations", sendInvitation);
router.delete("/:projectId/invitations/:invitationId", cancelInvitation);

// Membership management
router.delete("/:projectId/members/:memberId", removeTeamMember);
router.post("/:projectId/leave", leaveProject);
router.patch("/:projectId/transfer-ownership", transferOwnership);

export default router;