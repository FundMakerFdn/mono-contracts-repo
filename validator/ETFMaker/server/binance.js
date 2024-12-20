import db from "./database.js";
import { etfWeights } from "./schema.js";
import { eq } from "drizzle-orm";





export async function fetchKlineData(ticker, timestamp = null) {
    let url;
    if (!timestamp) {
        url = `https://api.binance.com/api/v3/ticker/price?symbol=${ticker}&interval=1s`;
    } else {
        url = `https://api.binance.com/api/v3/klines?symbol=${ticker}&interval=1s&startTime=${timestamp}&endTime=${timestamp}`;
    }
    return fetch(url).then(async response => {
      if (!response.ok) {
        throw new Error(`Failed to fetch kline data: ${response.status}`);
      }
      const data = await response.json();
      if (data.length === 0) {
        throw new Error(`No data found for ${ticker} at ${timestamp}`);
      }
      return data;
    });
  }

export async function getTokenPrices(tokenSymbols, timestamp = null){
    const fetchPromises = [];
    for (const tokenSymbol of tokenSymbols) {
        fetchPromises.push(fetchKlineData(`${tokenSymbol.toUpperCase()}USDT`, timestamp));
    }
    const klineData = await Promise.all(fetchPromises);
    

    const result = klineData.map((data, index) => ({
        symbol: tokenSymbols[index],
        price: data.length > 0 ? data[0][1] : 0 //get the open price
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

async function processEtfWeights(etfName) {
    const etfWeightRows = await db.select().from(etfWeights).where(eq(etfWeights.etfName, etfName));
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

