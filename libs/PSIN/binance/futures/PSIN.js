const fs = require('fs').promises;
const path = require('path');

// Counter for generating unique PSYMMSIN identifiers
let psymmCounter = 0;

/**
 * Calculates a check digit for the PSYMMSIN identifier.
 * @param {string} base - The base PSYMMSIN string (e.g., "PSYMM0000001").
 * @returns {number} - The calculated check digit.
 */
function calculateCheckDigit(base) {
  const sum = base.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return sum % 10;
}

/**
 * Generates a unique PSYMMSIN identifier with a check digit.
 * @param {number} counter - The current counter value.
 * @returns {string} - The generated PSYMMSIN (e.g., "PSYMM00000010").
 */
function generatePSYMMSIN(counter) {
  const base = `PSYMM${counter.toString().padStart(7, '0')}`;
  const checkDigit = calculateCheckDigit(base);
  return `${base}${checkDigit}`;
}

/**
 * Normalizes an asset's symbol to a standard format (e.g., "BTCUSDT").
 * @param {object} asset - The asset object from an exchange.
 * @param {string} exchange - The exchange name.
 * @returns {string} - The normalized symbol.
 */
function normalizeSymbol(asset, exchange) {
  if (exchange === 'binance') {
    return `${asset.baseAsset}${asset.quoteAsset}`;
  } else if (exchange === 'bybit' || exchange === 'bitget') {
    return `${asset.baseCoin}${asset.quoteCoin}`;
  }
  throw new Error(`Unknown exchange: ${exchange}`);
}

/**
 * Loads and filters futures assets from an exchange's assets.json file.
 * @param {string} exchange - The exchange name (e.g., "binance").
 * @returns {Promise<object[]>} - Array of filtered asset objects.
 */
async function loadFuturesAssets(exchange) {
  const filePath = path.join(__dirname, exchange, 'futures', 'assets.json');
  try {
    const data = await fs.readFile(filePath, 'utf8');
    const assets = JSON.parse(data);

    if (exchange === 'binance') {
      return assets.filter(
        (asset) =>
          asset.contractType === 'PERPETUAL' &&
          asset.quoteAsset === 'USDT' &&
          asset.status === 'TRADING'
      );
    } else if (exchange === 'bybit') {
      return assets.filter(
        (asset) => asset.quoteCoin === 'USDT' && asset.status === 'Trading'
      );
    } else if (exchange === 'bitget') {
      return assets.filter((asset) => asset.quoteCoin === 'USDT');
    }
    return [];
  } catch (error) {
    console.warn(`Failed to load assets for ${exchange}: ${error.message}`);
    return [];
  }
}

/**
 * Creates a PSYMMSIN entry for a futures asset.
 * @param {string} ticker - The normalized ticker (e.g., "BTCUSDT").
 * @param {string[]} priceSources - Array of price source strings.
 * @param {string[]} fundingSources - Array of funding source strings.
 * @param {number} priceDecimals - The price precision in decimal places.
 * @returns {object} - The PSYMMSIN entry object.
 */
function createPSYMMSINEntry(ticker, priceSources, fundingSources, priceDecimals) {
  const psymmSIN = generatePSYMMSIN(psymmCounter);
  psymmCounter++;
  return {
    PSYMMSIN: psymmSIN,
    Ticker: ticker,
    AssetType: 'PERP',
    AssetCategory: 'CRYPTO',
    Note: '',
    PriceSource: priceSources,
    FundingSource: fundingSources,
    PriceDecimals: priceDecimals,
  };
}

/**
 * Generates the futures PSYMMSIN list, restricted to Binance pairs.
 * @returns {Promise<{psymmList: object[], lastCounter: number}>} - The generated list and final counter.
 */
async function generateFuturesPSYMMSINList() {
  try {
    // Define the exchanges to process
    const exchanges = ['binance', 'bybit', 'bitget'];

    // Load assets from all exchanges
    const allAssets = {};
    for (const exchange of exchanges) {
      allAssets[exchange] = await loadFuturesAssets(exchange);
    }

    // Ensure Binance has assets; if not, exit early
    if (!allAssets.binance.length) {
      throw new Error('No Binance futures assets found');
    }

    // Create a map of normalized symbols to available exchanges and assets
    const symbolMap = new Map();
    for (const exchange of exchanges) {
      for (const asset of allAssets[exchange]) {
        const normalizedSymbol = normalizeSymbol(asset, exchange);
        if (!symbolMap.has(normalizedSymbol)) {
          symbolMap.set(normalizedSymbol, new Map());
        }
        symbolMap.get(normalizedSymbol).set(exchange, asset);
      }
    }

    // Generate PSYMMSIN entries only for Binance pairs
    const psymmList = [];
    for (const binanceAsset of allAssets.binance) {
      const normalizedSymbol = normalizeSymbol(binanceAsset, 'binance');
      const availableExchanges = symbolMap.get(normalizedSymbol) || new Map();

      // Only include this pair if it’s on Binance
      if (!availableExchanges.has('binance')) continue;

      // Build price and funding sources for all available exchanges
      const priceSources = [];
      const fundingSources = [];
      for (const exchange of exchanges) {
        if (availableExchanges.has(exchange)) {
          const source = `/${exchange}/futures/asset:{${normalizedSymbol}}`;
          priceSources.push(source);
          fundingSources.push(source);
        }
      }

      // Use Binance’s price precision as the base, or max across exchanges
      const priceDecimals = Math.max(
        ...Array.from(availableExchanges.values()).map((asset) => asset.pricePrecision || 0)
      );

      const entry = createPSYMMSINEntry(
        normalizedSymbol,
        priceSources,
        fundingSources,
        priceDecimals
      );
      psymmList.push(entry);
    }

    // Save the list to a JSON file
    const outputPath = path.join(__dirname, 'futures_psymmList.json');
    await fs.writeFile(outputPath, JSON.stringify(psymmList, null, 2), 'utf8');
    console.log(
      `Successfully saved ${psymmList.length} PSYMMSIN entries (Binance pairs only) to ${outputPath}`
    );

    return {
      psymmList,
      lastCounter: psymmCounter,
    };
  } catch (error) {
    console.error('Error generating futures PSYMMSIN list:', error.message);
    throw error;
  }
}

// Execute the script
generateFuturesPSYMMSINList()
  .then((result) => {
    console.log('Generated PSYMMSIN list length:', result.psymmList.length);
    console.log('Final counter value:', result.lastCounter);
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });