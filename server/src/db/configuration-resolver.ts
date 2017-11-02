import { ConnectionConf } from './connection-conf.interface';

/**
 * This class is responsible for resolving database connection configurations
 * given the name of the configuration.
 */
export abstract class ConfigurationResolver {
    public abstract async resolve(confName: string): Promise<ConnectionConf>;
}
