FROM node:18

ENV NPM_CONFIG_LOGLEVEL info

COPY . /work

WORKDIR /work
