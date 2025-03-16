const fs = require('fs').promises;
const path = require('path');

// Helper function to calculate decimal places from filter values
function getDecimalPlaces(num) {
  const str = num.toString();
  if (str.indexOf('.') === -1) return 0;
  return str.split('.')[1].length;
}

async function fetchBinanceSpotUSDTUSDCPairs() {
  try {
    // Step 1: Fetch exchange info for spot market
    const exchangeInfoEndpoint = 'https://api.binance.com/api/v3/exchangeInfo';
    const exchangeResponse = await fetch(exchangeInfoEndpoint);
    if (!exchangeResponse.ok) {
      throw new Error(`Failed to fetch exchange info: ${exchangeResponse.status}`);
    }
    const exchangeData = await exchangeResponse.json();

    // Filter for USDT and USDC quote assets with TRADING status
    const spotAssets = exchangeData.symbols
      .filter(symbol => (symbol.quoteAsset === 'USDT' || symbol.quoteAsset === 'USDC') && symbol.status === 'TRADING')
      .map(symbol => {
        const filtersMap = symbol.filters.reduce((acc, filter) => {
          acc[filter.filterType] = filter;
          return acc;
        }, {});
        const pricePrecision = getDecimalPlaces(parseFloat(filtersMap.PRICE_FILTER.tickSize));
        const quantityPrecision = getDecimalPlaces(parseFloat(filtersMap.LOT_SIZE.stepSize));
        return {
          symbol: symbol.symbol,
          status: symbol.status,
          baseAsset: symbol.baseAsset,
          quoteAsset: symbol.quoteAsset,
          pricePrecision,
          quantityPrecision,
          filters: filtersMap,
        };
      });

    // Step 2: Fetch current prices for spot market
    const priceEndpoint = 'https://api.binance.com/api/v3/ticker/bookTicker';
    const priceResponse = await fetch(priceEndpoint);
    if (!priceResponse.ok) {
      throw new Error(`Failed to fetch prices: ${priceResponse.status}`);
    }
    const priceData = await priceResponse.json();

    const priceMap = new Map();
    priceData.forEach(ticker => {
      priceMap.set(ticker.symbol, {
        bidPrice: parseFloat(ticker.bidPrice),
        askPrice: parseFloat(ticker.askPrice),
      });
    });

    // Step 3: Enhance assets with price data and max quantity
    const enhancedAssets = spotAssets.map(asset => {
      const priceInfo = priceMap.get(asset.symbol);
      const maxQty = parseFloat(asset.filters.LOT_SIZE.maxQty);
      if (!priceInfo) {
        console.warn(`No price data for ${asset.symbol}`);
        return {
          ...asset,
          currentAskPrice: null,
          maxQty,
          makerFee: 0.001,
          takerFee: 0.001,
        };
      }
      const askPrice = priceInfo.askPrice;
      return {
        ...asset,
        currentAskPrice: askPrice,
        maxQty,
        makerFee: 0.001,
        takerFee: 0.001,
      };
    });

    // Step 4: Save enhanced assets to a JSON file
    const outputPath = path.join(__dirname, 'spot_assets.json');
    await fs.writeFile(outputPath, JSON.stringify(enhancedAssets, null, 2));
    console.log(`Successfully saved ${enhancedAssets.length} spot assets to ${outputPath}`);
    return enhancedAssets;
  } catch (error) {
    console.error('Error fetching Binance Spot rules:', error.message);
    throw error;
  }
}

// Run the function
fetchBinanceSpotUSDTUSDCPairs()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));