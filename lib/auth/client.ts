// Browser-safe helpers for the auth forms (no server imports here).

export type ApiError = {
    status?: number;
    code?: string;
    message: string;
    retryAfterSeconds?: number;
};

/** Normalizes an axios error from any auth endpoint. */
export function getApiError(error: any, fallback = 'Something went wrong'): ApiError {
    const body = error?.response?.data?.error;
    return {
        status: error?.response?.status,
        code: body?.code,
        message: body?.message || error?.response?.data?.message || fallback,
        retryAfterSeconds: typeof body?.retryAfterSeconds === 'number' ? body.retryAfterSeconds : undefined,
    };
}

/** 272 -> "4:32" */
export function formatCountdown(totalSeconds: number): string {
    const s = Math.max(0, Math.ceil(totalSeconds));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** 300 -> "5 minutes", 45 -> "45 seconds" (for toasts) */
export function formatWait(totalSeconds: number): string {
    const s = Math.max(1, Math.ceil(totalSeconds));
    if (s < 90) return `${s} second${s === 1 ? '' : 's'}`;
    const m = Math.ceil(s / 60);
    return m < 90 ? `${m} minute${m === 1 ? '' : 's'}` : `${Math.ceil(m / 60)} hours`;
}

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_BYTES = 72;
/** Mirrors the server rule so users get instant feedback; the server is still the authority. */
export const passwordTooLong = (value: string) => new TextEncoder().encode(value).length > PASSWORD_MAX_BYTES;
