import * as util from "util";
import { CronJob } from "cron";
import { logger } from "../logger";
import * as redis from "redis";
import { promisify } from "util";
import * as rp from "request-promise";
// Imports the Google Cloud client library
const {Storage} = require('@google-cloud/storage');

// Decode GCP Service Account key.
let gcsKeyEncoded = process.env.GCS_KEY_ENCODED;
if (gcsKeyEncoded == null || gcsKeyEncoded == "") {
  console.log("need environment variable GCS_KEY_ENCODED base64 encoded JSON of service account key.");
  gcsKeyEncoded = "e30=" // empty JSON object
}
let gcsKeyBuffer = Buffer.from(gcsKeyEncoded, "base64");
let gcsKeyDecoded = gcsKeyBuffer.toString("ascii");
const gcsKey = JSON.parse(gcsKeyDecoded);

// Create a client with credentials passed by value as a JavaScript object
const storage = new Storage({credentials: gcsKey});

const bucket = storage.bucket(process.env.GCS_BUCKET);

let registryURL = process.env.REGISTRY_URL;
if (registryURL == null || registryURL == "") {
  registryURL = "https://ttl.sh"
}

const client = redis.createClient({url: process.env["REDISCLOUD_URL"]});
const smembersAsync = promisify(client.smembers).bind(client);
const sremAsync = promisify(client.srem).bind(client);
const hgetAsync = promisify(client.hget).bind(client);
const delAsync = promisify(client.del).bind(client);

const tagRegex = new RegExp("docker/registry/v2/repositories/(.*)/_manifests/tags/(.*)/current/link");

exports.name = "prune";
exports.describe = "find and prune untracked tags";
exports.builder = {

};

exports.handler = async (argv) => {
  main(argv).catch((err) => {
    console.log(`Failed with error ${util.inspect(err)}`);
    process.exit(1);
  });
};

async function main(argv): Promise<any> {
  process.on('SIGTERM', function onSigterm () {
    logger.info(`Got SIGTERM, cleaning up`);
    process.exit();
  });

  let jobRunning: boolean = false;
  
  const job = new CronJob({
    cronTime: "* * * * *",
    onTick: async () => {
      if (jobRunning) {
        console.log("-----> previous prune job is still running, skipping");
        return;
      }

      console.log("-----> beginning to prune orphaned tags");
      jobRunning = true;

      try {
        await pruneOrphanedTags();
      } catch(err) {
        console.log("failed to prune orphaned tags:", err);
      } finally {
        jobRunning = false;
      }
    },
    start: true,
  });

  job.start();
}

async function pruneOrphanedTags() {
//  const now = new Date().getTime();
//  const images = await smembersAsync("current.images");
//  console.log(`   there are ${images.length} total images to evaluate`);
  const getFilesOptions = {
    matchGlob: "docker/registry/v2/repositories/*/_manifests/tags/*/current/link",
  };
  bucket.getFilesStream(getFilesOptions)
    .on('error', (err) => {
      return console.error(err.toString());
    })
    .on('data', (file) => {
      console.log(file.name);
      const match = file.name.match(tagRegex);
      const tag = `${match[1]}:${match[2]}`;
      console.log(tag);
    })
    .on('end', () => {
      return console.log("stream ended.");
    });
//  for (const image of images) {
//    try {
//      const expireAt = await hgetAsync(image, "expires");
//
//      if (+expireAt > now) {
//        const minutesLeft = (+expireAt - now) / 1000 / 60;
//        console.log(`not expiring ${image} for another ~${Math.round(minutesLeft)} minute(s)`);
//        continue;
//      }
//
//      const imageAndTag = image.split(":");
//      const headers = {
//        "Accept": "application/vnd.docker.distribution.manifest.v2+json",
//      };
//
//      console.log(`querying ${image}`);
//
//      // Get the manifest from the tag
//      const getOptions = {
//        method: "HEAD",
//        uri: `${registryURL}/v2/${imageAndTag[0]}/manifests/${imageAndTag[1]}`,
//        headers,
//        resolveWithFullResponse: true,
//        simple: false,
//      }
//      const getResponse = await rp(getOptions);
//
//      if (getResponse.statusCode == 404) {
//        await sremAsync("current.images", image);
//        await delAsync(image);
//        continue;
//      }
//
//      const deleteURI = `${registryURL}/v2/${imageAndTag[0]}/manifests/${getResponse.headers.etag.replace(/"/g,"")}`;
//
//      //console.log(`deleting ${deleteURI}`);
//
//      // Remove from the registry
//      const options = {
//        method: "DELETE",
//        uri: deleteURI,
//        headers,
//        resolveWithFullResponse: true,
//        simple: false,
//      }
//
//      await rp(options);
//
//      console.log(`expiring ${image}`);
//      await sremAsync("current.images", image);
//      await delAsync(image);
//    } catch(err) {
//      console.log(`failed to evaluate image ${image}:`, err);
//    }
//  }
}
