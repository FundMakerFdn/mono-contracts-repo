import {sql} from 'drizzle-orm';

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
    const etfWeights = await db.select({}).from(etfWeights).where(eq(etfWeights.etfName, etfName));
    return etfWeights;
}
