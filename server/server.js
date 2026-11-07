
import express from "express";
import "dotenv/config";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import http from "http";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { Server } from "socket.io";
import rateLimit from "express-rate-limit";

import connectDB from "./config/db.js";
import User from "./models/User.js";
import { startTaskReminderJob } from "./jobs/taskReminder.job.js";

// Routes
import healthRoutes from "./routes/health.routes.js";
import authRoutes from "./routes/auth.routes.js";
import projectRoutes from "./routes/project.routes.js";
import taskRoutes from "./routes/task.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import teamRoutes from "./routes/team.routes.js";
import notificationRoutes from "./routes/notification.routes.js";
import chatRoutes from "./routes/chat.routes.js";
import activityRoutes from "./routes/activity.routes.js";

// Error Middleware
import {
    notFound,
    errorHandler,
} from "./middleware/error.middleware.js";

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL;

let allowedOrigins = [];

// ==========================================
// TRUST PROXY
// Enable only when deployed behind a trusted proxy
// ==========================================

app.set(
    "trust proxy",
    process.env.TRUST_PROXY === "true" ? 1 : false
);

// ==========================================
// CORS CONFIGURATION
// CLIENT_URL supports comma-separated origins
// ==========================================

const corsOriginCheck = (origin, callback) => {
    // Allow requests without an Origin header (Postman, server-to-server)
    if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
    }

    return callback(new Error("Origin not allowed by CORS"));
};

const corsOptions = {
    origin: corsOriginCheck,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
};

// ==========================================
// SOCKET.IO SETUP
// ==========================================

const io = new Server(server, {
    cors: corsOptions,
    maxHttpBufferSize: 1e6,
    connectTimeout: 20000,
});

// ==========================================
// SOCKET.IO JWT AUTHENTICATION
// ==========================================

io.use(async (socket, next) => {
    try {
        const authToken =
            socket.handshake.auth?.token ||
            socket.handshake.headers?.authorization;

        if (!authToken || typeof authToken !== "string") {
            return next(new Error("Authentication required"));
        }

        const token = authToken.startsWith("Bearer ")
            ? authToken.slice(7).trim()
            : authToken.trim();

        if (!token) {
            return next(new Error("Authentication required"));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        if (!decoded || typeof decoded.id !== "string") {
            return next(new Error("Invalid authentication token"));
        }

        const user = await User.findById(decoded.id).select("-password");

        if (!user) {
            return next(new Error("User account not found"));
        }

        socket.data.user = {
            id: user._id.toString(),
            name: user.name,
            email: user.email,
        };

        next();
    } catch (error) {
        if (error.name === "TokenExpiredError") {
            return next(new Error("Session expired. Please login again."));
        }

        return next(new Error("Invalid authentication token"));
    }
});

// ==========================================
// GLOBAL SECURITY MIDDLEWARE
// ==========================================

app.disable("x-powered-by");

app.use(helmet());

app.use(cors(corsOptions));

// ==========================================
// RATE LIMITING
// ==========================================

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: "Too many requests. Please try again later.",
    },
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: "Too many authentication attempts. Try again later.",
    },
});

// ==========================================
// REQUEST BODY LIMITS
// ==========================================

app.use(express.json({ limit: "1mb" }));

app.use(
    express.urlencoded({
        extended: false,
        limit: "1mb",
        parameterLimit: 100,
    })
);

// ==========================================
// HTTP REQUEST LOGGING
// ==========================================

app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

// Make Socket.IO accessible inside controllers
app.set("io", io);

// ==========================================
// API ROUTES
// ==========================================

app.use("/api", apiLimiter);

app.use("/api/health", healthRoutes);

// Apply stricter rate limiting to authentication
app.use("/api/auth", authLimiter, authRoutes);

app.use("/api/projects", projectRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/team", teamRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/activities", activityRoutes);

// ==========================================
// SOCKET.IO CONNECTION EVENTS
// ==========================================

io.on("connection", (socket) => {
    const userId = socket.data.user.id;
    const room = `user:${userId}`;

    socket.join(room);

    console.log("SOCKET CONNECTED:", userId);

    socket.on("disconnect", (reason) => {
        console.log("SOCKET DISCONNECTED:", userId, reason);
    });
});

// ==========================================
// ERROR HANDLING
// ==========================================

app.use(notFound);
app.use(errorHandler);

// ==========================================
// GRACEFUL SHUTDOWN
// ==========================================

let isShuttingDown = false;

const shutdown = (signal) => {
    if (isShuttingDown) return;

    isShuttingDown = true;

    console.log(`${signal} received. Shutting down CollabX...`);

    const forceExit = setTimeout(() => {
        console.error("Graceful shutdown timed out.");
        process.exit(1);
    }, 10000);

    forceExit.unref();

    io.close(async () => {
        try {
            await mongoose.disconnect();

            console.log("MongoDB disconnected.");
            console.log("CollabX shutdown complete.");

            clearTimeout(forceExit);
            process.exit(0);
        } catch (error) {
            console.error("Shutdown error:", error.message);
            process.exit(1);
        }
    });
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// ==========================================
// START SERVER
// ==========================================

const startServer = async () => {
    try {
        if (!CLIENT_URL) {
            throw new Error("CLIENT_URL is missing in .env");
        }

        allowedOrigins = CLIENT_URL.split(",")
            .map((origin) => origin.trim())
            .filter(Boolean)
            .map((origin) => new URL(origin).origin);

        if (allowedOrigins.length === 0) {
            throw new Error("At least one valid CLIENT_URL is required.");
        }

        if (
            !process.env.JWT_SECRET ||
            process.env.JWT_SECRET.length < 32
        ) {
            throw new Error("Please configure a strong JWT_SECRET in .env");
        }

        await connectDB();

        startTaskReminderJob(io);

        server.listen(PORT, () => {
            console.log("----------------------------------");
            console.log(`CollabX Backend: http://localhost:${PORT}`);
            console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
            console.log("Helmet Security: ENABLED");
            console.log("CORS Origin Allowlist: ENABLED");
            console.log("API Rate Limiting: ENABLED");
            console.log("Authentication Rate Limiting: ENABLED");
            console.log("Socket.IO JWT Authentication: ENABLED");
            console.log("Private User Rooms: ENABLED");
            console.log("Real-time Chat API: ENABLED");
            console.log("Task Reminder Scheduler: ENABLED");
            console.log("Activity Timeline API: ENABLED");
            console.log("Graceful Shutdown: ENABLED");
            console.log("----------------------------------");
        });
    } catch (error) {
        console.error("Server startup failed:", error.message);
        process.exit(1);
    }
};

startServer();
