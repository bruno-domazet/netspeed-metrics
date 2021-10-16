import * as client from "prom-client";

const labels = ["interface", "server"];
export const promClient = client;

export interface labelKeys {
  interface: string;
  server: string;
}

export const jitter = new client.Gauge({
  name: "jitter",
  help: "jitter",
  labelNames: labels,
});
export const latency = new client.Gauge({
  name: "latency",
  help: "latency",
  labelNames: labels,
});
export const upload = new client.Gauge({
  name: "upload",
  help: "bits per second",
  labelNames: labels,
});
export const download = new client.Gauge({
  name: "download",
  help: "bits per second",
  labelNames: labels,
});
