import fastify from "fastify";

import fs from "fs/promises";
import { exec } from "child_process";
import { download, upload, jitter, latency, promClient } from "./metrics";

const app = fastify();
app.get("/metrics", async (req, res) => {
  await readSpeedTest(`${__dirname}/../results.json`);

  res.header("Content-Type", promClient.register.contentType);

  return res.status(200).send(await promClient.register.metrics());
});

app.listen({ port: 3000, host: "0.0.0.0" }).then(() => {
  console.log("Server running at http://localhost:3000/");
});

const calcSpeed = (bytes: number, miliseconds: number) => {
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
  console.log(`running speedtest...`);
  const ls = exec(
    __dirname + "/../speedtest -f json > ./../results.json",
    (error, stdout, stderr) => {
      if (error) {
        console.error("Error code: " + error.code);
        console.error("Signal received: " + error.signal);
        console.error(error.stack);
      }
      if (stdout) {
        console.log("Child Process STDOUT: " + stdout);
      }
      if (stderr) {
        console.error("Child Process STDERR: " + stderr);
      }
    }
  );

  ls.on("exit", (code) => {
    console.log("Child process exited with exit code: " + code);
  });
};
