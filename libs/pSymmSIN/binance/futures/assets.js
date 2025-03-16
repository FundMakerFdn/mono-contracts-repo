const fs = require('fs').promises;
const path = require('path');

async function fetchBinanceFuturesRulesWithLeverage() {
  try {
    // Step 1: Fetch exchange info
    const exchangeInfoEndpoint = 'https://fapi.binance.com/fapi/v1/exchangeInfo';
    const exchangeResponse = await fetch(exchangeInfoEndpoint);
    if (!exchangeResponse.ok) {
      throw new Error(`Failed to fetch exchange info: ${exchangeResponse.status}`);
    }
    const exchangeData = await exchangeResponse.json();

    // Filter for perpetual contracts only
    const futuresAssets = exchangeData.symbols
      .filter(symbol => symbol.contractType === 'PERPETUAL')
      .map(symbol => ({
        symbol: symbol.symbol,
        status: symbol.status,
        baseAsset: symbol.baseAsset,
        quoteAsset: symbol.quoteAsset,
        marginAsset: symbol.marginAsset,
        pricePrecision: symbol.pricePrecision,
        quantityPrecision: symbol.quantityPrecision,
        maxLeverage: symbol.maxLeverage || 125,
        filters: symbol.filters.reduce((acc, filter) => {
          acc[filter.filterType] = filter;
          return acc;
        }, {}),
        contractType: symbol.contractType,
        deliveryDate: symbol.deliveryDate || null,
      }));

    // Step 2: Fetch current prices
    const priceEndpoint = 'https://fapi.binance.com/fapi/v1/ticker/bookTicker';
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

    // Step 3: Enhance assets with prices, leverage amounts, and estimated margin details
    const enhancedAssets = futuresAssets.map(asset => {
      const priceInfo = priceMap.get(asset.symbol);
      if (!priceInfo) {
        console.warn(`No price data for ${asset.symbol}, skipping leverage calc`);
        return asset;
      }

      const maxQty = parseFloat(asset.filters.LOT_SIZE.maxQty);
      const askPrice = priceInfo.askPrice;
      const maxNotional = maxQty * askPrice;

      const leverageAmounts = {};
      const marginDetails = [];
      for (let leverage = 1; leverage <= asset.maxLeverage; leverage++) {
        leverageAmounts[leverage] = maxNotional * leverage;
        const initialMarginRate = 1 / leverage; // Standard Binance initial margin
        const maintenanceMarginRate = initialMarginRate / 2; // Approximation
        marginDetails.push({
          leverage,
          initialMarginRate,
          maintenanceMarginRate,
          maxNotional: maxNotional * leverage,
        });
      }

      return {
        ...asset,
        currentAskPrice: askPrice,
        maxQty: maxQty,
        leverageMaxAmounts: leverageAmounts,
        marginDetails,
        liquidationFee: 0.0,
        makerFee: 0.0002,
        takerFee: 0.0004,
      };
    });

    // Step 4: Save to JSON
    const outputPath = path.join(__dirname, 'assets.json');
    await fs.writeFile(outputPath, JSON.stringify(enhancedAssets, null, 2));
    console.log(`Successfully saved ${enhancedAssets.length} perpetual assets to ${outputPath}`);

    return enhancedAssets;
  } catch (error) {
    console.error('Error fetching Binance Futures rules:', error.message);
    throw error;
  }
}

// Run the function
fetchBinanceFuturesRulesWithLeverage()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));