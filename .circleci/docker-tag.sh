#!/bin/bash

if [ -z ${CIRCLE_BRANCH} ]; then
    echo "CIRCLE_BRANCH not set" 1>&2
    exit 1
fi

if [ ${CIRCLE_BRANCH} == "master" ]; then
    echo "latest-dev"
else
    echo "latest-dev-${CIRCLE_BRANCH}"
fi
