
import Activity from "../models/Activity.js";
import Project from "../models/Project.js";

const validId = (id) =>
    typeof id === "string" && /^[0-9a-fA-F]{24}$/.test(id);

// GET PROJECT ACTIVITIES
export const getProjectActivities = async (req, res) => {
    try {
        const { projectId } = req.params;

        if (!validId(projectId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid project ID",
            });
        }

        // Verify project exists
        const project = await Project.findById(projectId);

        if (!project) {
            return res.status(404).json({
                success: false,
                message: "Project not found",
            });
        }

        // Verify user belongs to this project
        const userId = req.user.id.toString();

        const hasAccess =
            project.owner.toString() === userId ||
            project.members.some(
                (member) => member.toString() === userId
            );

        if (!hasAccess) {
            return res.status(403).json({
                success: false,
                message: "You do not have access to this project",
            });
        }

        // Pagination
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(
            50,
            Math.max(1, parseInt(req.query.limit, 10) || 20)
        );

        const skip = (page - 1) * limit;

        const filter = {
            project: projectId,
        };

        const [activities, total] = await Promise.all([
            Activity.find(filter)
                .populate("user", "name email")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),

            Activity.countDocuments(filter),
        ]);

        return res.status(200).json({
            success: true,
            activities,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
                hasNextPage: page * limit < total,
                hasPreviousPage: page > 1,
            },
        });
    } catch (error) {
        console.error("Activity Controller Error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to fetch project activities",
        });
    }
};
