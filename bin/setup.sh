#!/bin/bash
docker rm --force netspeed 
docker build --tag netspeed-metrics:latest . 
docker run -d -p 3002:3002 --name netspeed netspeed-metrics:latest