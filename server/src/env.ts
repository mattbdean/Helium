/** An enumeration of possible execution contexts */
export enum NodeEnv {
    PROD,
    DEV,
    TEST
}

let tempEnv: NodeEnv;

switch (process.env.NODE_ENV) {
    case 'prod':
    case 'production':
        tempEnv = NodeEnv.PROD;
        break;
    case 'test':
    case 'testing':
        tempEnv = NodeEnv.TEST;
        break;
    default:
        tempEnv = NodeEnv.DEV;
}

/** Current execution context */
export const NODE_ENV = tempEnv;
