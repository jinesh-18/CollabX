
import Activity from "../models/Activity.js";

const logActivity = async ({
    project,
    user,
    action,
    description,
    entityType,
    entityId = null,
    metadata = {},
}) => {
    try {
        return await Activity.create({
            project,
            user,
            action,
            description,
            entityType,
            entityId,
            metadata,
        });
    } catch (error) {
        // Activity logging should not break the main operation.
        console.error("Activity Logger Error:", error.message);
        return null;
    }
};

export default logActivity;
