const merge = require('webpack-merge');

module.exports = merge(require('./webpack.common'), {
    devtool: 'eval-source-map',
    module: {
        rules: [
            {
                test: /\.ts$/,
                use: [
                    {
                        loader: 'awesome-typescript-loader',
                        options: {
                            configFileName: 'client/tsconfig.json'
                        }
                    },
                    'angular2-template-loader'
                ]
            },
        ]
    }
});
