#!/bin/bash
[[ ! -z $(docker ps --all --filter name=netspeed -q) ]] && docker rm --force --volumes netspeed
docker build --tag netspeed-metrics:latest .
DNS_IP=$(grep nameserver /etc/resolv.conf | cut -d ' ' -f2) 
docker run --dns $DNS_IP -d -p 3002:3002 --name netspeed netspeed-metrics:latest