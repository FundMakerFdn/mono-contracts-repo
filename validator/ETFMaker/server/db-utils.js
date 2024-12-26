import { sql, eq } from 'drizzle-orm';
import { etfWeights } from './schema.js';
import db from './database.js';


export async function clearTable(db, table) {
    const tableName = table[Symbol.for('drizzle:Name')];
    await db.execute(sql`TRUNCATE TABLE ${sql.identifier(tableName)} RESTART IDENTITY;`);
}

export async function batchInsert(db, table, items, chunkSize = 999) {
    for (let i = 0; i < items.length; i += chunkSize) {
      await db
        .insert(table)
        .values(items.slice(i, i + chunkSize))
        .onConflictDoNothing();
    }
  }

export async function getETFWeights(etfName) {
  const etfWeightRows = await db.select().from(etfWeights).where(eq(etfWeights.etfName, etfName));
  return etfWeightRows;
}

export async function getAllRows(tableName){
  return await db.select().from(tableName);
}

export async function saveWeeklyETFs(weightedETFs, etfName) {
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
