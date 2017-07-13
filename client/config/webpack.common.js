const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const FaviconsWebpackPlugin = require('favicons-webpack-plugin');

module.exports = {
    context: path.join(__dirname, '..'),
    entry: {
        app: './app/main.ts',
        vendor: './app/vendor.ts',
        polyfills: './app/polyfills.ts'
    },
    output: {
        // Write all output files to this directory
        path: path.resolve(__dirname, '../../dist/public'),
        // <script> and <link> will be relative to this URI
        publicPath: '/',
        filename: '[name].js'
    },
    resolve: {
        extensions: ['.ts', '.js']
    },
    module: {
        rules: [
            {
                test: /\.scss$/,
                exclude: '/node_modules/',
                use:  ['raw-loader', 'sass-loader']
            },
            {
                test: /\.html$/,
                use: 'html-loader'
            },
            {
                test: /\.css$/,
                use: ['style-loader', 'css-loader']
            },
            {
                test: /\.(eot|woff2?|svg|ttf)([?]?.*)$/,
                use: 'file-loader'
            }
        ]
    },
    plugins: [
        new webpack.NoEmitOnErrorsPlugin(),
        new webpack.optimize.CommonsChunkPlugin({
            names: ['app', 'vendor', 'polyfills'],
        }),
        new webpack.DefinePlugin({
            PRODUCTION: process.env.NODE_ENV === 'prod' || process.env.NODE_ENV === 'production'
        }),
        // https://github.com/angular/angular/issues/11580#issuecomment-282705332
        new webpack.ContextReplacementPlugin(
            /angular(\\|\/)core(\\|\/)@angular/,
            path.resolve(__dirname, '../app')
        ),
        new HtmlWebpackPlugin({
            template: 'app/index.html',
            hash: true
        }),
        new FaviconsWebpackPlugin({
            logo: path.resolve(__dirname, '../../art/favicon.svg'),
            prefix: 'meta-[hash]/',
            // Generate a cache file with control hashes and don't rebuild the
            // favicons until those hashes change
            persistentCache: true,
            // Inject the html into the html-webpack-plugin
            inject: true
        })
    ]
};
