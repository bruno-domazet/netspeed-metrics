#!/bin/bash
[[ ! -z $(docker ps --all --filter name=netspeed -q) ]] && docker rm --force --volumes netspeed
docker build --tag netspeed-metrics:latest . 
docker run -d -p 3002:3002 --name netspeed netspeed-metrics:latest