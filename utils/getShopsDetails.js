import cheerio from "cheerio";
import cliProgress from "cli-progress";
import colors from "ansi-colors";
import axios from "axios";

const getShopsDetailsAll = async (shopsLink, batchSize, keyword) => {
  let b1Progress = 0;
  const b1 = new cliProgress.SingleBar({
    format:
      `Fetching shops details for ${keyword}|` +
      colors.cyan("{bar}") +
      "| {percentage}%",
    barCompleteChar: "\u2588",
    barIncompleteChar: "\u2591",
    hideCursor: true,
  });

  b1.start(shopsLink.length, 0);

  const getShopDetails = async (shopLink) => {
    //Get shop details
    const shopDetails = {};

    const res = await axios.get(shopLink);
    const html = await res.data;
    //console.log(html);
    const $ = cheerio.load(html);

    shopDetails.searchKeyword = keyword;
    shopDetails.name = $(".shop-name-and-title-container").find("h1").text();
    //get shop ID
    shopDetails.shopID = Number($("a[data-shop-id]").attr("data-shop-id"));

    $(".shop-sales-reviews")
      .find("span")
      .get()
      .map((span) => {
        const spanText = $(span).text();
        if (spanText.includes("Sales")) {
          //console.log(spanText);
          shopDetails.sales =
            Number(spanText.replace(" Sales", "").replace(",", "")) || 0;
        }
      });

    // get reviews
    const metadata = $('script[type="application/ld+json"]')
      .get()
      .map((data) => {
        const metadataJson = JSON.parse(data.firstChild?.data);
        if (metadataJson["@type"] == "Organization") {
          //console.log(metadataJson);
          shopDetails.ratingValue = metadataJson.aggregateRating?.ratingValue;
          shopDetails.reviewCount =
            Number(metadataJson.aggregateRating?.reviewCount) || 0;
        }
      });
    // reviews ratingValue
    shopDetails.ratingValue =
      Number(
        $("input[name=rating]").attr("value") || shopDetails.ratingValue
      ) || 0;

    //get shop user User
    // shopDetails.username = $("a[data-to_username]").attr("data-to_username");
    //get shop User ID
    // shopDetails.userID = $("a[data-to_user_id]").attr("data-to_user_id");
    //get establish
    shopDetails.establish =
      Number(
        $('div[data-appears-component-name="shop_home_about_section"]')
          .find(".shop-home-wider-sections")
          .find("span")
          .last()
          .text()
      ) || undefined;
    //If establish is not available then find first review date.

    if (!shopDetails.establish) {
      const res = await axios.get(
        `${shopLink.split("?")[0]}/reviews?page=${Math.ceil(
          shopDetails.return / 14
        )}`
      );

      const html = await res.data;
      const $ = cheerio.load(html);

      let lastReview;

      $(".shop2-review-attribution")
        .get()
        .map((li) => {
          const lastReviewArray = $(li).text().trim().split(",");
          const lastReviewDate =
            lastReviewArray[lastReviewArray.length - 1].trim();

          if (lastReviewDate) {
            lastReview = lastReviewDate;
          }
        });
      shopDetails.establish = Number(lastReview) || undefined;
    }

    b1Progress++;
    b1.update(b1Progress);
    return shopDetails;
  };

  function sliceIntoChunks(arr, chunkSize) {
    const res = [];
    for (let i = 0; i < arr.length; i += chunkSize) {
      const chunk = arr.slice(i, i + chunkSize);
      res.push(chunk);
    }
    return res;
  }
  const shopsLinkBatch = sliceIntoChunks(shopsLink, batchSize);

  let completed = 0;
  let shopsDetailsAll = [];

  for (let i = 0; i < shopsLinkBatch.length; i++) {
    const getShopsDetails = shopsLinkBatch[i].map((link) => {
      return getShopDetails(link);
    });
    const shopsDetails = await Promise.all(getShopsDetails);
    shopsDetailsAll = [...shopsDetailsAll, ...shopsDetails];
  }
  b1.stop();
  return shopsDetailsAll;
};
export default getShopsDetailsAll;
