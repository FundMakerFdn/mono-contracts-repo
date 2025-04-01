require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');

async function fetchWithRetry(url, options, retries = 3, delayMs = 10000) {
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

async function saveUpdatedJson(pairsData, outputPath) {
  await fs.writeFile(outputPath, JSON.stringify(pairsData, null, 2));
  console.log(`Updated JSON saved with ${Object.keys(pairsData).length} pairs`);
}

async function fetchAllMarketCapsFromCMC() {
  try {
    const cmcApiKey = process.env.CMC_API_KEY;
    if (!cmcApiKey) throw new Error('CMC_API_KEY not found in .env file');

    const inputPath = path.join(__dirname, 'binance_spot_pairs_coingecko.json');
    const pairsData = JSON.parse(await fs.readFile(inputPath, 'utf8'));
    console.log(`Total pairs loaded: ${Object.keys(pairsData).length}`);

    // CoinMarketCap ID mapping
    const cmcCoinListUrl = `https://pro-api.coinmarketcap.com/v1/cryptocurrency/map?CMC_PRO_API_KEY=${cmcApiKey}`;
    const cmcCoinListResponse = await fetchWithRetry(cmcCoinListUrl, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' }
    });
    const cmcCoinList = await cmcCoinListResponse.json();
    const cmcSymbolToIdMap = new Map();
    cmcCoinList.data.forEach(coin => {
      cmcSymbolToIdMap.set(coin.symbol.toUpperCase(), coin.id);
    });

    const outputData = {};
    const outputPath = path.join(__dirname, 'binance_spot_pairs_with_marketcap_cmc.json');
    await saveUpdatedJson(outputData, outputPath); // Initial empty save

    // Process each pair one-by-one using CMC
    for (const [pair, status] of Object.entries(pairsData)) {
      const baseAsset = pair.replace(/(USDC|USDT|BUSD)$/, '').replace(/^\d+/, '');
      let marketCap = null;

      const cmcId = cmcSymbolToIdMap.get(baseAsset.toUpperCase());
      if (cmcId) {
        const cmcUrl = `https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=${baseAsset}&CMC_PRO_API_KEY=${cmcApiKey}`;
        const cmcResponse = await fetchWithRetry(cmcUrl, {
          headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' }
        });
        const cmcData = await cmcResponse.json();
        marketCap = cmcData.data[baseAsset]?.quote?.USD?.market_cap || null;
        if (marketCap && marketCap > 0) {
          console.log(`CoinMarketCap: Set market cap for ${pair} (ID: ${cmcId}): ${marketCap}`);
          outputData[pair] = { marketCap };
          await saveUpdatedJson(outputData, outputPath);
        }
      }

      if (!marketCap || marketCap === 0) {
        console.warn(`No market cap found for ${pair} (Base: ${baseAsset}, CMC ID: ${cmcId || 'unknown'})`);
        outputData[pair] = { marketCap: null };
        await saveUpdatedJson(outputData, outputPath);
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log(`Successfully completed updates. Final file: ${outputPath}`);

  } catch (error) {
    console.error('Error fetching market caps from CoinMarketCap:', error.message);
    throw error;
  }
}

fetchAllMarketCapsFromCMC()
  .then(() => console.log('Done!'))
  .catch(() => process.exit(1));