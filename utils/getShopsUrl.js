import cheerio from "cheerio";
import search from "./search.js";
import cliProgress from "cli-progress";
import colors from "ansi-colors";
import axios from "axios";

const getShopsUrl = async (productsUrl, batchSize, keyword) => {
  let b1Progress = 0;
  const b1 = new cliProgress.SingleBar({
    format:
      `Finding shops for ${keyword}|` +
      colors.cyan("{bar}") +
      "| {percentage}%",
    barCompleteChar: "\u2588",
    barIncompleteChar: "\u2591",
    hideCursor: true,
  });

  b1.start(productsUrl.length, 0);

  const getShopUrl = async (productUrl) => {
    const res = await axios.get(productUrl,     {
      headers: {
        accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "accept-language": "en-IN,en-GB;q=0.9,en-US;q=0.8,en;q=0.7,bn;q=0.6",
        "cache-control": "no-cache",
        pragma: "no-cache",
        "sec-ch-ua": '"Not:A-Brand";v="99", "Chromium";v="112"',
        "sec-ch-ua-mobile": "?1",
        "sec-ch-ua-platform": '"Android"',
        "sec-fetch-dest": "document",
        "sec-fetch-mode": "navigate",
        "sec-fetch-site": "same-origin",
        "sec-fetch-user": "?1",
        "upgrade-insecure-requests": "1",
        "user-agent":
          "Mozilla/5.0 (Linux; Android 11; Redmi Note 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36",
      },
    }
    );
    const html = await res.data;
    //console.log(html);
    const $ = cheerio.load(html);
    let shopUrl;
    $('div[data-appears-component-name="shop_owners"]')
      .find("a")
      .get()
      .map((a) => {
        if ($(a).attr("href").includes("/shop/")) {
          shopUrl = $(a).attr("href").trim().split("?")[0];
        }
      });
    b1Progress++;
    b1.update(b1Progress);
    return shopUrl;
  };

  function sliceIntoChunks(arr, chunkSize) {
    const res = [];
    for (let i = 0; i < arr.length; i += chunkSize) {
      const chunk = arr.slice(i, i + chunkSize);
      res.push(chunk);
    }
    return res;
  }
  const productsUrlBatch = sliceIntoChunks(productsUrl, batchSize);
  let shopsUrlAll = [];

  for (let i = 0; i < productsUrlBatch.length; i++) {
    const promises = productsUrlBatch[i].map((productUrl) =>
      getShopUrl(productUrl)
    );
    const shopsUrl = await Promise.all(promises);
    shopsUrlAll = [...shopsUrlAll, ...shopsUrl];
  }

  b1.stop();
  const shopsUrlFiltered = shopsUrlAll.filter((c, index) => {
    return shopsUrlAll.indexOf(c) === index;
  });
  return shopsUrlFiltered;
};

export default getShopsUrl;
