
import axios from "axios";

const api = axios.create({
    baseURL:
        import.meta.env.VITE_API_URL ||
        "http://localhost:5000/api",
    headers: {
        "Content-Type": "application/json",
    },
});

// Attach JWT
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem("collabx_token");

        if (token) {
            config.headers = config.headers || {};
            config.headers.Authorization = `Bearer ${token}`;
        }

        return config;
    },
    (error) => Promise.reject(error)
);

// Handle unauthorized requests
api.interceptors.response.use(
    (response) => response,
    (error) => {
        const status = error.response?.status;
        const requestUrl = error.config?.url || "";

        const isAuthRequest =
            requestUrl.includes("/auth/login") ||
            requestUrl.includes("/auth/register");

        if (status === 401 && !isAuthRequest) {
            localStorage.removeItem("collabx_token");
            localStorage.removeItem("collabx_user");

            if (
                window.location.pathname !== "/login" &&
                window.location.pathname !== "/register"
            ) {
                window.location.replace("/login");
            }
        }

        return Promise.reject(error);
    }
);

export default api;
