import db from "./database.js";
import { etfWeights } from "./schema.js";
import { eq } from "drizzle-orm";
import { fetchCurrentCapByID } from "./etfmaker.js";

export async function getWeeklyPrices(etfName, divisor = 1000000000) {
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

export async function getCurrentPrice(etfName, divisor = 1000000000) {
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

