
import express from "express";

import {
    getChatMessages,
    sendChatMessage,
    editChatMessage,
    deleteChatMessage,
} from "../controllers/chat.controller.js";

import protect from "../middleware/auth.middleware.js";

const router = express.Router();

// Get project chat history
router.get("/:projectId/messages", protect, getChatMessages);

// Send a new message
router.post("/:projectId/messages", protect, sendChatMessage);

// Edit own message
router.patch(
    "/:projectId/messages/:messageId",
    protect,
    editChatMessage
);

// Delete message for me or everyone
router.delete(
    "/:projectId/messages/:messageId",
    protect,
    deleteChatMessage
);

export default router;
