import db from "./database.js";
import { getETFWeights } from "./db-utils.js";
import { etfWeights } from "./schema.js";
import { eq } from "drizzle-orm";





export async function fetchKlineData(ticker, timestamp = null) {
    let url;
    if (!timestamp) {
        //either use the /ticker/price endpoint or the kline endpoint here
        //url = `https://api.binance.com/api/v3/ticker/price?symbol=${ticker}&interval=1s`;
        url = `https://api.binance.com/api/v3/klines?symbol=${ticker}&interval=1s&limit=1`;
    } else {
        url = `https://api.binance.com/api/v3/klines?symbol=${ticker}&interval=1s&startTime=${timestamp}&endTime=${timestamp}&limit=1`;
    }
    return fetch(url).then(async response => {
      if (!response.ok) {
        throw new Error(`Failed to fetch kline data for ${ticker} at ${timestamp !== null ? timestamp : "recent"}: ${response.status}`);
      }
      const data = await response.json();
      if (data.length === 0) {
        throw new Error(`No data found for ${ticker} at ${timestamp}`);
      }
      return data;
    });
  }

  export async function getTokenPrices(tokenSymbols, timestamp = null) {
    const fetchPromises = tokenSymbols.map(async (tokenSymbol) => {
        try {
            const data = await fetchKlineData(`${tokenSymbol.toUpperCase()}USDT`, timestamp);
            return data;
        } catch (error) {
            if (timestamp && error.message.includes('No data found')) {
                console.warn(`No data found for ${tokenSymbol} at ${timestamp}, fetching most recent data.`);
                try {
                    const recentData = await fetchKlineData(`${tokenSymbol.toUpperCase()}USDT`);
                    return recentData;
                } catch (recentError) {
                    throw recentError;
                }
            } else {
                throw error;
            }
        }
    });

    const klineData = await Promise.all(fetchPromises);

    const result = klineData.map((data, index) => ({
        symbol: tokenSymbols[index],
        //price: data.length > 0 ? data[0][1] : 0 // get the open price
        price: data[0][1]
    }));

    return result;
}

export async function tokensOnCEX(tokenSymbols) {
    const url = "https://api.binance.com/api/v3/exchangeInfo";

    try {
        const response = await fetch(url);
        const data = await response.json();
        const validSymbols = new Set(
            data.symbols.filter((s) => s.symbol.endsWith("USDT")).map((s) => s.symbol)
        );
        const filteredTokens = tokenSymbols.filter((token) =>
            validSymbols.has(`${token}USDT`)
        );
        return filteredTokens;
    } catch (error) {
        console.error("Error fetching Binance trading pairs:", error.message);
        return [];
    }
}

export async function getCurrentETFValue(etfName) {
    const etfWeightRows = await getETFWeights(etfName);
    const latestEtfWeightRow = etfWeightRows[etfWeightRows.length - 1]; 
    const latestWeights = latestEtfWeightRow.weights;
    const symbols = latestWeights.map(token => token.symbol);
    const tokenPrices = await getTokenPrices(symbols)
    const quantities = latestWeights.map(token => ({symbol: token.symbol, quantity: token.quantity}))
    const etfValue = latestWeights.reduce((totalValue, token, index) => {
        const price = tokenPrices[index].price;
        return totalValue + (token.quantity * price);
    }, 0);



    console.log(`Current ETF Value for ${etfName}:`, etfValue);

    return {
      timestamp: Date.now(),
      etfPrice: etfValue
    };
  }

export async function getWeeklyETFValues(etfName){
    const etfWeightRows = await getETFWeights(etfName);
    const values = etfWeightRows.map(etf => ({timestamp: etf.timestamp, value: etf.value}));
    return values
}

async function processEtfWeights(etfName) {
    const etfWeightRows = getETFWeights(etfName);
    const results = [];
    for (const etfWeightRow of etfWeightRows) {
        const fetchPromises = [];
        const weights = JSON.parse(etfWeightRow.weights);
        for (const weight of weights) {
            try {
                const klineData = await fetchKlineData(`${weight['symbol']}USDT`, etfWeightRow.timestamp);
                fetchPromises.push(klineData);
                console.log(`Kline data for ${weight['symbol']} at ${etfWeightRow.timestamp}:`, klineData);
            }
            catch (error) {
                fetchPromises.push(Promise.resolve([]));
                console.error(`Failed to fetch kline data for token with symbol ${weight['symbol']}:`, error);
            }
        }
    
        const klineDataArray = await Promise.all(fetchPromises);
    
        const result = klineDataArray.map((klineData, index) => ({
            ticker: weights[index]['symbol'],
            klineOpenPrice: klineData.length > 0 ? klineData[0][1] : 0
        }));
        console.log(`Result for etf ${etfName} at ${etfWeightRow.timestamp}:`, result);
        results.push(result);
    }
  }

