CREATE TABLE "current_market_caps" (
	"id" serial PRIMARY KEY NOT NULL,
	"symbol" text NOT NULL,
	"market_caps" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "etf_weights" (
	"id" serial PRIMARY KEY NOT NULL,
	"etfName" text NOT NULL,
	"timestamp" bigint NOT NULL,
	"value" numeric(10, 3) NOT NULL,
	"weights" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "token_pool" (
	"id" serial PRIMARY KEY NOT NULL,
	"timestamp" bigint NOT NULL,
	"tokens" jsonb NOT NULL
);
--> statement-breakpoint
CREATE INDEX "current_market_caps_symbol_idx" ON "current_market_caps" USING btree ("symbol");--> statement-breakpoint
CREATE INDEX "etf_weights_etfName_idx" ON "etf_weights" USING btree ("etfName");--> statement-breakpoint
CREATE INDEX "etf_weights_timestamp_idx" ON "etf_weights" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "token_pool_timestamp_idx" ON "token_pool" USING btree ("timestamp");