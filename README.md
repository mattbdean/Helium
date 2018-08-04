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

Helium is written in TypeScript. A JSON API is made available using a Node.js/Express.js server and the front-end is built with Angular 6. Helium is tested with Mocha, Chai, Karma, and Protractor.


### Project Structure

 - `.circleci/`: Configuration for the [CircleCI workflow](https://circleci.com/gh/mattbdean/Helium)
 - `client/`: Front-end code. Anything Angular can be found here.
 - `common/`: Code and typings common to the front-end and server-side code. Copied to `client/app/common/` and `server/src/common/` when building.
 - `datajoint-compat/`: Test DataJoint compatibility
 - `dist/`: Compiled files live here. Once compiled, run `node dist` to start the server.
 - `dist/public/`: All files in this directory will be made available as static assets. The code in `client/` is built to this directory
 - `docs/`: Source for the [GitHub Pages website](https://mattbdean.github.io/Helium/).
 - `docs/preview/`: The preview version of the front-end is built to this directory
 - `e2e/`: End-to-end tests. Use `ng e2e` to run.
 - `load-testing/`: Very simple load testing scripts. It has its own [README](https://github.com/mattbdean/Helium/blob/master/load-testing/README.md).
 - `server/`: The Node.js-based server. 
 - `server/benchmarks/`: Simple benchmarks for the server-side code. Use `yarn ts-node server/benchmarks/{file}.ts` to run a benchmark.
 
### Building

Use the `dev` script for developing:

```sh
$ yarn dev
```

While running, any changes to the front-end code will cause a small rebuild and any changes to server-side code will cause the server to restart.

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

This will (re)create a user with name `user` and password `password`, as well as the `helium` database. When finished, kill the container

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

5. Push the new commit, tag, and Docker image

```
$ git push && git push --tags
$ docker push mattbdean/helium:<new version>
```

6. Deploy the preview build to GitHub Pages

```
$ yarn build:preview
$ git add docs/preview
$ git commit
$ git push
```

### Preview mode

A preview of Helium is available through [GitHub Pages](https://mattbdean.github.io/Helium/preview). This is how it works:

 1. When building the site with "preview" configuration, [`environment.ts`](https://github.com/mattbdean/Helium/blob/master/client/environments/environment.ts) is replaced with [`environment.preview.ts`](https://github.com/mattbdean/Helium/blob/master/client/environments/environment.prod.ts)
 2. Mock authentication and API services are used instead of the real ones if the environment's `preview` flag is true.
 3. The site is built at `docs/preview` with `yarn deploy:preview`. The base href (required for Angular's Router) and the deploy URL (for determining where the compiled JS files are located) are changed to where the site will be available on GitHub Pages.
 4. The new files under `docs/preview` are pushed, and GitHub Pages does the rest.

## License
[![FOSSA Status](https://app.fossa.io/api/projects/git%2Bgithub.com%2Fmattbdean%2FHelium.svg?type=large)](https://app.fossa.io/projects/git%2Bgithub.com%2Fmattbdean%2FHelium?ref=badge_large)
