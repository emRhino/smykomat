const fs = require("fs");
const axios = require("axios");

dotenv.config();
const APIKEY = process.env.API_KEY;

const now = new Date();
const nowHash =
  now.getHours() + "-" + now.getMinutes() + "-" + now.getSeconds();

let rawdata = fs.readFileSync("./ceneo/google.json");
let gLinks = JSON.parse(rawdata);
let tempGLinks = JSON.parse(rawdata);

let errorsCount = 0;

const resolved = [];

async function get(name, index) {
  // console.log(name);

  const currentdate = new Date();
  const datetime =
    currentdate.getHours() +
    ":" +
    currentdate.getMinutes() +
    ":" +
    currentdate.getSeconds();

  console.log(
    `Postęp ${index} z ${gLinks.length} | Błędy: ${errorsCount} | ${datetime} | ${name.name} (${name.sku})`
  );

  await axios
    .get("https://app.scrapingbee.com/api/v1/store/google", {
      params: {
        api_key: APIKEY,
        search: name.name,
        nb_results: 12,
      },
    })
    .then(function (response) {
      const organicGoogleResponse = response.data.organic_results;

      let ceneoUrls = [];

      for (const element of organicGoogleResponse) {
        if (element.url.includes("ceneo.pl")) {
          ceneoUrls.push(element.url);
        }
      }

      resolved.push({
        sku: name.sku,
        name: name.name,
        smyk_url: `https://smyk.com/p/x-i${name.sku}`,
        ceneo_url: ceneoUrls,
      });

      writeToFile(JSON.stringify(resolved), "inProgress");

      const tmp_g_links = tempGLinks.shift();
      writeSourceToFile(JSON.stringify(tempGLinks));
    });
}

function writeToFile(data, version) {
  let today = new Date().toISOString().slice(0, 10);
  const ver = version === "final" ? "final" : "prgss";

  fs.writeFile(
    version === "final"
      ? `./ceneo/linki_ceneo_${ver}_${today}.json`
      : `./ceneo/temp/${nowHash}_tmp_lcen_${today}.json`,
    data,
    (err) => {
      if (err) {
        console.error(err);
      }
      if (version === "final") {
        console.log(`Zapisano finalny plik: linki_ceneo_${ver}_${today}.json`);
      }
    }
  );
}

function writeSourceToFile(data) {
  let today = new Date().toISOString().slice(0, 10);
  fs.writeFile(`./ceneo/temp/tmp_google_${today}.json`, data, (err) => {});
}

async function start() {
  for (const [index, element] of gLinks.entries()) {
    // console.log(element, index);
    await get(element, index).catch((e) => {
      console.log("A problem occurs : " + e.message);

      gLinks.push(element);
      errorsCount++;
    });
  }

  writeToFile(JSON.stringify(resolved), "final");
}

function trimData(whereToStart) {
  // get entier data file`
  // get last temp file
  // if temp file empty - start from 0
  // if temp file contain some index, start where was ended;
}

start();
