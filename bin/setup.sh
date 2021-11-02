#!/bin/bash
[[ ! -z $(docker ps --all --filter name=netspeed -q) ]] && docker rm --force --volumes netspeed
docker build --tag netspeed-metrics:latest .
DNS_IP=8.8.8.8
docker run --dns $DNS_IP -d -p 3002:3002 --name netspeed netspeed-metrics:latest