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
          priceModule = await import(modulePath);
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
          fundingModule = await import(modulePath);
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

export default AssetData;

// ----- Example usage -----

const psymmObj = {
  PSYMMSIN: "PSYMM1234567890XYZ",
  Ticker: "BTCUSDT",
  AssetType: "PERP",
  AssetCategory: "CRYPTO",
  Note: "",
  PriceSource: [
    `/binance/futures/asset:{BTCUSDT}`,
    `/bybit/futures/asset:{BTCUSDT}`
  ],
  FundingSource: [
    `/binance/funding/asset:{BTCUSDT}`,
    `/bybit/funding/asset:{BTCUSDT}`
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
