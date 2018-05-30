# Node 8+ should work
FROM node:8

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

# Build in dev mode
RUN yarn build

# Helium binds to port 3000 by default
EXPOSE 3000

# All compiled files are located in dist/
CMD node dist
