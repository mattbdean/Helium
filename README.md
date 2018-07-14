# Helium

[![CircleCI](https://img.shields.io/circleci/project/github/mattbdean/Helium.svg)](https://circleci.com/gh/mattbdean/Helium)
[![Known Vulnerabilities](https://snyk.io/test/github/mattbdean/Helium/badge.svg)](https://snyk.io/test/github/mattbdean/Helium)
[![David](https://img.shields.io/david/mattbdean/Helium.svg)](https://david-dm.org/mattbdean/Helium)
[![GitHub release](https://img.shields.io/github/release/mattbdean/Helium/all.svg)](https://github.com/mattbdean/Helium/releases)
[![FOSSA Status](https://app.fossa.io/api/projects/git%2Bgithub.com%2Fmattbdean%2FHelium.svg?type=shield)](https://app.fossa.io/projects/git%2Bgithub.com%2Fmattbdean%2FHelium?ref=badge_shield)

> A Material Design webapp for [DataJoint](https://datajoint.github.io/) originally written with :heart: for the [Svoboda Lab](https://www.janelia.org/lab/svoboda-lab)

## Quickstart

Make sure to have the latest version of [Docker](https://docs.docker.com/install/) installed.

```
$ docker run -d --rm -p 3000:3000 --name helium mattbdean/helium:1.0.0
```

This will make Helium available at [localhost:3000](http://localhost:3000)

To make the website accessible without a port (`http://localhost`), bind the container's port 3000 to the host machine's port 80.

```
$ docker run -d --rm -p 80:3000 --name helium mattbdean/helium:1.0.0
```

Use `docker kill` to stop Helium

```
$ docker kill helium
```

## Docker

The newest Docker image that passed CI is located at `mattbdean/helium:latest-dev`. For branches other than master, use `mattbdean/helium:latest-dev-{branch}`.

```sh
$ docker run -d -p 3000:3000 --name helium mattbdean/helium:latest-dev
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
    -e MYSQL_ROOT_PASSWORD=toor \
    mysql:5.7
```

After MySQL has been initialized, add the testing data and user. The MySQL client must be installed.

```
$ mysql -u root -p -h 127.0.0.1 < server/test/init.sql
Enter password: (enter value of MYSQL_ROOT_PASSWORD from before)
```

When finished, kill the container

```
$ docker kill mysql-helium
```

### Versioning

1. Run `yarn version` to update `package.json` and create a tag. Don't push yet.

2. Make sure the unit and integration tests pass

```
$ yarn test:server && yarn test:client
```

3. Build the Docker image. The version name should start with "v", e.g. `v1.2.3`

```
$ docker build . -t mattbdean/helium:<new version>
```

4. Make sure the end-to-end tests pass

```
$ docker run -d --rm -p 3000:3000 --name helium mattbdean/helium:<new version>
$ yarn e2e:prepped
$ docker kill helium
```

5. Push the new tag and Docker image

```
$ git push --tags
$ docker push mattbdean/helium:<new version>
```


## Preview mode

A preview of Helium is available through [GitHub Pages](https://mattbdean.github.io/Helium/preview). This is how it works:

 1. When building the site with "preview" configuration, [`environment.ts`](https://github.com/mattbdean/Helium/blob/master/client/environments/environment.ts) is replaced with [`environment.preview.ts`](https://github.com/mattbdean/Helium/blob/master/client/environments/environment.prod.ts)
 2. Mock authentication and API services are used instead of the real ones if the environment's `preview` flag is true.
 3. The site is built at `docs/preview` with `yarn deploy:preview`. The base href (required for Angular's Router) and the deploy URL (for determining where the compiled JS files are located) are changed to where the site will be available on GitHub Pages.
 4. The new files under `docs/preview` are pushed, and GitHub Pages does the rest.

## License
[![FOSSA Status](https://app.fossa.io/api/projects/git%2Bgithub.com%2Fmattbdean%2FHelium.svg?type=large)](https://app.fossa.io/projects/git%2Bgithub.com%2Fmattbdean%2FHelium?ref=badge_large)
