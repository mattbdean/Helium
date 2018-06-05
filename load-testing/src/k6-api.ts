// See here: https://docs.k6.io/docs/results-output

/**
 * The common interface between Metrics and Points
 */
interface BaseResult {
    type: 'Metric' | 'Point';
    data: any;
    metric: string;
}

/**
 * "Contains information about the nature of a metric"
 */
interface Metric extends BaseResult {
    type: 'Metric';
    data: {
        type: 'gauge' | 'rate' | 'counter' | 'trend';
        contains: string;
        tainted: any;
        thresholds: any[];
        submetrics: any[];
    };
}

/**
 * A data sample
 */
interface Point extends BaseResult {
    type: 'Point';
    data: {
        time: string;
        value: any;
        tags: any;
    };
}
