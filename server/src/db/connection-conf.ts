/**
 * A small subset of relevant connection options supported by promise-mysql. See
 * https://github.com/mysqljs/mysql#connection-options for the full list.
 */
export interface ConnectionConf {
    /** The hostname of the database you are connecting to. (Default: localhost) */
    host?: string;

    /** The port number to connect to. (Default: 3306) */
    port?: number;

    /** The MySQL user to authenticate as. */
    user: string;

    /** The password of that MySQL user */
    password: string;
}
