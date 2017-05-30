const path = require('path');
const webpack = require('webpack');

module.exports = {
    devtool: 'eval-source-map',
    resolve: {
        extensions: ['.ts', '.js']
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                loaders: [
                    {
                        loader: 'awesome-typescript-loader',
                        options: {
                            configFileName: 'client/tsconfig.json'
                        }
                    },
                    'angular2-template-loader'
                ]
            },
            {
                test: /\.pug$/,
                loader: ['raw-loader', 'pug-html-loader']
            },
            {
                test: /\.scss$/,
                loaders:  ['raw-loader', 'sass-loader']
            }
        ]
    },
    plugins: [
        // https://github.com/angular/angular/issues/11580#issuecomment-282705332
        new webpack.ContextReplacementPlugin(
            /angular(\\|\/)core(\\|\/)@angular/,
            path.resolve(__dirname, '../app')
        )
    ]
};
