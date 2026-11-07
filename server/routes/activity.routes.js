
import express from "express";
import { getProjectActivities } from "../controllers/activity.controller.js";
import protect from "../middleware/auth.middleware.js";

const router = express.Router();

router.get(
    "/project/:projectId",
    protect,
    getProjectActivities
);

export default router;
