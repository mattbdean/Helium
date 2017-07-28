# Helium

[![CircleCI](https://img.shields.io/circleci/project/github/thatJavaNerd/Helium.svg)](https://circleci.com/gh/thatJavaNerd/Helium)
[![Known Vulnerabilities](https://snyk.io/test/github/thatJavaNerd/Helium/badge.svg)](https://snyk.io/test/github/thatJavaNerd/Helium)
[![David](https://img.shields.io/david/thatJavaNerd/Helium.svg)](https://david-dm.org/thatJavaNerd/Helium)

> Svoboda Lab experiment metadata collection and standardization

Notable dependencies:

- Node.js
- TypeScript
- Express
- MySQL
- Angular (v4)
- Gulp
- Webpack

Tests are written with Mocha, Chai, Karma, and Protractor.

This project uses TypeScript for both server and client. 

### Building

To get started, create `db.conf.json` in the project root.

```json
{
  "test": {
    "user": "user",
    "password": "password",
    "database": "helium"
  },
  "prod": {
    "user": "<production username>",
    "password": "<production password>",
    "database": "<production database>",
    "host": "<production host>"
  }
}
```

Inside `test` and `prod` you can specify any connection options supported by [mysqljs](https://github.com/mysqljs/mysql#connection-options).

Use the `dev` script for developing:

```sh
$ yarn dev
```

This will watch for any changes to server-side and client-side code and restart the server when necessary. HMR and livereload aren't supported at the moment, so a manual browser refresh is necessary to see the latest changes.

Set `NODE_ENV=prod` and use the `prod` script for a production build, which enables uglifying JS and AOT compilation. You can also specify `PORT=<whatever>` to change the HTTP port.

```sh
$ PORT=3001 NODE_ENV=prod yarn prod
```

### Testing

Run unit tests with `yarn test`, or specifically with `yarn test:client`, `yarn test:server`, and `yarn e2e`.

You can also run protractor with the element inspector using `yarn e2e:debug`.

To prevent rebuilding the website every time the e2e tests are run (what `yarn e2e` does), use two terminal windows. Run `PORT=4200 yarn dev` on the first and `yarn e2e:prepped` (or `yarn e2e:prepped:debug`) in the second whenever necessary.

