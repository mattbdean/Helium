# Helium

[![CircleCI](https://img.shields.io/circleci/project/github/mattbdean/Helium.svg)](https://circleci.com/gh/mattbdean/Helium)
[![Known Vulnerabilities](https://snyk.io/test/github/mattbdean/Helium/badge.svg)](https://snyk.io/test/github/mattbdean/Helium)
[![David](https://img.shields.io/david/mattbdean/Helium.svg)](https://david-dm.org/mattbdean/Helium)
[![GitHub release](https://img.shields.io/github/release/mattbdean/Helium/all.svg)](https://github.com/mattbdean/Helium/releases)
[![FOSSA Status](https://app.fossa.io/api/projects/git%2Bgithub.com%2Fmattbdean%2FHelium.svg?type=shield)](https://app.fossa.io/projects/git%2Bgithub.com%2Fmattbdean%2FHelium?ref=badge_shield)

> A Material Design webapp for [DataJoint](https://datajoint.github.io/) originally written with :heart: for the [Svoboda Lab](https://www.janelia.org/lab/svoboda-lab)

## Quickstart

Make sure to have [yarn](https://yarnpkg.com/lang/en/docs/install/) and [Node.js](https://nodejs.org/en/download/) (version 8 or higher) installed.

```sh
$ git clone https://github.com/mattbdean/Helium
$ cd Helium
$ git checkout tags/v1.0.0-alpha
$ yarn install
```

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

## Docker

Helium provides several experimental Docker images. Full support will come with the release of [1.0.0](https://github.com/mattbdean/Helium/milestone/3).

The newest Docker image that passed CI is located at `mattbdean/helium:latest-dev`. For branches other than master, use `mattbdean/helium:latest-dev-{branch}`.

```sh
$ docker run -d -p --name helium 3000:3000 mattbdean/helium:latest-dev
$ curl localhost:3000  # do some work
$ docker kill helium  # stop helium when you're done
```

See also [#59](https://github.com/mattbdean/Helium/issues/59).

## Contributing

Helium runs on a TypeScript-based MEAN stack (but with MySQL instead of MongoDB) and is tested with Mocha, Chai, Karma, and Protractor.

Make sure to have a MySQL database running on your local machine. Then run the contents of `server/test/init.sql` to insert test data.

```sh
$ mysql -u root -p < server/test/init.sql
```

This will (re)create a user with name `user` and password `password`, as well as the `helium` database.

Use the `dev` script for developing:

```sh
$ yarn dev
```

This will watch for any changes to server-side and client-side code and restart the server when necessary. HMR and livereload aren't supported at the moment, so a manual browser refresh is necessary to see the latest changes.

### Testing

Run unit tests with `yarn test`, or specifically with `yarn test:client`, `yarn test:server`, and `yarn e2e`.

You can also run protractor and debug using `chrome://inspect` using `yarn e2e:debug`.

To prevent rebuilding the website every time the e2e tests are run (what `yarn e2e` does), use two terminal windows. Run `yarn dev` on the first and `yarn e2e:prepped` (or `yarn e2e:prepped:debug`) in the second whenever necessary.

#### Docker Database Container for Testing

First create a MySQL 5.7 container and expose its 3306 port

```
$ docker run --name mysql-helium --rm -d -p 3306:3306 \
    -e MYSQL_ALLOW_EMPTY_PASSWORD=true \
    -e MYSQL_HOST=127.0.0.1 \
    -e MYSQL_ROOT_HOST=% \
    -e MYSQL_USER=root \
    mysql:5.7
```

After MySQL has been initialized, add the testing data and user. The MySQL client must be installed.

```
$ mysql -u root -h 127.0.0.1 < server/test/init.sql
```

When finished, kill the container

```
$ docker kill mysql-helium
```

## License
[![FOSSA Status](https://app.fossa.io/api/projects/git%2Bgithub.com%2Fmattbdean%2FHelium.svg?type=large)](https://app.fossa.io/projects/git%2Bgithub.com%2Fmattbdean%2FHelium?ref=badge_large)
