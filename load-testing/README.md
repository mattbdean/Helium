# Helium Load Testing

This module uses [k6](https://k6.io) to load test a Helium Docker image. A specific scenario is run repeatedly for some time with an increasing amount of virtual users (VUs). For example, this module might run the scenario with 50 VUs, then 100, etc., until a particular limit. The minimum, maximum, and average response times are recorded and a chart is produced when this progression has finished.

## Installation

This module, unlike the client and server, has its own `package.json` in order to separate production dependencies from load testing dependencies.

This module uses [chartjs-node](https://github.com/vmpowerio/chartjs-node) to render a chart after all load testing has been done. You'll need [Cairo](http://cairographics.org/) installed before you can install the dependencies. See [here](https://github.com/Automattic/node-canvas#compiling) for how to do that for common operating systems.

After Cairo is installed, install the dependencies normally.

```
yarn install
```

Download a [prebuilt k6 binary](https://github.com/loadimpact/k6/releases) and add it to your `$PATH`.

## Environment Setup

Start MySQL via Docker

```
$ docker run --name mysql-helium --rm -d -p 3306:3306 \                        
    -e MYSQL_ALLOW_EMPTY_PASSWORD=true \
    -e MYSQL_HOST=127.0.0.1 \
    -e MYSQL_ROOT_HOST=% \
    -e MYSQL_ROOT_PASSWORD=toor \
    mysql:5.7
```

Start Helium

```
$ docker run -p 3000:3000 --rm --net=host --name helium mattbdean/helium:latest
```

Create the testing data

```
$ mysql -u root -p -h 127.0.0.1 < ../server/test/init.sql
```

## Running

Transpile from TypeScript to JavaScript

```
$ yarn build
```

Start load testing

```
$ node dist
```
