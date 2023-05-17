const fs = require("fs");
const cheerio = require("cheerio");
const axios = require("axios");
const { parse } = require("csv-parse");
const scrapingbee = require("scrapingbee");
const mongoose = require("mongoose");
const util = require("util");

dotenv.config();
const APIKEY = process.env.API_KEY;

// [
//     {"name":"B.Box, słomki zapasowe i szczoteczka do bidonu B.Box, 2 szt.", "link":"https://www.ceneo.pl/77013421","sku":"6431155"},
//     {"name":"Fisher-Price, Szczeniaczek Uczniaczek \"Poziomy Nauki\", zabawka interaktywna", "link":"https://www.ceneo.pl/59583260", "sku":"6210544"},
//     {"name":"Hape, Baby Einstein, Magiczne Pianinko, dotykowa zabawka interaktywna", "link":"https://www.ceneo.pl/84265915","sku":"6554740"},
//     {"name":"L.O.L. Surprise, O. M. G. Fierce Neonlicious, lalka modowa", "link":"https://www.ceneo.pl/136834013","sku":"7295587"}
// ]

let rawdata = fs.readFileSync("./ceneo/linki_ceneo_final_2023-03-29.json");
let links = JSON.parse(rawdata);
// console.log(links);

let errorsCount = 0;

const startTime = new Date();
const startTimeFormat =
  startTime.getHours() +
  ":" +
  startTime.getMinutes() +
  ":" +
  startTime.getSeconds();

const fullDb = [];

const rejected = [];
const resolved = [];

const schema = {
  ceneo: {
    ref: "h1",
    promo: {
      selector: ".product-offers--bidding .product-offers__list__item",
      type: "list",
      output: {
        sklep: ".offer-shop-opinions a",
        cena: ".price-format.nowrap .price",
      },
    },
    standard: {
      selector: ".product-offers--standard .product-offers__list__item",
      type: "list",
      output: {
        sklep: ".offer-shop-opinions a",
        cena: ".price-format.nowrap .price",
      },
    },
  },
};

async function get(url, sku, index) {
  const currentdate = new Date();
  const datetime =
    currentdate.getHours() +
    ":" +
    currentdate.getMinutes() +
    ":" +
    currentdate.getSeconds();

  console.log(
    `Postęp: ${index + 1} z ${
      links.length
    } | Błędy: ${errorsCount} | ${datetime} | ${url}`
  );

  const client = new scrapingbee.ScrapingBeeClient(APIKEY);
  const res = await client.get({
    url: url,
    params: {
      block_ads: false,
      block_resources: true,
      country_code: "",
      device: "desktop",
      extract_rules: schema.ceneo,
      json_response: false,
      js_scenario: {},
      premium_proxy: false,
      render_js: false,
      return_page_source: false,
      screenshot: false,
      screenshot_full_page: false,
      transparent_status_code: false,
      wait: 0,
      wait_for: "",
      window_width: 1920,
      window_height: 1080,
    },
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/106.0.0.0 Safari/537.36",
    },
    cookies: {
      __RequestVerificationToken:
        "2bDF4Heg4YxO9piUpTcYiZAH4X81eYuYi2v5yRnoDDqI7oApTPkutebXPf6Whq143Vm9KCq4O905_awb5QAukbxNr-Z6v75SvM9LV6M6cBA1",
    },
  });

  const decoder = new TextDecoder();
  const ceneo = JSON.parse(decoder.decode(res.data));

  // console.log(ceneo);

  let smyk;

  await axios
    .get("https://www.smyk.com/search?q=" + sku)
    .then((res) => {
      const $ = cheerio.load(res.data);
      $(".complex-product").each((i, el) => {
        smyk = $(el)
          .find(".complex-product__price .price--new")
          .text()
          .replace(/ zł/gi, "");
      });
    })
    .catch((err) => console.error(err));

  await new Promise((resolve) =>
    setTimeout(resolve, Math.random() * (500 - 200) + 500)
  );

  // console.log("smyk:");
  // console.log(smyk);

  // console.log("ceneo:");
  // console.log(JSON.parse(ceneo));

  const ob = {
    brand: [],
    price: [],
  };

  ob.brand.push("");
  ob.price.push(ceneo.ref);

  ob.brand.push("");
  ob.price.push(sku);

  ob.brand.push("");
  ob.price.push(smyk);

  // Promo
  for (let i = 0; i < 3; i++) {
    if (ceneo.promo[i] !== undefined) {
      const sklep = ceneo.promo[i].sklep.replace("Dane i opinie o ", "");
      ob.brand.push(sklep);
      ob.price.push(ceneo.promo[i].cena);
    } else {
      ob.brand.push("");
      ob.price.push("");
    }
  }

  // Standard
  for (let i = 0; i < 5; i++) {
    if (ceneo.standard[i] !== undefined) {
      const sklep = ceneo.standard[i].sklep.replace("Dane i opinie o ", "");
      ob.brand.push(sklep);
      ob.price.push(ceneo.standard[i].cena);
    } else {
      ob.brand.push("");
      ob.price.push("");
    }
  }

  ob.brand.push("\n");
  ob.price.push("\n");

  // console.log(ob);

  resolved.push(ob);
}

async function getPlacesWithCoords(index) {
  if (index !== 0 && index == links.length) {
    joinTabels();
    return false;
  }

  if (links[index]?.ceneo_url[0]?.length > 0) {
    await get(links[index].ceneo_url[0], links[index].sku, index).catch((e) => {
      console.log("A problem occurs : " + e.message);
      links.push({
        name: links[index].name,
        link: links[index].ceneo_url[0],
        sku: links[index].sku,
      });
      errorsCount++;
      // console.log(links[index]);
      // console.log(links[links.length]);
      // console.log(links[links.length - 1]);
    });
  }

  getPlacesWithCoords((index += 1));
}

function joinTabels() {
  let tab = "";
  tab =
    'Nazwa;SKU;Smyk.com;"Promo 1";"Promo 2";"Promo 3";"Std 1";"Std 2";"Std 3";"Std 4";"Std 5";\n';

  for (let i = 0; i < resolved.length; i++) {
    tab += resolved[i].brand.join(";");
    tab += resolved[i].price.join(";");
  }

  writeToFile(tab);
  // console.log(resolved);
}

function writeToFile(data) {
  let today = new Date().toISOString().slice(0, 10);

  // const endTime = new Date();
  // const endTimeFormat = endTime.getHours() + ":" + endTime.getMinutes() + ":" + endTime.getSeconds();
  // console.log(endTimeFormat - endTimeFormat);

  fs.writeFile(
    `./ceneo/final/smykomat_ceneo_${today}.txt`,
    "\ufeff" + data,
    (err) => {
      if (err) {
        console.error(err);
      }
      console.error("Zapisano plik");
    }
  );
}

getPlacesWithCoords((index = 0));
