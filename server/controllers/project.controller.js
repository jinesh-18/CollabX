
import Project from "../models/Project.js";
import logActivity from "../utils/activityLogger.js";

const STATUSES = [
    "Planning",
    "In Progress",
    "Completed",
    "On Hold",
];

const PRIORITIES = ["Low", "Medium", "High"];

const validId = (id) =>
    /^[a-f\d]{24}$/i.test(String(id));

const validDeadline = (date) =>
    date === null || !Number.isNaN(new Date(date).getTime());

const escapeRegex = (value) =>
    value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Centralized error handler
const handleError = (res, error) => {
    console.error("Project Controller Error:", error);

    if (
        error.name === "ValidationError" ||
        error.name === "CastError"
    ) {
        return res.status(400).json({
            success: false,
            message: "Invalid project data",
        });
    }

    return res.status(500).json({
        success: false,
        message: "Something went wrong. Please try again.",
    });
};


// 1. CREATE PROJECT
export const createProject = async (req, res) => {
    try {
        const {
            name,
            description,
            status,
            priority,
            deadline,
        } = req.body || {};

        if (req.body?.members !== undefined) {
            return res.status(400).json({
                success: false,
                message: "Members can only be added through the invitation system",
            });
        }

        if (typeof name !== "string" || !name.trim()) {
            return res.status(400).json({
                success: false,
                message: "Project name is required",
            });
        }

        if (name.trim().length > 100) {
            return res.status(400).json({
                success: false,
                message: "Project name cannot exceed 100 characters",
            });
        }

        if (
            description !== undefined &&
            (
                typeof description !== "string" ||
                description.length > 1000
            )
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid project description",
            });
        }

        if (
            status !== undefined &&
            !STATUSES.includes(status)
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid project status",
            });
        }

        if (
            priority !== undefined &&
            !PRIORITIES.includes(priority)
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid project priority",
            });
        }

        if (
            deadline !== undefined &&
            !validDeadline(deadline)
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid deadline",
            });
        }

        const project = await Project.create({
            name: name.trim(),
            description: description?.trim() || "",
            status: status || "Planning",
            priority: priority || "Medium",
            owner: req.user.id,
            members: [],
            deadline: deadline ?? null,
        });

        await logActivity({
            project: project._id,
            user: req.user.id,
            action: "project_created",
            description: `Created project "${project.name}"`,
            entityType: "Project",
            entityId: project._id,
            metadata: {
                projectName: project.name,
            },
        });

        return res.status(201).json({
            success: true,
            message: "Project created successfully",
            project,
        });

    } catch (error) {
        return handleError(res, error);
    }
};


// 2. GET PROJECTS WITH PAGINATION, SEARCH AND FILTERING
export const getProjects = async (req, res) => {
    try {
        const {
            page = "1",
            limit = "10",
            search = "",
            status = "",
        } = req.query;

        const currentPage = Math.max(1, parseInt(page, 10) || 1);
        const pageLimit = Math.min(
            50,
            Math.max(1, parseInt(limit, 10) || 10)
        );

        if (
            status &&
            status !== "All" &&
            !STATUSES.includes(status)
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid project status filter",
            });
        }

        const searchText = String(search).trim().slice(0, 100);

        // Only projects owned by or shared with the logged-in user
        const filter = {
            $or: [
                { owner: req.user.id },
                { members: req.user.id },
            ],
        };

        // Status filter
        if (status && status !== "All") {
            filter.status = status;
        }

        // Search by project name or description
        if (searchText) {
            const searchRegex = new RegExp(
                escapeRegex(searchText),
                "i"
            );

            filter.$and = [
                {
                    $or: [
                        { name: searchRegex },
                        { description: searchRegex },
                    ],
                },
            ];
        }

        const skip = (currentPage - 1) * pageLimit;

        // Fetch current page and total count concurrently
        const [projects, total] = await Promise.all([
            Project.find(filter)
                .select(
                    "name description status priority owner members deadline createdAt updatedAt"
                )
                .populate("owner", "name email")
                .populate("members", "name email")
                .sort({ createdAt: -1, _id: -1 })
                .skip(skip)
                .limit(pageLimit)
                .lean(),

            Project.countDocuments(filter),
        ]);

        return res.status(200).json({
            success: true,
            count: projects.length,
            total,
            page: currentPage,
            limit: pageLimit,
            totalPages: Math.ceil(total / pageLimit),
            hasNextPage: currentPage * pageLimit < total,
            hasPrevPage: currentPage > 1,
            projects,
        });

    } catch (error) {
        return handleError(res, error);
    }
};


// 3. GET SINGLE PROJECT
export const getProjectById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!validId(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid project ID",
            });
        }

        const project = await Project.findOne({
            _id: id,
            $or: [
                { owner: req.user.id },
                { members: req.user.id },
            ],
        })
            .populate("owner", "name email")
            .populate("members", "name email");

        if (!project) {
            return res.status(404).json({
                success: false,
                message: "Project not found",
            });
        }

        return res.status(200).json({
            success: true,
            project,
        });

    } catch (error) {
        return handleError(res, error);
    }
};


// 4. UPDATE PROJECT
export const updateProject = async (req, res) => {
    try {
        const { id } = req.params;
        const body = req.body || {};

        if (!validId(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid project ID",
            });
        }

        if (body.members !== undefined) {
            return res.status(400).json({
                success: false,
                message: "Members can only be added through the invitation system",
            });
        }

        const updates = {};

        if (body.name !== undefined) {
            if (
                typeof body.name !== "string" ||
                !body.name.trim() ||
                body.name.trim().length > 100
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid project name",
                });
            }

            updates.name = body.name.trim();
        }

        if (body.description !== undefined) {
            if (
                typeof body.description !== "string" ||
                body.description.length > 1000
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid description",
                });
            }

            updates.description = body.description.trim();
        }

        if (body.status !== undefined) {
            if (!STATUSES.includes(body.status)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid project status",
                });
            }

            updates.status = body.status;
        }

        if (body.priority !== undefined) {
            if (!PRIORITIES.includes(body.priority)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid project priority",
                });
            }

            updates.priority = body.priority;
        }

        if (body.deadline !== undefined) {
            if (!validDeadline(body.deadline)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid deadline",
                });
            }

            updates.deadline = body.deadline;
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({
                success: false,
                message: "No valid fields provided for update",
            });
        }

        const project = await Project.findOneAndUpdate(
            {
                _id: id,
                owner: req.user.id,
            },
            updates,
            {
                new: true,
                runValidators: true,
            }
        )
            .populate("owner", "name email")
            .populate("members", "name email");

        if (!project) {
            return res.status(404).json({
                success: false,
                message: "Project not found or you are not the owner",
            });
        }

        await logActivity({
            project: project._id,
            user: req.user.id,
            action: "project_updated",
            description: `Updated project "${project.name}"`,
            entityType: "Project",
            entityId: project._id,
            metadata: {
                updatedFields: Object.keys(updates),
            },
        });

        return res.status(200).json({
            success: true,
            message: "Project updated successfully",
            project,
        });

    } catch (error) {
        return handleError(res, error);
    }
};


// 5. DELETE PROJECT
export const deleteProject = async (req, res) => {
    try {
        const { id } = req.params;

        if (!validId(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid project ID",
            });
        }

        const project = await Project.findOneAndDelete({
            _id: id,
            owner: req.user.id,
        });

        if (!project) {
            return res.status(404).json({
                success: false,
                message: "Project not found or you are not the owner",
            });
        }

        await logActivity({
            project: project._id,
            user: req.user.id,
            action: "project_deleted",
            description: `Deleted project "${project.name}"`,
            entityType: "Project",
            entityId: project._id,
            metadata: {
                projectName: project.name,
            },
        });

        return res.status(200).json({
            success: true,
            message: "Project deleted successfully",
        });

    } catch (error) {
        return handleError(res, error);
    }
};
