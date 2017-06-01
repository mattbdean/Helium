import * as del from 'del';
import * as about from 'gulp-about';
import * as merge from 'merge2';

import {
    cp, distDir, typescript, watch
} from './util';

export default function(gulp) {
    gulp.task('server:build', [
        'server:compile',
        'server:views',
        'server:dbconf',
        'server:about'
    ]);

    gulp.task('server:compile', () =>
        merge(
            typescript({
                project: 'server/tsconfig.json',
                src: 'server/src/**/*.ts',
                dest: distDir()
            }),
            gulp.src('package.json')
                .pipe(about())
                .pipe(gulp.dest(distDir()))
        )
    );

    gulp.task('server:dbconf', () =>
        cp('db.conf.json', distDir())
    );

    gulp.task('server:views', () =>
        // Copy index.html so that GET /* won't throw a 404. In an actual build,
        // webpack will modify index.html and place it in this directory
        cp('client/app/index.html', 'server/src/public')
    );

    gulp.task('server:testPrep', ['server:views']);

    gulp.task('server:clean', () =>
        del([
            'server/src/common',
            'server/src/public',
            'server/src/about.json'
        ])
    );

    gulp.task('server:about', () =>
        gulp.src('package.json')
            .pipe(about())
            .pipe(gulp.dest('server/src'))
    );

    gulp.task('server:watch', () => {
        watch({
            'server/src/**/*.ts': 'server:compile'
        });
    });
}
