import fastify from "fastify";

import { readFile, stat, writeFile } from "fs/promises";
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
const resultsPath = process.env.RESULTS_PATH || "/tmp/results.json";
const serverConfig = { port: 3002, host: "0.0.0.0" };

// server
const app = fastify();

app.get("/metrics", async (req, res) => {
  const resp = await readSpeedTest(resultsPath);

  // queue new speedtest
  runSpeedTest(resultsPath);

  // fail on errors
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
//////// Helpers ///////////

const calcSpeed = (bytes: number, miliseconds: number) => {
  // convert bytes and milliseconds to bits per second
  return Math.round(bytes * 8) / Math.round(miliseconds / 1000);
};

// read and parse local file (cache)
const readSpeedTest = async (filePath: string) => {
  if (!(await stat(filePath))) {
    console.error("failed to access file", { filePath });
    return false;
  }

  const file = await readFile(filePath, "utf8");

  if (!file || !file.length) {
    console.error("file empty", { filePath });
    return false;
  }

  const results = JSON.parse(file);
  if (!results) {
    console.error("failed to parse JSON", { filePath });
    return false;
  }

  // speedtest call returned with errors
  if (results.error) {
    console.error(results);
    return false;
  }

  return results;
};

// invoke speedtest cli and write results to local file (cache)
const runSpeedTest = async (filePath: string) => {
  if (runningTest) {
    console.log("speedtest already in progress...");
    testCounter.inc({ type: "noop" });
    return false;
  }
  console.log(`running speedtest...`);

  // call speedtest cli with no progress bar and output to file
  const cmd = exec(
    (process.env.SPEEDTEST_BIN_PATH || __dirname + "/../speedtest") +
      " --accept-license --accept-gdpr -p no -f json",
    async (error, stdout, stderr) => {
      if (error || stderr) {
        console.error(error || stderr);
      }
      if (stdout) {
        await writeFile(filePath, stdout);
        console.log({ stdout });
      }
    }
  );

  if (cmd.pid) {
    runningTest = true;
  }

  cmd.on("exit", (code) => {
    runningTest = false;
    console.log({ code });

    // inc counters
    if (code === 0) {
      testCounter.inc({ type: "success" });
    } else {
      testCounter.inc({ type: "error" });
    }
  });
};

// start server
app.listen(serverConfig).then(() => {
  console.log(`Server running at ${serverConfig.host}:${serverConfig.port}`);
});
