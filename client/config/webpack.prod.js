const webpack = require('webpack');
const merge = require('webpack-merge');
const AotPlugin = require('@ngtools/webpack').AotPlugin;

module.exports = merge(require('./webpack.common'), {
    devtool: 'source-map',
    module: {
        rules: [
            {
                test: /\.ts$/,
                exclude: /node_modules/,
                use: ['@ngtools/webpack']
            }
        ]
    },
    plugins: [
        new webpack.optimize.UglifyJsPlugin(),
        new AotPlugin({
            tsConfigPath: 'client/tsconfig.json',
            mainPath: 'app/main.ts',
            exclude: ['e2e', 'app/**/*.spec.ts']
        })
    ]
});
