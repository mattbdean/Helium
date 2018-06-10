# Node 8+ should work
FROM node:8-alpine

WORKDIR /usr/src/app

# Get our dependencies ready
COPY package.json yarn.lock .snyk ./
RUN yarn install

# Add all the necessary build-related files
COPY angular.json .babelrc Gulpfile.ts tsconfig.json ./

# Add all sources
COPY common ./common
COPY client ./client
COPY server ./server

# Build in production mode
RUN yarn build:prod

# Helium binds to port 3000 by default
EXPOSE 3000

ENV NODE_ENV=prod

# All compiled files are located in dist/
CMD node dist
