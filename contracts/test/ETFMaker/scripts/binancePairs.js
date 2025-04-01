require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');

async function fetchWithRetry(url, options, retries = 3, delayMs = 10000) { // Increased default delay to 10s
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After') || delayMs / 1000;
        console.log(`Rate limited. Waiting ${retryAfter} seconds before retrying...`);
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        continue;
      }
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status}`);
      }
      return response;
    } catch (error) {
      if (i === retries - 1) throw error;
      console.log(`Attempt ${i + 1} failed: ${error.message}. Retrying in ${delayMs / 1000}s...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
}

async function fetchBinanceSpotPairsFromCoinGecko() {
  try {
    const apiKey = process.env.COINGECKO_API_KEY;
    if (!apiKey) {
      throw new Error('COINGECKO_API_KEY not found in .env file');
    }

    const pairsMap = new Map();
    const result = {};
    let page = 1;
    let hasMoreData = true;

    while (hasMoreData) {
      const apiEndpoint = `https://api.coingecko.com/api/v3/exchanges/binance/tickers?page=${page}&x_cg_api_key=${apiKey}`;
      const response = await fetchWithRetry(apiEndpoint, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      const data = await response.json();

      if (!data.tickers || data.tickers.length === 0) {
        hasMoreData = false;
        break;
      }

      // Process tickers from this page
      data.tickers.forEach(ticker => {
        const baseAsset = ticker.base;
        const quoteAsset = ticker.target;

        if (['USDC', 'USDT', 'BUSD'].includes(quoteAsset)) {
          if (!pairsMap.has(baseAsset)) {
            pairsMap.set(baseAsset, []);
          }
          pairsMap.get(baseAsset).push(quoteAsset);
        }
      });

      console.log(`Processed page ${page} with ${data.tickers.length} tickers`);
      page++;
      await new Promise(resolve => setTimeout(resolve, 2000)); // Increased to 2s delay between pages
    }

    // Prioritize USDC > USDT > BUSD
    for (const [baseAsset, quoteAssets] of pairsMap) {
      let pairStatus = 'Listed';
      let selectedPair = '';

      if (quoteAssets.includes('USDC')) {
        selectedPair = `${baseAsset}USDC`;
      } else if (quoteAssets.includes('USDT')) {
        selectedPair = `${baseAsset}USDT`;
      } else if (quoteAssets.includes('BUSD')) {
        selectedPair = `${baseAsset}BUSD`;
      }

      result[selectedPair] = pairStatus;
    }

    // Save to JSON file
    const outputPath = path.join(__dirname, 'binance_spot_pairs_coingecko.json');
    await fs.writeFile(outputPath, JSON.stringify(result, null, 2));

    console.log(`Successfully saved ${Object.keys(result).length} spot pairs to ${outputPath}`);
    return result;

  } catch (error) {
    console.error('Error fetching Binance spot pairs from CoinGecko:', error.message);
    throw error;
  }
}

// Run the function
fetchBinanceSpotPairsFromCoinGecko()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch(() => process.exit(1));