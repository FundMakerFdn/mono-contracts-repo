const fs = require('fs').promises;
const path = require('path');

async function fetchBybitFuturesRulesWithLeverage() {
  try {
    // Step 1: Fetch instrument info
    const instrumentsEndpoint = 'https://api.bybit.com/v5/market/instruments-info?category=linear';
    const instrumentsResponse = await fetch(instrumentsEndpoint);
    if (!instrumentsResponse.ok) {
      throw new Error(`Failed to fetch instruments info: ${instrumentsResponse.status}`);
    }
    const instrumentsData = await instrumentsResponse.json();

    if (instrumentsData.retCode !== 0) {
      throw new Error(`Instruments API error: ${instrumentsData.retMsg}`);
    }

    // Filter for perpetual contracts only (LinearPerpetual)
    const futuresAssets = instrumentsData.result.list
      .filter(instrument => instrument.contractType === 'LinearPerpetual')
      .map(instrument => ({
        symbol: instrument.symbol,
        status: instrument.status,
        baseCoin: instrument.baseCoin,
        quoteCoin: instrument.quoteCoin,
        settleCoin: instrument.settleCoin,
        pricePrecision: parseInt(instrument.priceScale),
        quantityPrecision: parseInt(instrument.lotSizeFilter.qtyScale),
        minLeverage: parseFloat(instrument.leverageFilter.minLeverage),
        maxLeverage: parseFloat(instrument.leverageFilter.maxLeverage),
        leverageStep: parseFloat(instrument.leverageFilter.leverageStep),
        filters: {
          LOT_SIZE: {
            minOrderQty: instrument.lotSizeFilter.minOrderQty,
            maxOrderQty: instrument.lotSizeFilter.maxOrderQty,
            qtyStep: instrument.lotSizeFilter.qtyStep,
          },
          PRICE_FILTER: {
            minPrice: instrument.priceFilter.minPrice,
            maxPrice: instrument.priceFilter.maxPrice,
            tickSize: instrument.priceFilter.tickSize,
          },
          LEVERAGE_FILTER: {
            minLeverage: instrument.leverageFilter.minLeverage,
            maxLeverage: instrument.leverageFilter.maxLeverage,
            leverageStep: instrument.leverageFilter.leverageStep,
          },
        },
        contractType: instrument.contractType,
        deliveryDate: null,
      }));

    // Create a set of perpetual symbols for filtering
    const perpetualSymbols = new Set(futuresAssets.map(asset => asset.symbol));

    // Step 2: Fetch all tickers for linear category
    const tickersEndpoint = 'https://api.bybit.com/v5/market/tickers?category=linear';
    console.log(`Fetching all tickers from: ${tickersEndpoint}`);
    const tickersResponse = await fetch(tickersEndpoint);
    if (!tickersResponse.ok) {
      const errorText = await tickersResponse.text();
      throw new Error(`Failed to fetch tickers: ${tickersResponse.status} - ${errorText}`);
    }
    const tickersData = await tickersResponse.json();

    if (tickersData.retCode !== 0) {
      throw new Error(`Tickers API error: ${tickersData.retMsg}`);
    }

    const priceMap = new Map();
    tickersData.result.list
      .filter(ticker => perpetualSymbols.has(ticker.symbol)) // Only perpetual symbols
      .forEach(ticker => {
        priceMap.set(ticker.symbol, {
          bidPrice: parseFloat(ticker.bid1Price),
          askPrice: parseFloat(ticker.ask1Price),
        });
      });

    // Step 3: Enhance assets with prices, leverage amounts, and estimated margin details
    const enhancedAssets = futuresAssets.map(asset => {
      const priceInfo = priceMap.get(asset.symbol);
      if (!priceInfo) {
        console.warn(`No price data for ${asset.symbol}, skipping leverage calc`);
        return asset;
      }

      const maxQty = parseFloat(asset.filters.LOT_SIZE.maxOrderQty);
      const askPrice = priceInfo.askPrice;
      const maxNotional = maxQty * askPrice;

      const leverageAmounts = {};
      const marginDetails = [];
      const leverageStep = asset.leverageStep || 1;
      for (let leverage = asset.minLeverage; leverage <= asset.maxLeverage; leverage += leverageStep) {
        leverageAmounts[Math.round(leverage)] = maxNotional * leverage;
        const initialMarginRate = 1 / leverage;
        const maintenanceMarginRate = initialMarginRate / 2;
        marginDetails.push({
          leverage: Math.round(leverage),
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
        makerFee: -0.00025,
        takerFee: 0.00075,
      };
    });

    // Step 4: Save to JSON
    const outputPath = path.join(__dirname, 'assets.json');
    await fs.writeFile(outputPath, JSON.stringify(enhancedAssets, null, 2));
    console.log(`Successfully saved ${enhancedAssets.length} perpetual assets to ${outputPath}`);

    return enhancedAssets;
  } catch (error) {
    console.error('Error fetching Bybit Futures rules:', error.message);
    throw error;
  }
}

// Run the function
fetchBybitFuturesRulesWithLeverage()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));