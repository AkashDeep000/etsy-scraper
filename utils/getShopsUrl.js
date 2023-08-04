import cheerio from "cheerio";
import search from "./search.js";
import cliProgress from "cli-progress";
import colors from "ansi-colors";

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
    const res = await fetch(productUrl);
    const html = await res.text();
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
  return shopsUrlFiltered
};

export default getShopsUrl;
