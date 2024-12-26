Before running any of the commands, make sure to:
- have postgresql installed and set up
- generate and migrate via drizzle-kit

yarn ETFMaker --token-count <token-count> --months-back <months-back> --weight-cap <weight-cap>  -> Builds a pool of viable tokens for ETFs and builds ETF portfolios every week.