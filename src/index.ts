import fastify from "fastify";

import fs from "fs/promises";
import { exec } from "child_process";
import {
  download,
  upload,
  jitter,
  latency,
  promClient,
  testCounter,
} from "./metrics";

// globals
let runningTest = false;
const resultsPath = "/code/results.json";

// server
const app = fastify();

app.get("/metrics", async (req, res) => {
  const resp = await readSpeedTest(resultsPath);
  // queue new speedtest
  runSpeedTest(resultsPath);

  // if errors, return em
  if (!resp) {
    testCounter.inc({ type: "error" });
    return res.status(500).send();
  }

  // set metric labels
  const metricLabels = {
    interface: resp.interface.name,
    server: resp.server.host,
  };

  download.set(
    metricLabels,
    calcSpeed(resp.download.bytes, resp.download.elapsed)
  );

  upload.set(metricLabels, calcSpeed(resp.upload.bytes, resp.upload.elapsed));

  jitter.set(metricLabels, resp.ping.jitter);
  latency.set(metricLabels, resp.ping.latency);

  res.header("Content-Type", promClient.register.contentType);
  return res.status(200).send(await promClient.register.metrics());
});

app.listen({ port: 3002, host: "0.0.0.0" }).then(() => {
  console.log("Server running at http://localhost:3000/");
});

// Helpers
const calcSpeed = (bytes: number, miliseconds: number) => {
  // convert bytes and milliseconds to bits per second
  return Math.round(bytes * 8) / Math.round(miliseconds / 1000);
};

const readSpeedTest = async (filePath: string) => {
  const file = await fs.readFile(filePath, "utf8");

  if (!file) {
    console.error("failed to read file", { filePath });
    return false;
  }

  const results = JSON.parse(file);
  if (!results) {
    console.error("failed to parse JSON", { filePath });
    return false;
  }

  if (results.error) {
    console.error(results);
    return false;
  }

  return results;
};

const runSpeedTest = async (filePath: string) => {
  if (runningTest) {
    console.log("speedtest already in progress...");
    testCounter.inc({ type: "noop" });
    return false;
  }
  console.log(`running speedtest...`);

  // call speedtest cli with no progress bar and output to file
  const cmd = exec(
    "/code/speedtest  --accept-license --accept-gdpr -p no -f json",
    async (error, stdout, stderr) => {
      if (error || stderr) {
        console.error(error || stderr);
      }
      if (stdout) {
        await fs.writeFile(filePath, stdout);
        console.log({ stdout });
      }
    }
  );

  if (cmd.pid) {
    runningTest = true;
  }

  cmd.on("exit", (code) => {
    runningTest = false;
    if (code === 0) {
      console.log("Child process exited", { code });
      testCounter.inc({ type: "success" });
    } else {
      console.error("Child process exited", { code });
      testCounter.inc({ type: "error" });
    }
  });
};
