
import Project from "../models/Project.js";
import Task from "../models/Task.js";

export const getDashboard = async (req, res) => {
    try {
        const userId = req.user.id;

        const projects = await Project.find({
            $or: [{ owner: userId }, { members: userId }],
        }).select("_id name status priority deadline");

        const projectIds = projects.map((project) => project._id);

        const taskFilter = { project: { $in: projectIds } };

        const [
            totalTasks,
            todoTasks,
            inProgressTasks,
            reviewTasks,
            completedTasks,
            myTasks,
            highPriorityTasks,
        ] = await Promise.all([
            Task.countDocuments(taskFilter),
            Task.countDocuments({ ...taskFilter, status: "Todo" }),
            Task.countDocuments({ ...taskFilter, status: "In Progress" }),
            Task.countDocuments({ ...taskFilter, status: "In Review" }),
            Task.countDocuments({ ...taskFilter, status: "Completed" }),
            Task.countDocuments({ ...taskFilter, assignedTo: userId }),
            Task.countDocuments({
                ...taskFilter,
                priority: "High",
                status: { $ne: "Completed" },
            }),
        ]);

        const recentTasks = await Task.find(taskFilter)
            .populate("project", "name")
            .populate("assignedTo", "name email")
            .sort({ createdAt: -1 })
            .limit(5);

        const upcomingTasks = await Task.find({
            ...taskFilter,
            dueDate: { $gte: new Date() },
            status: { $ne: "Completed" },
        })
            .populate("project", "name")
            .populate("assignedTo", "name email")
            .sort({ dueDate: 1 })
            .limit(5);

        return res.status(200).json({
            success: true,
            dashboard: {
                stats: {
                    totalProjects: projects.length,
                    totalTasks,
                    todoTasks,
                    inProgressTasks,
                    reviewTasks,
                    completedTasks,
                    myTasks,
                    highPriorityTasks,
                },
                projects,
                recentTasks,
                upcomingTasks,
            },
        });
    } catch (error) {
        console.error("Dashboard Error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to load dashboard",
        });
    }
};
