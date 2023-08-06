import cheerio from "cheerio";
import search from "./search.js";
import cliProgress from "cli-progress";
import colors from "ansi-colors";
import chalk from "chalk";

const getShopsUrl = async ({ productsUrl, keyword, rateLimitedRequest }) => {
  console.log(
    chalk.green(`Finding shops for ${keyword} (total: ${productsUrl.length})`)
  );
  let b1Progress = 0;
  const b1 = new cliProgress.SingleBar({
    format: colors.cyan("{bar}") + " | {percentage}%",
    barCompleteChar: "\u2588",
    barIncompleteChar: "\u2591",
    hideCursor: true,
    autopadding: true,
    barsize: 40,
  });

  b1.start(productsUrl.length, 0);

  const getShopUrl = async (productUrl) => {
    const html = await rateLimitedRequest(productUrl);

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

  const promises = productsUrl.map((productUrl) => getShopUrl(productUrl));
  const shopsUrl = await Promise.all(promises);

  b1.stop();

  const shopsUrlFiltered = shopsUrl.filter((c, index) => {
    return shopsUrl.indexOf(c) === index;
  });
  return shopsUrlFiltered;
};

export default getShopsUrl;
