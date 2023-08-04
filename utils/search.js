import cheerio from "cheerio";

const search = async (keyword, pages) => {
  const singleSearch = async (keyword, pageNo) => {
    const baseUrl = "https://www.etsy.com";
    const res = await fetch(
      `${baseUrl}/search?q=${encodeURIComponent(keyword)}`
    );
    const html = await res.text();
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
