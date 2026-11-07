
import { Resend } from "resend";

const sendEmail = async ({
    to,
    subject,
    html,
    replyTo,
}) => {
    try {
        const apiKey = process.env.RESEND_API_KEY;

        if (!apiKey) {
            console.error("RESEND_API_KEY is missing in .env");

            return {
                sent: false,
                reason: "Resend API key is missing",
            };
        }

        const resend = new Resend(apiKey);

        const { data, error } = await resend.emails.send({
            from:
                process.env.RESEND_FROM ||
                "CollabX <onboarding@resend.dev>",
            to: [to],
            subject,
            html,
            ...(replyTo ? { replyTo } : {}),
        });

        if (error) {
            console.error("Resend Error:", error);

            return {
                sent: false,
                reason: error.message,
            };
        }

        return {
            sent: true,
            emailId: data?.id,
        };
    } catch (error) {
        console.error("Email Error:", error);

        return {
            sent: false,
            reason: error.message,
        };
    }
};

export default sendEmail;
