
import express from "express";

import {
    createProject,
    getProjects,
    getProjectById,
    updateProject,
    deleteProject,
} from "../controllers/project.controller.js";

import protect from "../middleware/auth.middleware.js";

const router = express.Router();

// CREATE
router.post("/", protect, createProject);

// READ ALL
router.get("/", protect, getProjects);

// READ SINGLE
router.get("/:id", protect, getProjectById);

// UPDATE
router.put("/:id", protect, updateProject);

// DELETE
router.delete("/:id", protect, deleteProject);

export default router;
