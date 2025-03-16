const fs = require('fs').promises;
const path = require('path');

async function fetchBitgetFuturesRulesWithLeverage() {
  try {
    // Step 1: Fetch instrument info
    const instrumentsEndpoint = 'https://api.bitget.com/api/mix/v1/market/contracts?productType=umcbl';
    console.log(`Fetching instruments from: ${instrumentsEndpoint}`);
    const instrumentsResponse = await fetch(instrumentsEndpoint);
    if (!instrumentsResponse.ok) {
      const errorText = await instrumentsResponse.text();
      throw new Error(`Failed to fetch instruments info: ${instrumentsResponse.status} - ${errorText}`);
    }
    const instrumentsData = await instrumentsResponse.json();

    if (instrumentsData.code !== "00000") {
      throw new Error(`Instruments API error: ${instrumentsData.msg}`);
    }

    // Log the full instruments data structure for debugging
    console.log('Instruments data sample:', JSON.stringify(instrumentsData.data.slice(0, 2), null, 2));

    // Filter for perpetual contracts (assuming symbol format or other indicator)
    const futuresAssets = instrumentsData.data
      .filter(instrument => {
        // Check symbol format; adjust if necessary based on log output
        const isPerpetual = instrument.symbol.includes('USDT') && !instrument.deliveryTime; // Example adjustment
        if (isPerpetual) console.log(`Found perpetual: ${instrument.symbol}`);
        return isPerpetual;
      })
      .map(instrument => ({
        symbol: `${instrument.symbol}_UMCBL`, // Ensure consistency with ticker symbols
        status: instrument.status === 'normal' ? 'Trading' : instrument.status,
        baseCoin: instrument.baseCoin,
        quoteCoin: instrument.quoteCoin,
        settleCoin: instrument.quoteCoin,
        pricePrecision: parseInt(instrument.pricePlace),
        quantityPrecision: parseInt(instrument.volumePlace),
        minLeverage: parseFloat(instrument.minLeverage),
        maxLeverage: parseFloat(instrument.maxLeverage),
        leverageStep: 1,
        filters: {
          LOT_SIZE: {
            minOrderQty: instrument.minTradeNum,
            maxOrderQty: instrument.maxTradeNum,
            qtyStep: instrument.sizeIncrement,
          },
          PRICE_FILTER: {
            minPrice: instrument.priceEndStep,
            maxPrice: instrument.maxPrice || "1000000",
            tickSize: instrument.priceEndStep,
          },
          LEVERAGE_FILTER: {
            minLeverage: instrument.minLeverage,
            maxLeverage: instrument.maxLeverage,
            leverageStep: "1",
          },
        },
        contractType: 'perpetual',
        deliveryDate: null,
      }));

    console.log(`Filtered ${futuresAssets.length} perpetual assets`);

    // Create a set of perpetual symbols for filtering
    const perpetualSymbols = new Set(futuresAssets.map(asset => asset.symbol));

    // Step 2: Fetch all tickers for umcbl
    const tickersEndpoint = 'https://api.bitget.com/api/mix/v1/market/tickers?productType=umcbl';
    console.log(`Fetching all tickers from: ${tickersEndpoint}`);
    const tickersResponse = await fetch(tickersEndpoint);
    if (!tickersResponse.ok) {
      const errorText = await tickersResponse.text();
      throw new Error(`Failed to fetch tickers: ${tickersResponse.status} - ${errorText}`);
    }
    const tickersData = await tickersResponse.json();

    if (tickersData.code !== "00000") {
      throw new Error(`Tickers API error: ${tickersData.msg}`);
    }
    console.log('Tickers data sample:', JSON.stringify(tickersData.data.slice(0, 2), null, 2));

    const priceMap = new Map();
    tickersData.data
      .filter(ticker => perpetualSymbols.has(ticker.symbol))
      .forEach(ticker => {
        priceMap.set(ticker.symbol, {
          bidPrice: parseFloat(ticker.bestBid),
          askPrice: parseFloat(ticker.bestAsk),
        });
      });

    // Step 3: Enhance assets with prices, leverage amounts, and margin details
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
      const leverageStep = asset.leverageStep;
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
        makerFee: 0.0002,
        takerFee: 0.0006,
      };
    });

    // Step 4: Save to JSON
    const outputPath = path.join(__dirname, 'bitget-futures-rules-with-leverage.json');
    await fs.writeFile(outputPath, JSON.stringify(enhancedAssets, null, 2));
    console.log(`Successfully saved ${enhancedAssets.length} perpetual assets to ${outputPath}`);

    return enhancedAssets;
  } catch (error) {
    console.error('Error fetching Bitget Futures rules:', error.message);
    throw error;
  }
}

// Run the function
fetchBitgetFuturesRulesWithLeverage()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));