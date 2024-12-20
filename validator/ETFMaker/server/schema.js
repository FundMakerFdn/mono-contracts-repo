import { pgTable, text, serial, index, jsonb, bigint, decimal } from 'drizzle-orm/pg-core';

export const etfWeights = pgTable('etf_weights', {
    id: serial('id').primaryKey(),
    etfName: text('etfName').notNull(),
    timestamp: bigint('timestamp', { mode: 'number' }).notNull(),
    value: decimal('value', { precision: 10, scale: 3 }).notNull(),
    weights: jsonb('weights').notNull(),
    }, (table) => ({
        etfNameIdx: index('etf_weights_etfName_idx').on(table.etfName),
        timestampIdx: index('etf_weights_timestamp_idx').on(table.timestamp)
    })
);

export const currentMarketCaps = pgTable('current_market_caps', {
    id: serial('id').primaryKey(),
    symbol: text('symbol').notNull(),
    market_cap: jsonb('market_caps').notNull(),
    }, (table) => ({
        symbolIdx: index('current_market_caps_symbol_idx').on(table.symbol)
    })
);

export const tokenPools = pgTable('token_pool', {
    id: serial('id').primaryKey(),
    timestamp: bigint('timestamp', { mode: 'number' }).notNull(),
    tokens: jsonb('tokens').notNull(),
    }, (table) => ({
        timestamp: index('token_pool_timestamp_idx').on(table.timestamp)
    })
);
