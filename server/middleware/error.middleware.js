
const notFound = (req, res, next) => {
    const error = new Error("Route not found");
    error.statusCode = 404;
    next(error);
};

const errorHandler = (error, req, res, next) => {
    // Log detailed error only on the server
    console.error("Backend Error:", {
        message: error.message,
        stack: error.stack,
        url: req.originalUrl,
        method: req.method,
    });

    if (res.headersSent) {
        return next(error);
    }

    const statusCode =
        Number.isInteger(error.statusCode) &&
            error.statusCode >= 400 &&
            error.statusCode <= 599
            ? error.statusCode
            : 500;

    const message =
        statusCode === 404
            ? "Route not found"
            : statusCode < 500
                ? error.message
                : "Internal Server Error";

    return res.status(statusCode).json({
        success: false,
        message,
    });
};

export { notFound, errorHandler };
