type RetryOptions = {
    retries?: number;
    baseDelayMs?: number;
};

export async function withRetry<T>(
    fn: () => Promise<T>,
    { retries = 3, baseDelayMs = 100 }: RetryOptions = {}
): Promise<T> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            return await fn();
        } catch (err) {
            lastError = err;
            if (attempt < retries) {
                // exponential back-off: 100ms, 200ms, 400ms …
                await new Promise((resolve) =>
                    setTimeout(resolve, baseDelayMs * 2 ** attempt)
                );
            }
        }
    }

    throw lastError;
}
