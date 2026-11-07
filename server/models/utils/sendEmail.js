
import nodemailer from "nodemailer";

const sendEmail = async ({ to, subject, html }) => {
    const {
        SMTP_HOST,
        SMTP_PORT,
        SMTP_USER,
        SMTP_PASS,
        SMTP_SECURE,
        MAIL_FROM,
    } = process.env;

    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
        return {
            sent: false,
            reason: "SMTP is not configured",
        };
    }

    const transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: Number(SMTP_PORT || 587),
        secure: SMTP_SECURE === "true",
        auth: {
            user: SMTP_USER,
            pass: SMTP_PASS,
        },
    });

    try {
        await transporter.sendMail({
            from: MAIL_FROM || SMTP_USER,
            to,
            subject,
            html,
        });

        return { sent: true };
    } catch (error) {
        console.error("Email sending failed:", error.message);

        return {
            sent: false,
            reason: error.message,
        };
    }
};

export default sendEmail;
