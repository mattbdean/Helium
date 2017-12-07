import { DatabaseHelper } from '../../db/database.helper';
import { SchemaDao } from './schemas/schema.dao';

/**
 * A function that produces a SchemaDao. Used pretty much exclusively for
 * testing purposes.
 */
export type DaoFactory = (db: DatabaseHelper, apiKey: string) => SchemaDao;
