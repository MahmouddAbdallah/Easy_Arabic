"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { toast } from "react-hot-toast";
import { useAppContext } from "@/components/AppContext";

/** Signs the current user out. Same flow as the public site's navbar. */
export function useLogout() {
    const router = useRouter();
    const { setUser } = useAppContext();
    const [pending, setPending] = useState(false);

    const logout = useCallback(async () => {
        if (pending) return;
        setPending(true);
        try {
            const { data } = await axios.post("/api/auth/logout");
            toast.success(data?.message || "Logged out successfully");
            setUser(null);
            router.push("/sign-in");
            // `pending` stays true: the page is navigating away.
        } catch (error) {
            const data = axios.isAxiosError(error) ? error.response?.data : undefined;
            toast.error(data?.error?.message || data?.message || "Could not sign out. Please try again.");
            setPending(false);
        }
    }, [pending, router, setUser]);

    return { logout, pending };
}
