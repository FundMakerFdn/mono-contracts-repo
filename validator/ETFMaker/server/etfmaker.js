import db from './database.js';
import { etfWeights, currentMarketCaps, tokenPools } from './schema.js';
import { clearTable, batchInsert } from './db-utils.js';
import { getTokenPrices, tokensOnCEX, fetchKlineData } from './binance.js';
import { program } from 'commander';
import CONFIG from '../config.js'


program
  .option("-t, --token-count <token-count>", "Token count in the etfs.", "30")
  .option("-s, --months-back <months-back>", "How many months back to fetch data for.", "2")
  .option("-w, --weight-cap <weight-cap>", "The weight cap for the etfs.", "0.25")
  .parse(process.argv);

const opts = program.opts();

const PER_PAGE_MAX = 250;

const COINGECKO_CONFIG = {
    baseParams: {
        vs_currency: "usd",
        order: "market_cap_desc",
        per_page: PER_PAGE_MAX.toString(),
    },
    apiKey: CONFIG.COINGECKO_API_KEY
}

export async function fetchCurrentCapByID(tokenId) {
    const response = await fetch(`https://pro-api.coingecko.com/api/v3/coins/${tokenId}`, {
        headers: { "x-cg-pro-api-key": COINGECKO_CONFIG.apiKey }
    }).then(async response => {
        if (!response.ok) {
            throw new Error(`Failed to fetch market cap for token ID ${tokenId}: ${response.status}`);
        }
        const data = await response.json();
        return data.market_data.market_cap.usd;
    });
    return response;
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

function getMondayDates(monthsBack) {
    const dates = [];
    const now = new Date();
    const startDate = new Date(now.getUTCFullYear(), now.getUTCMonth() - monthsBack, now.getUTCDate());

    const dayOfWeek = startDate.getUTCDay();
    const daysUntilMonday = (dayOfWeek === 0) ? 1 : (8 - dayOfWeek);
    let currentMonday = new Date(startDate);
    currentMonday.setUTCDate(startDate.getUTCDate() + daysUntilMonday);
    currentMonday.setUTCHours(0, 0, 0, 0);

    while (currentMonday <= now) {
        dates.push(currentMonday.getTime());
        currentMonday.setUTCDate(currentMonday.getUTCDate() + 7);
    }

    return dates;
}

async function pickTokensforPools(tokenCount, monthsBack, filterOutCategories = ['stablecoins', 'wrapped-tokens', 'liquid-staking']) {
    const coins = await fetchFilteredCaps(tokenCount, filterOutCategories);
    const timestamps = getMondayDates(monthsBack);
    const pools = [];

    for (const timestamp of timestamps) {
        const fetchPromises = coins.map(coin => 
            fetchKlineData(`${coin.symbol.toUpperCase()}USDT`, timestamp)
                .then(() => coin) 
                .catch(() => {
                    return null; 
                })
        );

        const results = await Promise.all(fetchPromises);

        const currentPool = results
                            .filter(result => result !== null)
                            .map(result => ({symbol: result.symbol, id: result.id}));

        pools.push({timestamp: timestamp, tokens: currentPool});

        console.log(`Token pool for timestamp ${timestamp} created with ${currentPool.length} tokens, waiting for 10 seconds.`);
        await new Promise(resolve => setTimeout(resolve, 10000));
    }

    return pools;
}

async function extractTokensFromPools(pools) {
    const tokensSet = new Set();

    for (const pool of pools) {
        for (const token of pool.tokens) {
            const tokenKey = `${token.symbol}&${token.id}`;
            if (!tokensSet.has(tokenKey)) {
                tokensSet.add(tokenKey);
            }
        }
    }

    const tokensArray = Array.from(tokensSet).map(tokenKey => {
        const [symbol, id] = tokenKey.split('&');
        return { symbol, id };
    });

    return tokensArray;
}

async function createTokenPools(tokenCount, monthsBack, filterOutCategories = ['stablecoins', 'wrapped-tokens', 'liquid-staking']) {
    const poolTokens = await pickTokensforPools(tokenCount, monthsBack, filterOutCategories);
    const eligibleTokens = await extractTokensFromPools(poolTokens);
    const weeklyData = await fetchWeeklyData(eligibleTokens, monthsBack);
    await new Promise(resolve => setTimeout(resolve, 10000));
    const pools = poolTokens.map(pool => {
        const tokensWithMarketCaps = pool.tokens.map(token => {
            const marketCapData = weeklyData.find(data => data.coin_id === token.id);
            const capEntry = marketCapData.market_caps.find(([time]) => time === pool.timestamp);
            return {
                ...token,
                market_cap: capEntry ? capEntry[1] : 0
            };
        });
        return {
            timestamp: pool.timestamp,
            tokens: tokensWithMarketCaps
        };
    });

    return pools;

}
async function saveTokenPools(pools) {
    await batchInsert(db, tokenPools, pools);
}

async function fetchTokenPools(monthsBack) {
    const timestamps = getMondayDates(monthsBack);
    const allPools = await db.select().from(tokenPools);
    const filteredPools = allPools.filter(pool => timestamps.includes(pool.timestamp));
    return filteredPools;
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

async function formWeeklyETFsByCapFromPool(pools, tokenCount){
    const weeklyETFs = [];

    for (const pool of pools) {
        // Extract tokens and sort them by market cap in descending order
        const sortedTokens = pool.tokens
            .filter(token => token.market_cap !== undefined && token.market_cap !== null)
            .sort((a, b) => b.market_cap - a.market_cap);

        // Select the top tokens based on the tokenCount
        const topTokens = sortedTokens.slice(0, tokenCount);

        // Form the weekly ETF for the current pool
        weeklyETFs.push({
            timestamp: pool.timestamp,
            tokens: topTokens
        });
    }

    return weeklyETFs;
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

async function calculateETFWeightsFromPool(weeklyETFs, maxWeight){
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
                id: token.id
            }))
        })
    }

    return weeklyWeights;
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

async function calculateETFQuantitiesAndPrices(etfWeights, initialValue){
    async function getQuantities(etf, value){
        const tokenSymbols = etf.weights.map(weight => weight.symbol);
        const prices = await getTokenPrices(tokenSymbols, etf.timestamp);
        const quantities = prices.map((price, index) => 
            (value * etf.weights[index].weight)/price.price
        );
        return quantities;
    }
  
    const initialQuantities = await getQuantities(etfWeights[0], initialValue);
    etfWeights[0].weights.forEach((weight, index) => {
        weight.quantity = initialQuantities[index];
    });
    etfWeights[0].value = initialValue;


    for (let i = 1; i < etfWeights.length; i++) {
        const lastTokenSymbols = etfWeights[i-1].weights.map(weight => weight.symbol);
        const lastTokenPrices = await getTokenPrices(lastTokenSymbols, etfWeights[i].timestamp);
        await new Promise(resolve => setTimeout(resolve, 10000));
        const lastQuantities = etfWeights[i-1].weights.map(weight => weight.quantity);
        const lastValue = lastQuantities.reduce((sum, quantity, index) => sum + quantity * lastTokenPrices[index].price, 0);
        etfWeights[i].value = lastValue;
        const quantities = await getQuantities(etfWeights[i], lastValue);
        etfWeights[i].weights.forEach((weight, index) => {
            weight.quantity = quantities[index];
        });
    }

}

async function getETFsByCapFromPool(tokenCount, monthsBack = 60, maxWeight = 0.25, filterOutCategories = ['stablecoins', 'wrapped-tokens', 'liquid-staking']) {
    const pools = await fetchTokenPools(monthsBack);
    const weeklyETFs = await formWeeklyETFsByCapFromPool(pools, tokenCount);
    const weightedETFs = await calculateETFWeightsFromPool(weeklyETFs, maxWeight);
    console.log("Calculating quantities and prices...");
    await calculateETFQuantitiesAndPrices(weightedETFs, 1000);

    return weightedETFs;
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


async function main() {
    await clearTable(db, tokenPools);
    const pools = await createTokenPools(5000, opts.monthsBack);
    await saveTokenPools(pools);


    await clearTable(db, etfWeights);
    const weightedETFs = await getETFsByCapFromPool(opts.tokenCount, opts.monthsBack, opts.weightCap);

    saveWeeklyETFs(weightedETFs, "test")
        .then(() => {
            process.exit(0);
            })
            .catch((error) => {
                console.error(error);
                process.exit(1);
        });
}

main().catch(error => {
    console.error('An error occurred:', error);
    process.exit(1);
});
