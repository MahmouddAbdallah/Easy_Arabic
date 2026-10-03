import axios from "axios";

/** A request error as text for a toast: the server's own message when it sent one. */
export function getErrorMessage(error: unknown): string {
    if (axios.isAxiosError(error)) {
        const message = error.response?.data?.error?.message;
        if (typeof message === "string" && message) return message;
        if (!error.response) return "Network error. Please check your connection and try again.";
    }
    return "Something went wrong. Please try again.";
}
