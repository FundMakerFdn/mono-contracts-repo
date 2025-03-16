// @ts-check

const fs = require('fs').promises;
const path = require('path');

/**
 * @typedef {Object} SourceData
 * @property {string} source
 * @property {string} asset
 * @property {string} modulePath
 */

/**
 * @typedef {Object} PsymmObj
 * @property {string} PSIN
 * @property {string} Ticker
 * @property {'SPOT' | 'PERP' | 'ERC20'} AssetType
 * @property {string} AssetCategory
 * @property {string} Note
 * @property {string[]} PriceSource
 * @property {string[] | undefined} FundingSource
 * @property {number} PriceDecimals
 */

/**
 * @typedef {Object} ResultData
 * @property {string} source
 * @property {string} asset
 * @property {any} [priceData]
 * @property {any} [fundingData]
 * @property {string} [error]
 */

/** @type {Record<string, any>} */
const moduleCache = Object.create(null);

/**
 * Extracts asset ticker from source string
 * @param {string} source
 * @returns {string}
 * @throws {Error} If source format is invalid
 */
function getAssetFromSource(source) {
  const match = source.match(/asset:\{([^}]+)\}/);
  if (!match) throw new Error(`Invalid source format: ${source}`);
  return match[1];
}

/**
 * Builds module path from source and type
 * @param {string} source
 * @param {'price' | 'funding'} type
 * @returns {string}
 */
function getModulePath(source, type) {
  const parts = source.slice(1).split('/');
  return `./${parts[0]}/${parts[1]}/${type}.js`;
}

/**
 * Asset data management class
 */
class AssetData {
  /** @type {PsymmObj} */
  #psymm;
  /** @type {ReadonlyArray<SourceData>} */
  #priceSources;
  /** @type {ReadonlyArray<SourceData>} */
  #fundingSources;

  /**
   * @param {PsymmObj} psymmObj
   */
  constructor(psymmObj) {
    this.#psymm = Object.freeze({ ...psymmObj });
    this.#priceSources = Object.freeze(
      (psymmObj.PriceSource || []).map(source => ({
        source,
        asset: getAssetFromSource(source),
        modulePath: getModulePath(source, 'price')
      }))
    );
    this.#fundingSources = Object.freeze(
      psymmObj.AssetType === 'PERP' && psymmObj.FundingSource
        ? psymmObj.FundingSource.map(source => ({
            source,
            asset: getAssetFromSource(source),
            modulePath: getModulePath(source, 'funding')
          }))
        : []
    );
  }

  /**
   * Gets price data from all sources
   * @returns {Promise<ResultData[]>}
   */
  async getPrice() {
    return Promise.all(
      this.#priceSources.map(source =>
        this.#fetchData(source, 'price', 'getPrice')
      )
    );
  }

  /**
   * Gets funding data from all sources (PERP only)
   * @returns {Promise<ResultData[]>}
   */
  async getFunding() {
    if (this.#psymm.AssetType !== 'PERP') return [];
    return Promise.all(
      this.#fundingSources.map(source =>
        this.#fetchData(source, 'funding', 'getFunding')
      )
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
   * Fetches data from a module
   * @param {SourceData} sourceData
   * @param {'price' | 'funding'} type
   * @param {string} method
   * @returns {Promise<ResultData>}
   */
  async #fetchData({ source, asset, modulePath }, type, method) {
    try {
      moduleCache[modulePath] = moduleCache[modulePath] || require(modulePath);
      const data = await moduleCache[modulePath][method](asset);
      return { source, asset, [`${type}Data`]: data };
    } catch (err) {
      return { source, asset, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

/**
 * Loads and initializes asset data from JSON file
 * @returns {Promise<Record<string, AssetData>>}
 */
async function loadAssetData() {
  const filePath = path.resolve(__dirname, './PSIN.json');
  try {
    const data = await fs.readFile(filePath, 'utf8');
    const assets = JSON.parse(data);
    
    if (!Array.isArray(assets)) {
      throw new Error('PSIN.json must contain an array');
    }

    const assetMap = Object.create(null);
    for (const asset of assets) {
      if (!asset.PSIN) {
        throw new Error('Each asset must have a PSIN');
      }
      assetMap[asset.PSIN] = new AssetData(asset);
    }
    return assetMap;
  } catch (err) {
    throw new Error(`Failed to load PSIN.json: ${err.message}`);
  }
}

/**
 * test execution function
 
async function main() {
  try {
    const assets = await loadAssetData();
    const demoPSINs = ['PSYMM00000008', 'PSYMM00003128'];

    for (const psin of demoPSINs) {
      if (!(psin in assets)) {
        console.error(`Asset ${psin} not found`);
        continue;
      }

      const asset = assets[psin];
      console.log(`\n=== ${psin} ===`);

      console.log('Info:');
      console.log(JSON.stringify(asset.getInfo(), null, 2));

      console.log('Price:');
      const price = await asset.getPrice();
      console.log(JSON.stringify(price, null, 2));

      console.log('Funding:');
      const funding = await asset.getFunding();
      console.log(JSON.stringify(funding, null, 2));
    }
  } catch (err) {
    console.error('Fatal error:', err.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
  */

module.exports = { AssetData, loadAssetData };