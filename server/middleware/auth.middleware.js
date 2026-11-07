
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import User from "../models/User.js";

const protect = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                message: "Authentication required. Please login.",
            });
        }

        const token = authHeader.slice(7).trim();

        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Invalid authorization token.",
            });
        }

        const secret = process.env.JWT_SECRET;

        if (!secret) {
            return next(new Error("JWT_SECRET is missing"));
        }

        // Verify only the expected signing algorithm
        const decoded = jwt.verify(token, secret, {
            algorithms: ["HS256"],
        });

        // Validate decoded user ID
        if (
            !decoded ||
            typeof decoded.id !== "string" ||
            !/^[a-fA-F0-9]{24}$/.test(decoded.id) ||
            !mongoose.Types.ObjectId.isValid(decoded.id)
        ) {
            return res.status(401).json({
                success: false,
                message: "Invalid authentication token.",
            });
        }

        // Fetch authenticated user without password
        const user = await User.findById(decoded.id).select("-password");

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "User account no longer exists.",
            });
        }

        req.user = user;

        return next();

    } catch (error) {
        if (
            error.name === "TokenExpiredError" ||
            error.name === "JsonWebTokenError" ||
            error.name === "NotBeforeError"
        ) {
            return res.status(401).json({
                success: false,
                message:
                    error.name === "TokenExpiredError"
                        ? "Session expired. Please login again."
                        : "Invalid or expired authentication token.",
            });
        }

        // Database and unexpected server errors
        return next(error);
    }
};

export default protect;
