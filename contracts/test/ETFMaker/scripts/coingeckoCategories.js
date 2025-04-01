require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');

async function fetchWithRetry(url, options, retries = 30, delayMs = 10000) {
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

async function fetchCoinGeckoCategories() {
  try {
    const apiKey = process.env.COINGECKO_API_KEY;
    if (!apiKey) throw new Error('COINGECKO_API_KEY not found in .env file');

    const inputPath = path.join(__dirname, 'binance_spot_pairs_coingecko.json');
    const pairsData = JSON.parse(await fs.readFile(inputPath, 'utf8'));

    // Fetch top coins from /coins/markets for primary IDs
    const marketsUrl = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=1&x_cg_api_key=${apiKey}`;
    const marketsResponse = await fetchWithRetry(marketsUrl, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' }
    });
    const marketsData = await marketsResponse.json();

    const primarySymbolToIdMap = new Map();
    marketsData.forEach(coin => primarySymbolToIdMap.set(coin.symbol.toUpperCase(), coin.id));

    // Fetch full coin list as fallback
    const coinListUrl = `https://api.coingecko.com/api/v3/coins/list?x_cg_api_key=${apiKey}`;
    const coinListResponse = await fetchWithRetry(coinListUrl, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' }
    });
    const coinList = await coinListResponse.json();

    const symbolToIdMap = new Map();
    coinList.forEach(coin => {
      if (!primarySymbolToIdMap.has(coin.symbol.toUpperCase())) {
        symbolToIdMap.set(coin.symbol.toUpperCase(), coin.id);
      }
    });
    // Merge primary IDs into the map
    for (const [symbol, id] of primarySymbolToIdMap) {
      symbolToIdMap.set(symbol, id);
    }

    const enrichedData = {};
    for (const [pair, status] of Object.entries(pairsData)) {
      const baseAsset = pair.replace(/(USDC|USDT|BUSD)$/, '');
      const coinId = symbolToIdMap.get(baseAsset);

      if (!coinId) {
        console.warn(`No CoinGecko ID found for ${baseAsset}. Skipping...`);
        enrichedData[pair] = { status, categories: [] };
        continue;
      }

      const coinUrl = `https://api.coingecko.com/api/v3/coins/${coinId}?x_cg_api_key=${apiKey}`;
      const coinResponse = await fetchWithRetry(coinUrl, {
        headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' }
      });
      const coinData = await coinResponse.json();

      console.log(`Processed ${baseAsset} (ID: ${coinId}) with categories:`, coinData.categories || 'None');

      enrichedData[pair] = {
        status,
        categories: coinData.categories || []
      };

      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    const outputPath = path.join(__dirname, 'binance_spot_pairs_with_categories.json');
    await fs.writeFile(outputPath, JSON.stringify(enrichedData, null, 2));
    console.log(`Successfully saved ${Object.keys(enrichedData).length} pairs with categories to ${outputPath}`);
    return enrichedData;

  } catch (error) {
    console.error('Error enriching Binance spot pairs with categories:', error.message);
    throw error;
  }
}

fetchCoinGeckoCategories()
  .then(() => console.log('Done!'))
  .catch(() => process.exit(1));