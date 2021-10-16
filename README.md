# netspeed-metrics

Expose internet speed metrics to prometheus

ookla-speedtest-1.0.0-x86_64-linux.tgz cli bundled

# Run

```
docker build --tag netspeed-metrics:latest . && docker rm --force netspeed && docker run -d -p 3000:3000 --name netspeed netspeed-metrics:latest
```
