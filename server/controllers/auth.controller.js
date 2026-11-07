
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

const createToken = (userId) => {
    if (!process.env.JWT_SECRET) {
        throw new Error("JWT_SECRET is missing in environment variables");
    }

    return jwt.sign(
        { id: String(userId) },
        process.env.JWT_SECRET,
        {
            expiresIn: process.env.JWT_EXPIRES_IN || "7d",
        }
    );
};

const safeUser = (user) => ({
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
});

// REGISTER
export const registerUser = async (req, res, next) => {
    try {
        const { name, email, password } = req.body || {};

        // Validate input types
        if (
            typeof name !== "string" ||
            typeof email !== "string" ||
            typeof password !== "string"
        ) {
            return res.status(400).json({
                success: false,
                message: "Valid name, email and password are required",
            });
        }

        const cleanName = name.trim();
        const cleanEmail = email.trim().toLowerCase();

        if (!cleanName || !cleanEmail || !password) {
            return res.status(400).json({
                success: false,
                message: "Name, email and password are required",
            });
        }

        if (cleanName.length < 2 || cleanName.length > 50) {
            return res.status(400).json({
                success: false,
                message: "Name must contain 2 to 50 characters",
            });
        }

        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (
            cleanEmail.length > 254 ||
            !emailPattern.test(cleanEmail)
        ) {
            return res.status(400).json({
                success: false,
                message: "Please enter a valid email address",
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                message: "Password must contain at least 8 characters",
            });
        }

        // bcrypt supports a maximum of 72 UTF-8 bytes
        if (Buffer.byteLength(password, "utf8") > 72) {
            return res.status(400).json({
                success: false,
                message: "Password cannot exceed 72 bytes",
            });
        }

        const existingUser = await User.findOne({
            email: cleanEmail,
        });

        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: "An account with this email already exists",
            });
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        const user = await User.create({
            name: cleanName,
            email: cleanEmail,
            password: hashedPassword,
        });

        const token = createToken(user._id);

        return res.status(201).json({
            success: true,
            message: "Account created successfully",
            token,
            user: safeUser(user),
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: "An account with this email already exists",
            });
        }

        next(error);
    }
};

// LOGIN
export const loginUser = async (req, res, next) => {
    try {
        const { email, password } = req.body || {};

        if (
            typeof email !== "string" ||
            typeof password !== "string" ||
            !email.trim() ||
            !password
        ) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required",
            });
        }

        const cleanEmail = email.trim().toLowerCase();

        if (
            cleanEmail.length > 254 ||
            Buffer.byteLength(password, "utf8") > 72
        ) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password",
            });
        }

        const user = await User.findOne({
            email: cleanEmail,
        }).select("+password");

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password",
            });
        }

        const passwordMatches = await bcrypt.compare(
            password,
            user.password
        );

        if (!passwordMatches) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password",
            });
        }

        const token = createToken(user._id);

        return res.status(200).json({
            success: true,
            message: "Login successful",
            token,
            user: safeUser(user),
        });
    } catch (error) {
        next(error);
    }
};

// GET LOGGED-IN USER
export const getMe = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "Authentication required",
            });
        }

        return res.status(200).json({
            success: true,
            user: safeUser(req.user),
        });
    } catch (error) {
        next(error);
    }
};
