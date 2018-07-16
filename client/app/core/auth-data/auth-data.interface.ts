
export interface AuthData {
    apiKey: string;
    expiration: Date;

    /** MySQL user used to authenticate the connection */
    username: string;

    /** Location of the MySQL server. Includes both the hostname and the port. */
    host: string;
}
