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

program
  .option(
    "-k --keywords <string>",
    "Comma separated keywords for product search"
  )
  .option("-p, --pages <number>", "Number of pages to scrape (default: 5)")
  .option("-ms, --minSales <number>", "Minimum sales to include")
  .option("-mr, --minReviews <number>", "Minimum reviews to include")
  .option(
    "-b, --batchSize <number>",
    "Number of requests at once (default: 100)"
  )
  .option(
    "-o, --output <path>",
    "Destination of output file (default: './<keywords>.csv')"
  );

program.parse();
let { keywords, pages, minSales, minReviews, batchSize, output } =
  program.opts();

if (!keywords) {
  program.help();
  process.exit(1);
}
if (!pages) {
  pages = 5;
}
if (!batchSize) {
  batchSize = 100;
}
if (!output) {
  output = "./output.csv";
}
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
    keywordsArray.map((keyword) => search(keyword, pages))
  );
  productsSearchSpinner.success();
} catch (e) {
  productsSearchSpinner.error();
  console.log(e);
  process.exit(0);
}

for (let i = 0; i < keywordsArray.length; i++) {
  const shopsUrlFinderSpinner = createSpinner(
    `Finding unique shops for ${keywordsArray[i]}...`
  );
  try {
    const shopsUrl = await getShopsUrl(
      productsUrlAll[i],
      batchSize,
      keywordsArray[i]
    );
    shopsUrlAll.push(shopsUrl);
    shopsUrlFinderSpinner.start();
    shopsUrlFinderSpinner.success();
  } catch (e) {
    shopsUrlFinderSpinner.error();
    console.log(e);
    process.exit(0);
  }
}

for (let i = 0; i < keywordsArray.length; i++) {
  const shopsDetailsFetcherSpinner = createSpinner(
    `Fetching shops details for ${keywordsArray[i]}...`
  );
  try {
    const shopsDetails = await getShopsDetails(
      shopsUrlAll[i],
      batchSize,
      keywordsArray[i]
    );
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
const margedShopsDetailsAll = shopsDetailsAll.reduce((a, b) => a.concat(b), []);

const csvSavingSpinner = createSpinner(`Saving CSV file...`);
try {
  csvSavingSpinner.start();
  const parser = new Parser();
  const csv = parser.parse(margedShopsDetailsAll);
  const dir = path.dirname(output);
  if (!fsSync.existsSync()) {
    fsSync.mkdirSync(dir, { recursive: true });
  }
  await writeFile(output, csv);
  csvSavingSpinner.success();
} catch (e) {
  csvSavingSpinner.error();
  console.log(e);
  process.exit(0);
}
