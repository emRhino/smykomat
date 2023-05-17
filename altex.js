const fs = require("fs");
const cheerio = require("cheerio");
const axios = require("axios");
const { parse } = require("csv-parse");
const scrapingbee = require("scrapingbee");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const util = require("util");

dotenv.config();
const APIKEY = process.env.API_KEY;

let rawdata = fs.readFileSync("linki_promoklocki_2023-04-24.json");
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
  promoklocki: {
    ref: ".breadcumb strong",
    sprzedawcy: {
      selector: ".row.product",
      type: "list",
      output: {
        sklep: ".order-1",
        price: ".order-2 a",
      },
    },
  },
  altex: {
    firstPrice: ".Product .leading-none .Price-int",
    lastPrice: ".Product .leading-none sup",
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

  console.clear();
  console.log(
    `Postęp: ${index + 1} z ${
      links.length
    } | SKU: ${sku} | Błędy: ${errorsCount} | ${datetime}`
  );

  ob.brand.push("");
  ob.price.push(sku);

  ob.brand.push("");
  ob.price.push(promoklocki.ref);

  ob.brand.push("");
  ob.price.push(smyk);

  // smyk ro

  let smykro;

  await axios
    .get("https://www.smyk.ro/search?q=" + sku)
    .then((res) => {
      const $ = cheerio.load(res.data);
      $(".complex-product-ro").each((i, el) => {
        smykro = $(el)
          .find(".complex-product-ro__price .price--new-ro")
          .text()
          .replace(/ Lei/gi, "");
      });
    })
    .catch((err) => console.error("smyk: " + err));

  ob.brand.push("");
  ob.price.push(smykro);

  const client = new scrapingbee.ScrapingBeeClient(APIKEY);
  const altexRes = await client.get({
    url: "https://altex.ro/cauta/?q=" + promoklocki.ref,
    params: {
      block_ads: false,
      block_resources: true,
      country_code: "",
      device: "desktop",
      extract_rules: schema.altex,
      json_response: false,
      js_scenario: {},
      premium_proxy: false,
      render_js: true,
      return_page_source: false,
      screenshot: false,
      screenshot_full_page: false,
      transparent_status_code: false,
      wait: 0,
      wait_for: "h1",
      window_width: 1920,
      window_height: 1080,
    },
    headers: {},
    cookies: {},
  });

  const altexDecoder = new TextDecoder();
  const altex = JSON.parse(altexDecoder.decode(altexRes.data));

  console.log(altex);

  ob.brand.push("");
  ob.price.push(
    parseFloat(altex.firstPrice.replace(".", "") + altex.lastPrice)
  );

  //koniec smyk ro

  ob.brand.push("\n");
  ob.price.push("\n");

  resolved.push(ob);
}

async function getPlacesWithCoords(index) {
  if (index !== 0 && index >= links.length) {
    joinTabels();
    return false;
  }

  await get(links[index].link, links[index].sku, index).catch((e) => {
    console.log(`Błąd produktu ${links[index].sku}: ${e}`);

    links.push({
      ref: links[index].ref,
      link: links[index].link,
      sku: links[index].sku,
    });
    errorsCount++;
  });

  getPlacesWithCoords((index += 1));
}

function joinTabels() {
  let tab = "";
  tab = "SKU;Nr ref;SMYK RO;Altex;\n";

  for (let i = 0; i < resolved.length; i++) {
    tab += resolved[i].brand.join(";");
    tab += resolved[i].price.join(";");
  }

  writeToFile(tab);
}

function writeToFile(data) {
  let today = new Date().toISOString().slice(0, 10);

  fs.writeFile(
    `./altex/smykomat_altex_${today}.txt`,
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
