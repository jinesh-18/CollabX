
import Task from "../models/Task.js";
import Project from "../models/Project.js";
import User from "../models/User.js";
import logActivity from "../utils/activityLogger.js";

const STATUSES = ["Todo", "In Progress", "In Review", "Completed"];
const PRIORITIES = ["Low", "Medium", "High"];

const validId = (id) =>
  typeof id === "string" && /^[0-9a-fA-F]{24}$/.test(id);

const validDate = (date) =>
  date === null || !Number.isNaN(new Date(date).getTime());

const hasProjectAccess = (project, userId) => {
  const id = userId.toString();

  return (
    project.owner.toString() === id ||
    project.members.some((member) => member.toString() === id)
  );
};

const populateTask = (query) =>
  query
    .populate("project", "name status")
    .populate("assignedTo", "name email")
    .populate("createdBy", "name email");

const handleError = (res, error) => {
  console.error("Task Controller Error:", error);

  if (
    error.name === "ValidationError" ||
    error.name === "CastError"
  ) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }

  return res.status(500).json({
    success: false,
    message: "Server error while processing task",
  });
};

// CREATE TASK
export const createTask = async (req, res) => {
  try {
    const {
      title,
      description,
      projectId,
      assignedTo,
      status,
      priority,
      dueDate,
    } = req.body;

    if (
      typeof title !== "string" ||
      !title.trim() ||
      title.trim().length > 150
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid task title is required (max 150 characters)",
      });
    }

    if (
      description !== undefined &&
      (typeof description !== "string" || description.length > 2000)
    ) {
      return res.status(400).json({
        success: false,
        message: "Description must be text with maximum 2000 characters",
      });
    }

    if (!validId(projectId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID",
      });
    }

    if (status !== undefined && !STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid task status",
      });
    }

    if (priority !== undefined && !PRIORITIES.includes(priority)) {
      return res.status(400).json({
        success: false,
        message: "Invalid task priority",
      });
    }

    if (dueDate !== undefined && !validDate(dueDate)) {
      return res.status(400).json({
        success: false,
        message: "Invalid due date",
      });
    }

    const project = await Project.findById(projectId);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    if (!hasProjectAccess(project, req.user.id)) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this project",
      });
    }

    let assignedUser = null;

    if (assignedTo !== undefined && assignedTo !== null && assignedTo !== "") {
      if (!validId(assignedTo)) {
        return res.status(400).json({
          success: false,
          message: "Invalid assigned user ID",
        });
      }

      const isProjectMember =
        project.owner.toString() === assignedTo ||
        project.members.some((member) => member.toString() === assignedTo);

      if (!isProjectMember) {
        return res.status(400).json({
          success: false,
          message: "Assigned user must belong to this project",
        });
      }

      assignedUser = await User.findById(assignedTo);

      if (!assignedUser) {
        return res.status(404).json({
          success: false,
          message: "Assigned user not found",
        });
      }
    }

    const task = await Task.create({
      title: title.trim(),
      description: description?.trim() || "",
      project: project._id,
      assignedTo: assignedUser?._id || null,
      createdBy: req.user.id,
      status: status || "Todo",
      priority: priority || "Medium",
      dueDate: dueDate || null,
    });

    await logActivity({
      project: project._id,
      user: req.user.id,
      action: "task_created",
      description: `Created task "${task.title}"`,
      entityType: "Task",
      entityId: task._id,
      metadata: {
        taskTitle: task.title,
      },
    });

    const populatedTask = await populateTask(Task.findById(task._id));

    return res.status(201).json({
      success: true,
      message: "Task created successfully",
      task: populatedTask,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

// GET ALL TASKS
export const getTasks = async (req, res) => {
  try {
    const filter = {};

    if (req.query.projectId) {
      if (!validId(req.query.projectId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid project ID",
        });
      }

      const project = await Project.findById(req.query.projectId);

      if (!project) {
        return res.status(404).json({
          success: false,
          message: "Project not found",
        });
      }

      if (!hasProjectAccess(project, req.user.id)) {
        return res.status(403).json({
          success: false,
          message: "You do not have access to this project",
        });
      }

      filter.project = project._id;
    } else {
      const projects = await Project.find({
        $or: [
          { owner: req.user.id },
          { members: req.user.id },
        ],
      }).select("_id");

      filter.project = { $in: projects.map((project) => project._id) };
    }

    const tasks = await populateTask(
      Task.find(filter).sort({ createdAt: -1 })
    );

    return res.status(200).json({
      success: true,
      count: tasks.length,
      tasks,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

// GET SINGLE TASK
export const getTaskById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!validId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid task ID",
      });
    }

    const task = await Task.findById(id);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    const project = await Project.findById(task.project);

    if (!project || !hasProjectAccess(project, req.user.id)) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this task",
      });
    }

    const populatedTask = await populateTask(Task.findById(id));

    return res.status(200).json({
      success: true,
      task: populatedTask,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

// UPDATE TASK
export const updateTask = async (req, res) => {
  try {
    const { id } = req.params;

    if (!validId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid task ID",
      });
    }

    const task = await Task.findById(id);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    const project = await Project.findById(task.project);

    if (!project || !hasProjectAccess(project, req.user.id)) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this task",
      });
    }

    const userId = req.user.id.toString();
    const isOwner = project.owner.toString() === userId;
    const isCreator = task.createdBy.toString() === userId;
    const isAssignee = task.assignedTo?.toString() === userId;

    const isManager = isOwner || isCreator;

    const allowedFields = [
      "title",
      "description",
      "assignedTo",
      "status",
      "priority",
      "dueDate",
    ];

    const receivedFields = Object.keys(req.body);

    if (
      receivedFields.length === 0 ||
      receivedFields.some((field) => !allowedFields.includes(field))
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid or empty update fields",
      });
    }

    if (!isManager) {
      if (!isAssignee || receivedFields.some((field) => field !== "status")) {
        return res.status(403).json({
          success: false,
          message: "You are not allowed to edit this task",
        });
      }
    }

    const {
      title,
      description,
      assignedTo,
      status,
      priority,
      dueDate,
    } = req.body;

    // Capture previous values before updating.
    const oldStatus = task.status;

    const oldDueDate = task.dueDate
      ? new Date(task.dueDate).getTime()
      : null;

    const oldAssignee = task.assignedTo
      ? task.assignedTo.toString()
      : "";

    if (title !== undefined) {
      if (
        typeof title !== "string" ||
        !title.trim() ||
        title.trim().length > 150
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid task title",
        });
      }

      task.title = title.trim();
    }

    if (description !== undefined) {
      if (
        typeof description !== "string" ||
        description.length > 2000
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid task description",
        });
      }

      task.description = description.trim();
    }

    if (status !== undefined) {
      if (!STATUSES.includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid task status",
        });
      }

      task.status = status;
      task.completedAt =
        status === "Completed" ? new Date() : null;
    }

    if (priority !== undefined) {
      if (!PRIORITIES.includes(priority)) {
        return res.status(400).json({
          success: false,
          message: "Invalid task priority",
        });
      }

      task.priority = priority;
    }

    if (dueDate !== undefined) {
      if (!validDate(dueDate)) {
        return res.status(400).json({
          success: false,
          message: "Invalid due date",
        });
      }

      task.dueDate = dueDate;
    }

    if (assignedTo !== undefined) {
      if (assignedTo === null || assignedTo === "") {
        task.assignedTo = null;
      } else {
        if (!validId(assignedTo)) {
          return res.status(400).json({
            success: false,
            message: "Invalid assigned user ID",
          });
        }

        const isProjectMember =
          project.owner.toString() === assignedTo ||
          project.members.some((member) => member.toString() === assignedTo);

        if (!isProjectMember) {
          return res.status(400).json({
            success: false,
            message: "Assigned user must belong to this project",
          });
        }

        const userExists = await User.exists({ _id: assignedTo });

        if (!userExists) {
          return res.status(404).json({
            success: false,
            message: "Assigned user not found",
          });
        }

        task.assignedTo = assignedTo;
      }
    }

    const newDueDate = task.dueDate
      ? new Date(task.dueDate).getTime()
      : null;

    const newAssignee = task.assignedTo
      ? task.assignedTo.toString()
      : "";

    // Reset reminder flags when due date or assignee changes.
    if (
      oldDueDate !== newDueDate ||
      oldAssignee !== newAssignee
    ) {
      task.reminderSentAt = null;
      task.overdueNotifiedAt = null;
    }

    await task.save();

    // Determine the most relevant timeline event.
    let action = "task_updated";
    let activityDescription = `Updated task "${task.title}"`;

    if (oldStatus !== "Completed" && task.status === "Completed") {
      action = "task_completed";
      activityDescription = `Completed task "${task.title}"`;
    } else if (oldAssignee !== newAssignee && newAssignee) {
      action = "task_assigned";
      activityDescription = `Assigned task "${task.title}"`;
    }

    await logActivity({
      project: project._id,
      user: req.user.id,
      action,
      description: activityDescription,
      entityType: "Task",
      entityId: task._id,
      metadata: {
        taskTitle: task.title,
        updatedFields: receivedFields,
      },
    });

    const updatedTask = await populateTask(Task.findById(task._id));

    return res.status(200).json({
      success: true,
      message: "Task updated successfully",
      task: updatedTask,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

// DELETE TASK
export const deleteTask = async (req, res) => {
  try {
    const { id } = req.params;

    if (!validId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid task ID",
      });
    }

    const task = await Task.findById(id);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    const project = await Project.findById(task.project);

    if (!project || !hasProjectAccess(project, req.user.id)) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this task",
      });
    }

    const isOwner = project.owner.toString() === req.user.id.toString();
    const isCreator = task.createdBy.toString() === req.user.id.toString();

    if (!isOwner && !isCreator) {
      return res.status(403).json({
        success: false,
        message: "Only the project owner or task creator can delete this task",
      });
    }

    await task.deleteOne();

    return res.status(200).json({
      success: true,
      message: "Task deleted successfully",
    });
  } catch (error) {
    return handleError(res, error);
  }
};
