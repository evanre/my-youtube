#!/bin/bash

echo "**** install build packages ****" && \
apk add --no-cache --upgrade \
  git \
  nano \
  nodejs \
  npm \
  ffmpeg \

apk add --no-cache --upgrade --repository http://dl-cdn.alpinelinux.org/alpine/edge/community \
  youtube-dl

echo "**** install node_modules ****" && \
cd /config || exit
npm i --package-lock-only
