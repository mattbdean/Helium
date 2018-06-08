import * as Benchmark from 'benchmark';
import chalk from 'chalk';
import { DatabaseHelper } from '../src/db/database.helper';
import { SchemaDao } from '../src/db/schema.dao';

const db = new DatabaseHelper(Infinity);

function createBenchmarks(dao: SchemaDao): AsyncBenchmarkSuite {
    return {
        benchmarks: {
            'schemas': () => dao.schemas(),
            'tables': () => dao.tables('helium_sample'),
            'content': () => dao.content('helium_sample', 'order'),
            'content (all options)': () => dao.content(
                'helium_sample',
                'big_table',
                {
                    page: 3,
                    limit: 25,
                    sort: { direction: 'asc', by: 'pk' },
                },
                [
                    { op: 'lt', value: '200', param: 'pk' },
                    { op: 'gt', value: '50', param: 'pk' }
                ]
            ),
            'meta': () => dao.meta('helium_sample', 'datatypeshowcase'),
            'columnContent': () => dao.columnContent('helium_sample', 'big_table', 'pk'),
            'insertRow': () => dao.insertRow('helium_sample', {
                big_table: [{ pk: 1000 + Math.round(Math.random() * 100000000) }]
            })
        },
        cleanUp: () => db.closeAll()
    };
}

function initSuite(name: string, asyncSuite: AsyncBenchmarkSuite) {
    const suite = new Benchmark.Suite(name);

    for (const benchName of Object.keys(asyncSuite.benchmarks)) {
        suite.add(benchName, {
            defer: true,
            fn: (deferred) => {
                asyncSuite.benchmarks[benchName]()
                    .then(() => deferred.resolve())
                    .catch((err) => {
                        // tslint:disable:no-console
                        console.error(chalk.red(`Unexpected error while benchmarking ${name}.${benchName}`));
                        console.error(err);
                        suite.abort();
                    });
            }
        });
    }

    // tslint:disable:no-console
    suite.on('start', (event) => {
        console.log(chalk.blue('Started suite ' + name));
    });
    suite.on('cycle', (event) => {
        const bench = event.target;
        console.log(`${chalk.bold(bench.name)}: ${bench.hz} ops/sec (average ` +
            `${bench.stats.mean}ms ± ${bench.stats.rme}%)`);
    });
    suite.on('complete', asyncSuite.cleanUp);
    suite.on('abort', () => {
        console.error(chalk.red(`Suite ${name} aborted.`));
        asyncSuite.cleanUp();
    });

    // Not really used
    suite.on('error', (event) => {
        console.error(chalk.red('An unexpected error occurred'));
        console.error(event);
        asyncSuite.cleanUp();
    });

    return suite;
}

async function main() {
    let apiKey: string;
    try {
        apiKey = await db.authenticate({
            user: 'user',
            password: 'password',
            host: '127.0.0.1'
        });
    } catch (err) {
        console.error(chalk.red('Unable to connect to MySQL'));
        return;
    }

    const dao = new SchemaDao(db.queryHelper(apiKey));
    const benchmarks = createBenchmarks(dao);
    const suite = initSuite('SchemaDao', benchmarks);
    suite.run();
}

main().catch((err) => { throw err; });

interface AsyncBenchmarkSuite {
    benchmarks: { [name: string]: () => Promise<any> };
    cleanUp: () => Promise<any>;
}
