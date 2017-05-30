import client from './client';
import common from './common';
import server from './server';

const MODULES = [
    client,
    common,
    server
];

export default function(gulp) {
    for (const mod of MODULES) {
        mod(gulp);
    }
}
