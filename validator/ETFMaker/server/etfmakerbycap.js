import db from './database.js';
import { etfWeights, currentMarketCaps, tokenPools } from './schema.js';
import { clearTable, batchInsert } from './db-utils.js';
import { tokensOnCEX } from './binance.js';
import CONFIG from '../config.js'


/* 
    LEGACY FUNCTIONS FOR FORMING THE ETFS BY CAP, DOES NOT FEATURE INDEX VALUE OF ASSET QUANTITY
*/

const PER_PAGE_MAX = 250;

const COINGECKO_CONFIG = {
    baseParams: {
        vs_currency: "usd",
        order: "market_cap_desc",
        per_page: PER_PAGE_MAX.toString(),
    },
    apiKey: CONFIG.COINGECKO_API_KEY
}


async function fetchAllCaps(tokenCount) {
    const pageCount = Math.ceil(tokenCount / PER_PAGE_MAX);

    const pages = Array.from({ length: pageCount }, (_, i) => i + 1);
    const pagePromises = pages.map(page => {
        const params = new URLSearchParams({
            ...COINGECKO_CONFIG.baseParams,
            page: page.toString()
        });
        
        return fetch(`https://pro-api.coingecko.com/api/v3/coins/markets?${params}`, {
            headers: {"x-cg-pro-api-key": COINGECKO_CONFIG.apiKey}
        })
        .then(response => response.json())
        .then(pageCoins => {
            return pageCoins;
        });
    });

    const allPagesResults = await Promise.all(pagePromises);
    const allCoins = allPagesResults.flat().slice(0, tokenCount);
    console.log(`Total coins fetched: ${allCoins.length}`);
    return allCoins;
}

async function fetchCategoryCaps(category) {
    let categoryCoins = [];
    let page = 1;
    
    while (true) {
        const params = new URLSearchParams({
            ...COINGECKO_CONFIG.baseParams,
            category: category,
            page: page.toString()
        });
        
        const response = await fetch(`https://pro-api.coingecko.com/api/v3/coins/markets?${params}`, {
            headers: {"x-cg-pro-api-key": COINGECKO_CONFIG.apiKey}
        });
        const pageCoins = await response.json();
        
        if (pageCoins.length === 0) break;
        
        categoryCoins = [...categoryCoins, ...pageCoins];
        console.log(`Category ${category} page ${page} returned ${pageCoins.length} coins`);
        page++;
    }
    
    return categoryCoins;
}

async function fetchFilteredCaps(tokenCount, filterOutCategories = []) {
    try {
        //fetch 1.5x the number of tokens because some will be filtered out
        const fetchCount = Math.ceil(tokenCount*1.5);

        const [allTokens, ...categoryResults] = await Promise.all([
            fetchAllCaps(fetchCount),
            ...filterOutCategories.map(category => 
                fetchCategoryCaps(category)
            )
        ]);

        const excludeIds = new Set(
            categoryResults.flat().map(coin => coin.id)
        );

        const filteredTokens = allTokens
            .filter(token => !excludeIds.has(token.id))
            .slice(0, tokenCount);
        
        const validTokenSymbols = await tokensOnCEX(filteredTokens.map(token => token.symbol.toUpperCase()));
        const finalTokens = filteredTokens.filter(token => validTokenSymbols.includes(token.symbol.toUpperCase()));
        console.log(`Final filtered coins: ${finalTokens.length}`);
        return finalTokens;
    } catch (error) {
        console.error('Error fetching data:', error);
        throw error;
    }
}

async function fetchWeeklyData(coins, monthsBack) {
    function dailyToWeekly(dailyData){
        for (let i = 0; i < dailyData.length; i++) {
            const weeklyPrices = [];
            const weeklyMarketCaps = [];

            for (let j = 0; j < dailyData[i].prices.length; j += 7) {
                weeklyPrices.push(dailyData[i].prices[j]);
                weeklyMarketCaps.push(dailyData[i].market_caps[j]);
            }
            dailyData[i].prices = weeklyPrices;
            dailyData[i].market_caps = weeklyMarketCaps; 
        }
    }
    
    let historicalData = [];
    
    const BATCH_SIZE = 100;  //smaller, safer batch size
    const MINUTE = 60000;
    
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - monthsBack);

    const dayCount = Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1; //add 1 because coingecko includes the current day
    let currentIndex = 0;
    while (currentIndex < coins.length) {
        try {
            const batch = coins.slice(currentIndex, currentIndex + BATCH_SIZE);
            console.log(`Processing batch ${currentIndex}-${currentIndex + batch.length} of ${coins.length}`);
            const batchRequests = batch.map((coin, index) => 
                fetch(`https://pro-api.coingecko.com/api/v3/coins/${coin.id}/market_chart?vs_currency=usd&days=${dayCount}&interval=daily`, {
                    headers: {"x-cg-pro-api-key": COINGECKO_CONFIG.apiKey}
                }).then(async response => {
                    if (response.status === 429) {
                        throw {type: 'rate_limit'};
                    }
                    if (!response.ok) {
                        throw new Error(`Fetch failed for ${coin.id}: ${response.status}`);
                    }
                    const data = await response.json();
                    return {
                        coin_id: coin.id,
                        symbol: coin.symbol.toUpperCase(),
                        prices: data.prices,
                        market_caps: data.market_caps
                    };
                })
            );

            try {
                const results = await Promise.all(batchRequests);
                historicalData.push(...results.filter(r => r !== null));
                currentIndex += batch.length;
                console.log(`Successfully processed ${results.filter(r => r !== null).length}/${batch.length} coins. Total: ${historicalData.length}`);
            } catch (error) {
                if (error.type === 'rate_limit') {
                    console.log(`Rate limit hit in batch, rolling back to ${currentIndex}`);
                    await new Promise(resolve => setTimeout(resolve, MINUTE));
                } else {
                    console.error(`Error in batch starting at ${currentIndex}, rolling back to ${currentIndex}:`, error);
                    await new Promise(resolve => setTimeout(resolve, MINUTE));
                }
                continue; //retry the same batch

            }

            // ait a bit between successful batches to be safe
            await new Promise(resolve => setTimeout(resolve, 2000));

        } catch (error) {
            console.error(`Batch error starting at index ${currentIndex}:`, error);
            await new Promise(resolve => setTimeout(resolve, MINUTE));
        }
    }
    
    console.log(`Total historical data entries: ${historicalData.length}`);
    historicalData.forEach(coin => {
        const firstDate = new Date(coin.prices[0][0]);
        const daysToFirstMonday = firstDate.getDay() === 0 ? 1 : 8 - firstDate.getDay();
        coin.prices = coin.prices.slice(daysToFirstMonday);
        coin.market_caps = coin.market_caps.slice(daysToFirstMonday);
    });
    dailyToWeekly(historicalData);

    return historicalData;
}
    

async function formWeeklyETFsByCap(weeklyData, tokenCount){
    function getWeekCount(weeklyData){
        const weekCounts = [];
        for (let i = 0; i < weeklyData.length; i++) {
            weekCounts.push(weeklyData[i].prices.length);
        }
        return Math.max(...weekCounts);
    }
    const weeklyETFs = [];
    const weekCount = getWeekCount(weeklyData);
    for (let week = 0; week < weekCount; week++) {
        const weekMarketCaps = weeklyData
            .map(token => {
                const relativeWeek = token.market_caps.length - (weekCount - week);
                
                return {
                    coin_id: token.coin_id,
                    symbol: token.symbol,  
                    market_cap: relativeWeek >= 0 && token.market_caps[relativeWeek] 
                        ? token.market_caps[relativeWeek][1] 
                        : 0,
                    timestamp: relativeWeek >= 0 && token.market_caps[relativeWeek]
                        ? token.market_caps[relativeWeek][0]  
                        : 0
                };
            })
        
        const topTokens = weekMarketCaps
            .sort((a, b) => b.market_cap - a.market_cap)
            .slice(0, tokenCount);
            
        weeklyETFs.push({
            timestamp: topTokens[0].timestamp,
            tokens: topTokens
        });
    }
    
    console.log(`Processed ${weekCount} weeks of market cap data`);
    return weeklyETFs;
}

async function calculateETFWeights(weeklyETFs, maxWeight){
    const weeklyWeights = [];

    for (const weeklyETF of weeklyETFs) {
        const tokens = weeklyETF.tokens;
        
        const totalMarketCap = tokens.reduce((sum, token) => sum + token.market_cap, 0);

        let weights = tokens.map((token) => ({
            ...token,
            initialWeight: token.market_cap / totalMarketCap
        }));
        let excessWeight = 0;
        weights = weights.map((token) => {
            if (token.initialWeight > maxWeight) {
                excessWeight += token.initialWeight - maxWeight;
                return { ...token, cappedWeight: maxWeight };
            } else {
                return { ...token, cappedWeight: token.initialWeight };
            }
        });

        while (excessWeight > 0) {

            let remainingTokens = weights.filter((token) => token.cappedWeight < maxWeight);
            if (remainingTokens.length === 0) break; //no more tokens to redistribute to

            const totalRemainingMarketCap = remainingTokens.reduce((sum, token) => sum + token.market_cap, 0);

            let redistribute = false;
            for (let token of remainingTokens) {
                const redistribution = (token.market_cap / totalRemainingMarketCap) * excessWeight;
                if (token.cappedWeight + redistribution > maxWeight) {
                    const overshoot = token.cappedWeight + redistribution - maxWeight;
                    excessWeight -= redistribution - overshoot;
                    token.cappedWeight = maxWeight;
                    redistribute = true;
                } else {
                    token.cappedWeight += redistribution;
                    excessWeight -= redistribution;
                }
            }

            if (!redistribute) break; 
        }

        
        weeklyWeights.push({
            timestamp: weeklyETF.timestamp,
            weights: weights.map(token => ({
                symbol: token.symbol,
                weight: token.cappedWeight,
                market_cap: token.market_cap,
                id: token.coin_id
            }))
        })
    }

    return weeklyWeights;
}


async function getETFsByCap(tokenCount, monthsBack = 60, maxWeight = 0.25, filterOutCategories = ['stablecoins', 'wrapped-tokens', 'liquid-staking']) {
    const coins = await fetchFilteredCaps(1000, filterOutCategories);
    const weeklyData = await fetchWeeklyData(coins, monthsBack);
    const weeklyETFs = await formWeeklyETFsByCap(weeklyData, tokenCount);
    const weightedETFs = await calculateETFWeights(weeklyETFs, maxWeight);
    return weightedETFs;
}

async function saveWeeklyETFs(weightedETFs, etfName) {
    const existingData = await db.select({
        timestamp: etfWeights.timestamp,
        etfName: etfWeights.etfName,
    }).from(etfWeights);
    const existingPairs = new Set(
        existingData.map(row => `${row.timestamp}-${row.etfName}`)
    );

    const newEtfValues = weightedETFs
        .filter(weightedETF => {
            const pair = `${weightedETF.timestamp}-${etfName}`;
            return !existingPairs.has(pair);
        })
        .map(weightedETF => ({
            timestamp: weightedETF.timestamp,
            etfName: etfName,
            value: weightedETF.value,
            weights: JSON.stringify(weightedETF.weights),
        }));

    if (newEtfValues.length > 0) {
        await batchInsert(db, etfWeights, newEtfValues);
        console.log(`${newEtfValues.length} new etfs saved.`);
    } else {
        console.log("No new etfs to save.");
    }
}

async function resaveCurrentMarketCaps(tokenCount) {
    const tokens = await fetchAllCaps(tokenCount);

    const marketCapValues = tokens.map(token => ({
        symbol: token.symbol.toUpperCase(),
        market_cap: token.market_cap
    }));

    await clearTable(db, currentMarketCaps);
    await batchInsert(db, currentMarketCaps, marketCapValues);
}

async function getCurrentPriceByCap(etfName, divisor = 1000000000) {
    const start = new Date().getTime();
    const etfWeightRows = await db.select().from(etfWeights).where(eq(etfWeights.etfName, etfName));
    const latestEtfWeightRow = etfWeightRows[etfWeightRows.length - 1]; 
    const latestWeights = latestEtfWeightRow.weights;
    let etfPrice = 0;
    const marketCapPromises = [];
    for (const weight of latestWeights) {
      console.log(new Date().getTime());
      const marketCapPromise = fetchCurrentCapByID(weight.id);
      marketCapPromises.push(marketCapPromise);
    }
    const marketCaps = await Promise.all(marketCapPromises);
    for (let i = 0; i < latestWeights.length; i++) {
      const allocationWeightFactor = latestWeights[i].weight;
      const marketCap = marketCaps[i];
      etfPrice += marketCap * allocationWeightFactor / divisor;
    }

    console.log(`Current ETF Price for ${etfName}:`, etfPrice);
    console.log("Time taken:", new Date().getTime() - start);
    return {
      timestamp: Date.now(),
      etfPrice: etfPrice
    };
  }

async function getWeeklyPricesByCap(etfName, divisor = 1000000000) {
    const etfWeightRows = await db.select().from(etfWeights).where(eq(etfWeights.etfName, etfName));
    const results = [];

    for (const etfWeightRow of etfWeightRows) {
        const weights = JSON.parse(etfWeightRow.weights);
        let etfPrice = 0;
        for (const weight of weights) {
        const marketCap = weight.market_cap;
        const allocationWeightFactor = weight.weight;
        etfPrice += marketCap * allocationWeightFactor / divisor;
        }
        console.log(`ETF Price for ${etfName} at ${etfWeightRow.timestamp}:`, etfPrice);
        results.push({
        timestamp: etfWeightRow.timestamp,
        etfPrice: etfPrice
        });
    }

    return results;
}