
/**
 * Enable or disable particular parts of the server. Specifying falsey value or
 * not providing one at all will disable that module. Providing a truthy value
 * will enable it.
 */
export interface ModuleConfig {
    /** The JSON API mounted at /api/v1. Requires a database connection. */
    api?: boolean;

    /** Non-API routes */
    front?: boolean;

    /** All front end assets, including client-side Angular code */
    assets?: boolean;
}
