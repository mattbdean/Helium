import * as del from 'del';

import {
    distDir, sass, watch, webpackCompiler
} from './util';

const publicDir = (rel: string = '') => distDir('public/' + rel);

export default function(gulp) {
    gulp.task('client:build', [
        'client:bundle',
        'client:styles'
    ]);

    gulp.task('client:bundle', (callback: () => void) => {
        webpackCompiler({
            gulpCallback: callback,
            watch: process.argv.indexOf('--watch') >= 0
        });
    });

    gulp.task('client:styles', () =>
        sass({
            src: 'client/assets/**/*.scss',
            dest: publicDir('assets')
        })
    );

    gulp.task('client:clean', () =>
        del([
            'client/app/common'
        ])
    );

    gulp.task('client:watch', () => {
        watch({
            'client/assets/**/*.scss': 'client:styles'
        });
    });
}
