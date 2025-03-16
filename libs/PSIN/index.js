const moduleCache = {};

// Expected format: "/exchange/category/asset:{TICKER}"
function getAssetFromSource(source) {
  const regex = /asset:\{([^}]+)\}/;
  const match = source.match(regex);
  if (!match) {
    throw new Error("Invalid source format: " + source);
  }
  return match[1]; // e.g. "BTCUSDT"
}

// Helper: Build a generic module path from the source string and type.
function getModulePath(source, type) {
  const parts = source.startsWith('/') ? source.slice(1).split('/') : source.split('/');
  return `./${parts[0]}/${parts[1]}/${type}.js`;
}

class AssetData {
  constructor(psymmObj) {
    this.psymm = psymmObj;
    // Precompute parsed info for price and funding sources.
    this.precomputedPriceSources = (psymmObj.PriceSource || []).map((source) => ({
      source,
      asset: getAssetFromSource(source),
      modulePath: getModulePath(source, 'price')
    }));
    this.precomputedFundingSources = (psymmObj.FundingSource || []).map((source) => ({
      source,
      asset: getAssetFromSource(source),
      modulePath: getModulePath(source, 'funding')
    }));
  }
  
  // getPrice() returns an array of results from all precomputed price sources.
  async getPrice() {
    const promises = this.precomputedPriceSources.map(async ({ source, asset, modulePath }) => {
      try {
        let priceModule = moduleCache[modulePath];
        if (!priceModule) {
          priceModule = require(modulePath);
          moduleCache[modulePath] = priceModule;
        }
        // Call the module's exported getPrice(asset) function.
        const priceData = await priceModule.getPrice(asset);
        return { source, asset, priceData };
      } catch (err) {
        return { source, asset, error: err.message };
      }
    });
    return Promise.all(promises);
  }
  
  // getFunding() returns an array of results from all precomputed funding sources.
  async getFunding() {
    const promises = this.precomputedFundingSources.map(async ({ source, asset, modulePath }) => {
      try {
        let fundingModule = moduleCache[modulePath];
        if (!fundingModule) {
          fundingModule = require(modulePath);
          moduleCache[modulePath] = fundingModule;
        }
        // Call the module's exported getFunding(asset) function.
        const fundingData = await fundingModule.getFunding(asset);
        return { source, asset, fundingData };
      } catch (err) {
        return { source, asset, error: err.message };
      }
    });
    return Promise.all(promises);
  }
}

module.exports = AssetData;

// ----- Example usage -----

const psymmObj = {
  PSYMMSIN: "PSYMM1234567890XYZ",
  Ticker: "BTCUSDT",
  AssetType: "PERP",
  AssetCategory: "CRYPTO",
  Note: "",
  PriceSource: [
    `/binance/futures/asset:{BTCUSDT}`,
    `/bybit/futures/asset:{BTCUSDT}`,
    `/bitget/futures/asset:{BTCUSDT}` 
  ],
  FundingSource: [
    `/binance/futures/asset:{BTCUSDT}`,
    `/bybit/futures/asset:{BTCUSDT}`,
    `/bitget/futures/asset:{BTCUSDT}` 
  ],
  PriceDecimals: 18
};

(async () => {
  const assetData = new AssetData(psymmObj);
  
  try {
    const priceResults = await assetData.getPrice();
    console.log("Price results:", priceResults);
  } catch (e) {
    console.error("Error fetching prices:", e);
  }
  
  try {
    const fundingResults = await assetData.getFunding();
    console.log("Funding results:", fundingResults);
  } catch (e) {
    console.error("Error fetching funding:", e);
  }
})();


/*

import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";

import SuperchainTokenList from "../superchain.tokenlist.json";

async function main() {
  const tokens: {
    name: string;
    decimals: number;
    symbol: string;
    logoURI: string;
    opTokenId: string;
    addresses: {
      [chainId: string]: string;
    };
  }[] = [];
  for (const token of SuperchainTokenList.tokens) {
    const exists = tokens.find(
      (x) => x.opTokenId === token.extensions.opTokenId
    );

    if (exists) {
      exists.addresses[token.chainId] = token.address;
    } else {
      tokens.push({
        name: token.name,
        symbol: token.symbol,
        decimals: token.decimals,
        logoURI: token.logoURI,
        opTokenId: token.extensions.opTokenId,
        addresses: {
          [token.chainId]: token.address,
        },
      });
    }
  }

  for (const token of tokens) {
    const folder = join(__dirname, "..", "data", token.opTokenId);
    if (!existsSync(folder)) {
      mkdirSync(folder);
    }
    writeFileSync(join(folder, "data.json"), JSON.stringify(token, null, 2));
  }
}

main();
*/
