# Helium

[![CircleCI](https://img.shields.io/circleci/project/github/mattbdean/Helium.svg)](https://circleci.com/gh/mattbdean/Helium)
[![Known Vulnerabilities](https://snyk.io/test/github/mattbdean/Helium/badge.svg)](https://snyk.io/test/github/mattbdean/Helium)
[![David](https://img.shields.io/david/mattbdean/Helium.svg)](https://david-dm.org/mattbdean/Helium)
[![GitHub release](https://img.shields.io/github/release/mattbdean/Helium/all.svg)](https://github.com/mattbdean/Helium/releases)

> A Material Design webapp for [DataJoint](https://datajoint.github.io/) originally written with :heart: for the [Svoboda Lab](https://www.janelia.org/lab/svoboda-lab)

## Quickstart

Make sure to have [yarn](https://yarnpkg.com/lang/en/docs/install/) and [Node.js](https://nodejs.org/en/download/) (version 8 or higher) installed.

```sh
$ git clone https://github.com/mattbdean/Helium
$ cd Helium
$ git checkout tags/v1.0.0-alpha
$ yarn install
```

Create the file `db.conf.json` in the project root:

```json
{
  "prod": {
    "user": "<database username>",
    "password": "<database password>",
    "database": "<schema name>",
    "host": "<database hostname>"
  }
}
```

> The database user should have access to read and insert data on the given database.

Run the website on [localhost:3000](http://localhost:3000):

```sh
$ yarn prod
```

Once the website is built, you can re-run it with

```sh
$ node dist
```

Change the port like this:

```sh
$ PORT=3001 yarn prod
```

Now you can access the website at [localhost:3001](http://localhost:3001).

> If you want to run Helium on the default HTTP port (80), you'll have to run it as root. 

## Contributing

Helium runs on a TypeScript-based MEAN stack (but with MySQL instead of MongoDB) and is tested with Mocha, Chai, Karma, and Protractor.

Make sure to have a MySQL database running on your local machine. Then run the contents of `server/test/init.sql` to insert test data.

```sh
$ mysql -u root -p < server/test/init.sql
```

This will (re)create a user with name `user` and password `password`, as well as the `helium` database. Then add these credentials to `db.conf.json`:

```json
{
  "test": {
    "user": "user",
    "password": "password",
    "database": "helium"
  }
}
```

Inside  `prod` and `test` you can specify any connection options supported by [mysqljs](https://github.com/mysqljs/mysql#connection-options).

Use the `dev` script for developing:

```sh
$ yarn dev
```

This will watch for any changes to server-side and client-side code and restart the server when necessary. HMR and livereload aren't supported at the moment, so a manual browser refresh is necessary to see the latest changes.

### Testing

Run unit tests with `yarn test`, or specifically with `yarn test:client`, `yarn test:server`, and `yarn e2e`.

You can also run protractor with the element inspector using `yarn e2e:debug`.

To prevent rebuilding the website every time the e2e tests are run (what `yarn e2e` does), use two terminal windows. Run `yarn dev` on the first and `yarn e2e:prepped` (or `yarn e2e:prepped:debug`) in the second whenever necessary.

