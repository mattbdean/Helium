# This Dockerfile is for the image that runs jobs on CircleCI. It's not very
# different other than the fact that we install mysql-client.

FROM circleci/node:9-browsers

# We need the mysql command available to us
RUN sudo apt-get install mysql-client
