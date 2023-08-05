import cheerio from "cheerio";
import axios from "axios";

const search = async (keyword, pages) => {
  const singleSearch = async (keyword, pageNo) => {
    const baseUrl = "https://www.etsy.com";
    const res = await axios.get(
      `${baseUrl}/search?q=${encodeURIComponent(keyword)}`,
          {
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
    const productUrls = [];
    $("div[data-listing-card-v2]")
      .get()
      .map((product) => {
        productUrls.push($(product).find("a").attr("href").split("?")[0]);
      });
    return productUrls;
  };
  const promises = [];
  for (let i = 1; i <= pages; i++) {
    promises.push(singleSearch(keyword, i));
  }

  const allProductUrls = await Promise.all(promises);
  return allProductUrls.reduce(function (arr, row) {
    return arr.concat(row);
  }, []);
};
export default search;
