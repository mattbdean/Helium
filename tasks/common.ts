import * as gulp from 'gulp';
import * as merge from 'merge2';

import { cp, watch } from './util';

export default function() {
    gulp.task('common:build', () => {
        const SOURCE = 'common/**/*.ts';
        return merge(
            cp(SOURCE, 'server/src/common'),
            cp(SOURCE, 'client/app/common')
        );
    });

    gulp.task('common:watch', () => {
        watch({
            'common/**/*.ts': 'common:build'
        });
    });
}
