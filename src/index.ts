import fastify from "fastify";

import fs from "fs/promises";
import { exec } from "child_process";
import { download, upload, jitter, latency, promClient } from "./metrics";

const app = fastify();
let runningTest = false;

app.get("/metrics", async (req, res) => {
  const resp = await readSpeedTest(`${__dirname}/../results.json`);

  // if errors, return em
  if (!resp) return res.status(500).send();

  res.header("Content-Type", promClient.register.contentType);
  return res.status(200).send(await promClient.register.metrics());
});

app.listen({ port: 3000, host: "0.0.0.0" }).then(() => {
  console.log("Server running at http://localhost:3000/");
});

const calcSpeed = (bytes: number, miliseconds: number) => {
  // convert bytes and milliseconds to bits per second
  return Math.round(bytes * 8) / Math.round(miliseconds / 1000);
};

const readSpeedTest = async (filePath: string) => {
  const file = await fs.readFile(filePath, "utf8");

  if (!file) return false;

  const results = JSON.parse(file);
  if (!results) return false;

  if (results.error) {
    console.error(results);
    return false;
  }

  // set metrics
  const metricLabels = {
    interface: results.interface.name,
    server: results.server.host,
  };

  download.set(
    metricLabels,
    calcSpeed(results.download.bytes, results.download.elapsed)
  );

  upload.set(
    metricLabels,
    calcSpeed(results.upload.bytes, results.upload.elapsed)
  );

  jitter.set(metricLabels, results.ping.jitter);
  latency.set(metricLabels, results.ping.latency);

  // run the next speed test
  runSpeedTest();

  return true;
};

const runSpeedTest = async () => {
  if (runningTest) {
    console.log("speedtest already in progress...");
    return false;
  }
  console.log(`running speedtest...`);

  // call speedtest cli with no progress bar and output to file
  const cmd = exec(
    __dirname + "/../speedtest -p no -f json > ./../results.json",
    (error, stdout, stderr) => {
      if (error || stderr) {
        console.error(error || stderr);
        runningTest = false;
      }
      if (stdout) {
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
    } else {
      console.error("Child process exited", { code });
    }
  });
};
