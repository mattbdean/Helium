# Helium

[![CircleCI](https://img.shields.io/circleci/project/github/thatJavaNerd/Helium.svg)](https://circleci.com/gh/thatJavaNerd/Helium)
[![Known Vulnerabilities](https://snyk.io/test/github/thatJavaNerd/Helium/badge.svg)](https://snyk.io/test/github/thatJavaNerd/Helium)
[![David](https://img.shields.io/david/thatJavaNerd/Helium.svg)](https://david-dm.org/thatJavaNerd/Helium)

> Svoboda Lab experiment metadata collection and standardization

Notable dependencies:

- Node.js
- Express
- MySQL
- Angular (v4)
- Gulp
- Webpack

Tests are written with Mocha, Chai, Karma, and Protractor.

This project is written with a lot of cool things like arrow and async functions, so you should probably be using the latest 7.x Node.js build, but anything above 7.6 should work.

### Building

Helium uses Gulp and Webpack for its build process. The default task will build the client and server, start the app, and watch for any changes.

```sh
$ gulp [--watch]
```

You can specify `PORT=<whatever>` to change the HTTP port.

Set `NODE_ENV=prod` for a production build, which enables uglifying JS and AOT compilation.

### Testing

Run unit tests with `yarn test`, or specifically with `yarn test:client`, `yarn test:server`, and `yarn e2e`.

You can also run protractor with the element inspector using `yarn e2e:live`

