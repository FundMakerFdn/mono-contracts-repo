// @ts-check
const fs = require('fs').promises;
const path = require('path');

/**
 * @typedef {Object} SourceData
 * @property {string} source
 * @property {string} modulePath
 */

/**
 * @typedef {Object} PsymmObj
 * @property {string} PSIN
 * @property {'ERC20' | 'PERP'} AssetType
 * @property {string} AssetCategory
 * @property {string} Note
 * @property {Record<string, string>} TokenAddresses
 * @property {string[]} PriceSources
 * @property {number} PriceDecimals
 */

/**
 * @typedef {Object} ResultData
 * @property {string} source
 * @property {number} chainId
 * @property {string} tokenAddress
 * @property {string} [priceUSD] - Price in USD (ask price)
 * @property {string} [error]
 */

/** @type {Record<string, any>} */
const moduleCache = Object.create(null);

/**
 * Builds module path from source
 * @param {string} source
 * @param {'price'} type
 * @returns {string}
 */
function getModulePath(source, type) {
  const parts = source.slice(1).split('/');
  return `./${parts[0]}/${type}.js`;
}

/**
 * Fetches USD price of ETH or stablecoin for conversion
 * @param {number} chainId
 * @param {string} tokenAddress
 * @returns {Promise<number>}
 */
async function getUSDConversionRate(chainId, tokenAddress) {
  const usdcAddresses = {
    1: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // Ethereum
    137: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', // Polygon
    // Add more as needed
  };
  const usdcAddress = usdcAddresses[chainId] || '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
  
  const endpoint = `https://apiv5.paraswap.io/prices/?srcToken=${tokenAddress}&destToken=${usdcAddress}&amount=1000000000000000000&side=SELL&network=${chainId}`;
  try {
    const response = await fetch(endpoint);
    if (!response.ok) throw new Error(`ParaSwap conversion rate error: ${response.status}`);
    const data = await response.json();
    if (!data.priceRoute || !data.priceRoute.destAmount) {
      throw new Error('Conversion rate unavailable');
    }
    return Number(data.priceRoute.destAmount) / 1e6; // USDC has 6 decimals
  } catch (err) {
    console.warn(`Using fallback USD rate: ${err.message}`);
    return tokenAddress === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' ? 2000 : 1; // Fallback: ETH ~$2000, stablecoin ~$1
  }
}

/**
 * Asset data management class
 */
class AssetData {
  /** @type {PsymmObj} */
  #psymm;
  /** @type {ReadonlyArray<SourceData>} */
  #priceSources;

  /**
   * @param {PsymmObj} psymmObj
   */
  constructor(psymmObj) {
    this.#psymm = Object.freeze({ ...psymmObj });
    this.#priceSources = Object.freeze(
      (psymmObj.PriceSources || []).map(source => ({
        source,
        modulePath: getModulePath(source, 'price')
      }))
    );
  }

  /**
   * Gets price in USD for a specific chain ID
   * @param {number} chainId
   * @returns {Promise<ResultData[]>}
   */
  async getPrice(chainId) {
    const tokenAddress = this.#psymm.TokenAddresses[String(chainId)];
    if (!tokenAddress) {
      return [{ source: 'N/A', chainId, tokenAddress: 'N/A', error: `No token address for chainId ${chainId}` }];
    }
    return Promise.all(
      this.#priceSources.map(source => this.#fetchPriceUSD(source, chainId, tokenAddress))
    );
  }

  /**
   * Gets asset information
   * @returns {PsymmObj}
   */
  getInfo() {
    return { ...this.#psymm };
  }

  /**
   * Fetches price in USD, converting if necessary
   * @param {SourceData} sourceData
   * @param {number} chainId
   * @param {string} tokenAddress
   * @returns {Promise<ResultData>}
   * @private
   */
  async #fetchPriceUSD({ source, modulePath }, chainId, tokenAddress) {
    try {
      moduleCache[modulePath] = moduleCache[modulePath] || require(modulePath);
      const priceData = await moduleCache[modulePath].getPrice({ chainId, tokenAddress });
      
      // Assume priceData is { bid, ask } in quote token (e.g., ETH)
      let priceUSD = Number(priceData.ask);
      const quoteToken = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'; // ETH as default quote
      
      // Convert to USD if not already in USD
      if (quoteToken !== '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48') { // Not USDC
        const usdRate = await getUSDConversionRate(chainId, quoteToken);
        priceUSD *= usdRate;
      }

      return { source, chainId, tokenAddress, priceUSD: priceUSD.toFixed(6) };
    } catch (err) {
      return { source, chainId, tokenAddress, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

/**
 * Loads asset data from PSIN.json
 * @returns {Promise<Record<string, AssetData>>}
 */
async function loadAssetData() {
  const filePath = path.resolve(__dirname, './PSIN.json');
  try {
    const data = await fs.readFile(filePath, 'utf8');
    const assets = JSON.parse(data);
    if (!Array.isArray(assets)) throw new Error('PSIN.json must contain an array');

    const assetMap = Object.create(null);
    for (const asset of assets) {
      if (!asset.PSIN) throw new Error('Each asset must have a PSIN');
      assetMap[asset.PSIN] = new AssetData(asset);
    }
    return assetMap;
  } catch (err) {
    throw new Error(`Failed to load PSIN.json: ${err.message}`);
  }
}
    
/**
 * Main execution function
 */
async function main() {
  try {
    const assets = await loadAssetData();
    const chainIdToQuery = 1; // Example: Ethereum

    console.log(`\n=== Prices in USD for Chain ${chainIdToQuery} ===`);
    for (const [psin, asset] of Object.entries(assets)) {
      console.log(`\nAsset ${psin}:`);
      console.log('Info:', JSON.stringify(asset.getInfo(), null, 2));
      console.log('Prices:', JSON.stringify(await asset.getPrice(chainIdToQuery), null, 2));
    }
  } catch (err) {
    console.error('Fatal error:', err.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { AssetData, loadAssetData };