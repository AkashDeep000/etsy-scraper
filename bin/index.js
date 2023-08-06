#! /usr/bin/env node
import { program } from "commander";
import { createSpinner } from "nanospinner";
import search from "../utils/search.js";
import getShopsUrl from "../utils/getShopsUrl.js";
import getShopsDetails from "../utils/getShopsDetails.js";
import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import { Parser } from "@json2csv/plainjs";
import chalk from "chalk";
import Bottleneck from "bottleneck";
import axios from "axios";
import axiosRetry, { isNetworkOrIdempotentRequestError } from "axios-retry";
import randUserAgent from "rand-user-agent";

//setting up commands
program
  .option(
    "-k --keywords <string>",
    'Comma separated keywords for product search (eg: etsy -k "keyword 1, keyword 1,keyword 3")'
  )
  .option("-p, --pages <number>", "Number of pages to scrape (default: 5)")
  .option("-ms, --minSales <number>", "Minimum sales to include")
  .option("-mr, --minReviews <number>", "Minimum reviews to include")
  .option(
    "-r, --rateLimit <number>",
    "Number of requests/second, decrease the number in case of bad request error (default: 50)"
  )
  .option(
    "-o, --output <path>",
    "Destination of output file (default: 'output.csv')"
  );

program.parse();
let { keywords, pages, minSales, minReviews, rateLimit, output } =
  program.opts();

if (!keywords) {
  program.help();
  process.exit(1);
}
if (!pages) {
  pages = 5;
}
if (!rateLimit) {
  rateLimit = 50;
}
if (!output) {
  output = "output.csv";
}

//sleap functiong
const sleap = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

//setting rate limiter
const limiter = new Bottleneck({
  minTime: 1000 / rateLimit,
  maxConcurrent: 10000,
});

let rateLimited = false;
let backlogReq = 0;

const rateLimitedRequest = limiter.wrap(async (url) => {
  try {
    const res = await axios.get(url, {
      header: {
        accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "accept-language": "en-IN,en-GB;q=0.9,en-US;q=0.8,en;q=0.7,bn;q=0.6",
        "cache-control": "no-cache",
        pragma: "no-cache",
        "upgrade-insecure-requests": "1",
        referer: "https://www.google.com/",
        "user-agent": randUserAgent(""),
      },
    });
    //console.log(new Date());
    return res.data;
  } catch (e) {
    throw new Error(e);
  }
});
//util function for creating increment file name if file already exist
const writeFile = async (filename, data, increment = 0) => {
  const name = `${filename.split(path.extname(filename))[0]}${
    increment || ""
  }${path.extname(filename)}`;
  return (
    (await fs
      .writeFile(name, data, { encoding: "utf8", flag: "wx" })
      .catch(async (ex) => {
        if (ex.code === "EEXIST")
          return await writeFile(filename, data, (increment += 1));
        throw ex;
      })) || name
  );
};

const keywordsArray = keywords.split(",");
let productsUrlAll;
let shopsUrlAll = [];
let shopsDetailsAll = [];

const productsSearchSpinner = createSpinner(
  "Searching all products..."
).start();
try {
  productsUrlAll = await Promise.all(
    keywordsArray.map((keyword) =>
      search({ keyword, pages, rateLimitedRequest })
    )
  );
  productsSearchSpinner.success();
} catch (e) {
  productsSearchSpinner.error();
  console.log(e);
  process.exit(1);
}

for (let i = 0; i < keywordsArray.length; i++) {
  const shopsUrlFinderSpinner = createSpinner(
    `Finding unique shops for ${keywordsArray[i]}...`
  );
  try {
    const shopsUrl = await getShopsUrl({
      productsUrl: productsUrlAll[i],
      keyword: keywordsArray[i],
      rateLimitedRequest,
    });
    shopsUrlAll.push(shopsUrl);
    shopsUrlFinderSpinner.start();
    shopsUrlFinderSpinner.success();
  } catch (e) {
    shopsUrlFinderSpinner.error();
    console.log(e);
    process.exit(1);
  }
}

for (let i = 0; i < keywordsArray.length; i++) {
  const shopsDetailsFetcherSpinner = createSpinner(
    `Fetching shops details for ${keywordsArray[i]}...`
  );
  try {
    const shopsDetails = await getShopsDetails({
      shopsLink: shopsUrlAll[i],
      keyword: keywordsArray[i],
      rateLimitedRequest,
    });
    shopsDetailsAll.push(shopsDetails);
    shopsDetailsFetcherSpinner.start();
    shopsDetailsFetcherSpinner.success();
  } catch (e) {
    shopsDetailsFetcherSpinner.error();
    console.log(e);
    process.exit(0);
  }
}
//marge all array inside shopsDetailsAll
let margedShopsDetailsAll = shopsDetailsAll.reduce((a, b) => a.concat(b), []);

//filter minSales
if (minSales) {
  margedShopsDetailsAll = margedShopsDetailsAll.filter(
    (details) => details.sales >= minSales
  );
}
//filter minReviews
if (minReviews) {
  margedShopsDetailsAll = margedShopsDetailsAll.filter(
    (details) => details.reviewCount >= minReviews
  );
}

// check if margedShopsDetailsAll length before saving
if (margedShopsDetailsAll.length === 0) {
  console.log(
    chalk.red.bold("No shop found:") + chalk.yellow(" Skipping file save")
  );
  process.exit(1);
}

const csvSavingSpinner = createSpinner(`Saving CSV file...`);
try {
  csvSavingSpinner.start();
  const parser = new Parser();
  const csv = parser.parse(margedShopsDetailsAll);
  const dir = path.dirname(output);
  if (!fsSync.existsSync()) {
    fsSync.mkdirSync(dir, { recursive: true });
  }
  const filePath = await writeFile(output, csv);
  csvSavingSpinner.success();
  console.log(
    chalk.green.bold("File path: ") +
      chalk.yellow.underline(path.resolve(filePath))
  );
  process.exit(0);
} catch (e) {
  csvSavingSpinner.error();
  console.log(e);
  process.exit(1);
}
