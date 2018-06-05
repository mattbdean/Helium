import * as Chartjs from 'chartjs-node';
import { spawn } from 'child_process';
import * as fs from 'fs';
import { max, mean, min, range } from 'lodash';
import * as os from 'os';
import * as path from 'path';
import * as readline from 'readline';

/** How many virtual users to add after every time k6 is invoked */
const VU_INTERVAL = 50;
/** Final number of virtual users */
const VU_MAX = 1000;
/**
 * Which scenario to run. The basename of a .js file in the
 * `load-testing/scenarios` directory.
 */
const SCENARIO = 'default';
/**
 * The maximum acceptable amount of time in milliseconds it should take for the
 * server to respond under "normal" usage.
 */
const ACCEPTABLE_RES_TIME = 100;
/**
 * How many seconds to run each scenario for. If this value is too low, there is
 * a possibility that the k6 script won't be able to finish, causing an error.
 */
const DURATION = 60;

function runScenario(conf: {
    name: string,
    jsonOutput: string,
    duration: number,
    virtualUsers: number
}): Promise<BaseResult[]> {
    const scenarioPath = path.resolve(__dirname, '..', 'scenarios', conf.name + '.js');
    const args = [
        'run', scenarioPath,
        '--out', 'json=' + conf.jsonOutput,
        '--duration', conf.duration + 's',
        '--vus', String(conf.virtualUsers)
    ];

    return new Promise((resolve, reject) => {
        // Spawn a new process to run k6
        const ps = spawn('k6', args);
        ps.on('close', resolve);
        ps.on('error', reject);
    })
        // Parse whatever JSON was produced
        .then(() => parseJsonResults(conf.jsonOutput))
        // If there aren't any HTTP metrics there was probably an error
        .then((results: BaseResult[]) => {
            if (results.find((m) => m.metric.startsWith('http_')) === undefined) {
                const err = new Error('No HTTP metrics were received');
                (err as any).args = args;
                throw err;
            }

            return results;
        });
}

function parseJsonResults(file: string): Promise<BaseResult[]> {
    const results: any[] = [];

    return new Promise((resolve, reject) => {
        const reader = readline.createInterface({
            input: fs.createReadStream(file)
        }); 

        reader.on('line', (line) => { results.push(JSON.parse(line)); });
        reader.on('close', () => resolve(results));
    });
}

function processResults(results: BaseResult[], vus: number): ProcessedResult {
    const durationMetricPoints = results
        // Get only Points for http_req_duration (total time for HTTP request)
        .filter((r) => r.type === 'Point' && r.metric === 'http_req_duration')
        // Get its value
        .map((p: Point) => p.data.value);
    
    return {
        min: min(durationMetricPoints),
        mean: mean(durationMetricPoints),
        max: max(durationMetricPoints),
        vus
    };
}

function createTempDir(): Promise<string> {
    const name = 'helium-load-testing-' + Math.random().toString(36).substr(2, 5);
    const dir = path.resolve(os.tmpdir(), name);
    return new Promise((resolve, reject) => {
        fs.mkdir(dir, (err) => {
            if (err) reject(err);
            else resolve(dir);
        });
    });
}

function createChart(data: ProcessedResult[]): Promise<any> {
    const chart = new Chartjs(1400, 1000);

    const options = {
        type: 'line',
        data: {
            labels: data.map((d) => d.vus),
            datasets: [
                {
                    label: 'Min',
                    data: data.map((d) => d.min),
                    borderColor: '#0288D1',
                    fill: false
                },
                {
                    label: 'Mean',
                    data: data.map((d) => d.mean),
                    borderColor: '#388E3C',
                    fill: false
                },
                {
                    label: 'Max',
                    data: data.map((d) => d.max),
                    borderColor: '#d32f2f',
                    fill: false
                },
                {
                    label: 'Acceptable Threshold',
                    data: data.map(() => ACCEPTABLE_RES_TIME),
                    borderColor: '#B0BEC5'
                }
            ]
        },
        options: {
            plugins: [{
                // Register a plugin to make the background white instead of
                // transparent
                beforeDraw: (c) => {
                    const ctx = c.chart.ctx;
                    ctx.fillStyle = 'white';
                    ctx.fillRect(0, 0, c.chart.width, c.chart.height);
                }
            }],
            scales: {
                yAxes: [{
                    ticks: {
                        callback: (value) => value + 'ms'
                    },
                    scaleLabel: {
                        display: true,
                        labelString: 'Response Time'
                    }
                }]
            }
        }
    };

    return chart.drawChart(options)
        .then(() => chart.getImageBuffer('image/png'));
    // TODO chart.destroy();
}

function chartFilename() {
    // TODO should probably make a more readable name
    return Date.now() + '.png';
}

interface ProcessedResult {
    min: number;
    mean: number;
    max: number;
    vus: number;
}

// tslint:disable:no-console
(async () => {
    const resultsDir = await createTempDir();
    const processed: ProcessedResult[] = [];

    const vuRange = range(VU_INTERVAL, VU_MAX + 1, VU_INTERVAL);

    console.log(`Running scenario '${SCENARIO}' with ${VU_INTERVAL}:${VU_INTERVAL}:${VU_MAX} ` +
        `virtual users for ${DURATION} seconds each`);
    console.log(`Approximate running time: ${((DURATION * vuRange.length) / 60).toFixed(1)} minutes`);
    for (const vus of vuRange) {
        process.stdout.write(`${vus} VUs: `);
        const result = await runScenario({
            name: SCENARIO,
            jsonOutput: path.resolve(resultsDir, vus + '.json'),
            virtualUsers: vus,
            duration: DURATION
        }).then((results) => processResults(results, vus));
        console.log(`average ${result.mean.toFixed(3)}ms`);
        processed.push(result);
    }

    const chart = await createChart(processed);
    fs.writeFileSync(chartFilename(), chart);
    console.log('Rendered chart to ' + path.resolve(chartFilename()));
})().catch((err) => {
    console.error(err);
    if (err.args) {
        console.error('k6 args: ' + err.args.join(' '));
    }
});
