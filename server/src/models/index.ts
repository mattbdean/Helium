import * as fs from 'fs';
import * as _ from 'lodash';
import * as path from 'path';

import { Sequelize } from 'sequelize';

export async function importAll(sequelize: Sequelize): Promise<any[]> {
    const modelFiles = await findModels();
    return _.map(modelFiles, (f) => sequelize.import(f));
}

function findModels(dir: string = __dirname): Promise<string[]> {
    return new Promise((resolve, reject) => {
        fs.readdir(dir, (err: NodeJS.ErrnoException, files: string[]) => {
            if (err) return reject(err);

            const filtered = _.filter(files, (f) => !/^index/.test(f));
            // Remove either .ts or .js extension and resolve to absolute path
            resolve(_.map(filtered, (f) => path.resolve(dir, f.slice(0, -3))));
        });
    });
}
