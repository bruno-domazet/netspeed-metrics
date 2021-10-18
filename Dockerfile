FROM node:latest

RUN mkdir -p /code
WORKDIR /code

COPY . .
# make initial run of speedtest.net (accepting licenses along the way)
RUN chmod +x ./speedtest

RUN yarn clean && yarn install && yarn build

EXPOSE 3002
CMD node dist/index.js