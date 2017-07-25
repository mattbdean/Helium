import * as del from 'del';

import * as gulp from 'gulp';
import * as about from 'gulp-about';
import * as tsc from 'gulp-typescript';
import * as merge from 'merge2';
import * as runSequence from 'run-sequence';

gulp.task('default', ['build']);

gulp.task('build', ['clean'], (cb) => {
    runSequence('common:build', 'server:build', cb);
});

gulp.task('testPrep', ['common:build', 'server:testPrep']);

gulp.task('watch', () => {
    watch({
        'common/**/*.ts': 'common:build',
        'db.conf.json': 'server:dbconf',
        'server/src/**/*.ts': 'server:compile'
    });
});

gulp.task('clean', () =>
    del([
        'dist',
        'server/src/common',
        'server/src/public',
        'server/src/about.json',
        'server/src/db.conf.json'
    ])
);

gulp.task('common:build', () => {
    const source = 'common/**/*.ts';
    return merge(
        cp(source, 'server/src/common'),
        cp(source, 'client/app/common')
    );
});

gulp.task('server:build', [
    'server:compile',
    'server:dbconf',
    'server:about'
]);

gulp.task('server:compile', () =>
    merge(
        typescript({
            project: 'server/tsconfig.json',
            src: 'server/src/**/*.ts',
            dest: 'dist'
        }),
        gulp.src('package.json')
            .pipe(about())
            .pipe(gulp.dest('dist'))
    )
);

gulp.task('server:dbconf', () =>
    cp('db.conf.json', 'dist'),
);

gulp.task('server:dbconf:testPrep', () =>
    cp('db.conf.json', 'server/src')
);

gulp.task('server:views:testPrep', () =>
    // Copy index.html so that GET /* won't throw a 404. In an actual build,
    // webpack will modify index.html and place it in this directory
    cp('client/index.html', 'server/src/public')
);

gulp.task('server:testPrep', ['server:views:testPrep', 'server:dbconf:testPrep']);

gulp.task('server:about', () =>
    gulp.src('package.json')
        .pipe(about())
        .pipe(gulp.dest('server/src'))
);

/** Options specific for compiling a TypeScript project */
interface CompileTypescriptOptions {
    /** Passed to gulp.src() */
    src: string | string[];
    /** Passed to gulp.dest() */
    dest: string;
    /** Path to tsconfig.json relative to Gruntfile.ts */
    project: string;
}

/**
 * Each entry in the configuration object maps a file glob to the task(s) to
 * execute when a file matching that glob is modified.
 */
interface WatchConfig {
    [fileGlob: string]: string[] | string;
}

/** Compiles a TypeScript project */
function typescript(opts: CompileTypescriptOptions) {
    const proj = tsc.createProject(opts.project);
    const result = gulp.src(opts.src).pipe(proj());

    return result.js.pipe(gulp.dest(opts.dest));
}

/** simple `cp -r` for gulp */
export function cp(src: string | string[], dest: string) {
    return gulp.src(src).pipe(gulp.dest(dest));
}

/** Uses gulp to watch for file changes */
export function watch(conf: WatchConfig) {
    for (const src of Object.keys(conf)) {
        // Ensure the tasks are an array
        const tasks = Array.isArray(conf[src]) ? conf[src] : [conf[src]];
        gulp.watch(src, tasks);
    }
}
