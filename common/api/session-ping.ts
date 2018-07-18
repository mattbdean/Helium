
export interface SessionPing {
    /** Whether or not the server knows about the specified API key */
    validApiKey: boolean;

    /**
     * The unix time (in milliseconds) at which the API key is currently set to
     * expire, or null if the API key is not valid.
     */
    expiresAt: number | null;
}
