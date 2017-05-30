import * as del from 'del';
import * as fs from 'fs';

import * as gulp from 'gulp';
import * as coveralls from 'gulp-coveralls';
import * as nodemon from 'gulp-nodemon';
import tslint from 'gulp-tslint';
import * as runSequence from 'run-sequence';
import { distDir } from './tasks/util';

import registerModules from './tasks';
registerModules(gulp);

gulp.task('default', ['build'], (cb) => {
    runSequence('watch', 'start', cb);
});

gulp.task('build', ['clean'], (cb) => {
    runSequence('common:build', 'server:build', 'client:build', cb);
});

gulp.task('start', () => {
    // Read from standard config so devs can also run `nodemon` from the console
    // and have it work the same way as it does here
    const config = JSON.parse(fs.readFileSync('nodemon.json', 'utf8'));
    nodemon(config);
});

gulp.task('testPrep', ['common:build', 'server:testPrep']);

gulp.task('coveralls', () => {
    return gulp.src('coverage/lcov.info').pipe(coveralls());
});

gulp.task('lint', () => {
    return gulp.src(['server/**/*.ts', 'client/app/**/*.ts'])
        .pipe(tslint({
            configuration: 'tslint.json',
            formatter: 'prose'
        }))
        .pipe(tslint.report());
});

gulp.task('watch', [
    'client:watch',
    'common:watch',
    'server:watch'
]);

gulp.task('clean', ['client:clean', 'server:clean'], () =>
    del([
        distDir()
    ])
);
