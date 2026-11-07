import { io } from "socket.io-client";

const SOCKET_URL =
    import.meta.env.VITE_API_URL || "http://localhost:5000";

let socket = null;

const attachNotificationBridge = (socketInstance) => {
    if (socketInstance.notificationBridgeAttached) return;

    socketInstance.notificationBridgeAttached = true;

    socketInstance.on("notification:new", (notification) => {
        window.dispatchEvent(
            new CustomEvent("collabx_notification_received", {
                detail: { notification },
            })
        );
    });
};

export const connectSocket = (token) => {
    if (!token) {
        console.error("Socket connection failed: No token provided.");
        return null;
    }

    if (socket?.connected) {
        attachNotificationBridge(socket);
        return socket;
    }

    if (socket) {
        socket.disconnect();
        socket = null;
    }

    socket = io(SOCKET_URL, {
        auth: { token },
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
    });

    attachNotificationBridge(socket);

    socket.on("connect", () => {
        console.log("Socket connected:", socket.id);
    });

    socket.on("connect_error", (error) => {
        console.error("Socket connection error:", error.message);
    });

    socket.on("disconnect", (reason) => {
        console.log("Socket disconnected:", reason);
    });

    return socket;
};

export const getSocket = () => socket;

export const disconnectSocket = () => {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
};