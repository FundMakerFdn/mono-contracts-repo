# Solver
The solver responds to derivative contracts RFQ's from party A, ensuring that a market maker can fill the trade with minimal liquidation chance. The solver needs to hedge in order to stay delta neutral with the open contracts. This can be done off-chain on an exchenge (e.g. Binance), or using other contracts, being them perps or other derivatives (since parties are trading the account uPNL, the liquidity provider can use other contracts where it is either party A or party B to keep the margin requirements satisfied).

### EVM Manager
The EVM manager will give the solver the functionality to interact with contracts. 

### FIX Manager
This will communicate with the WebApp.

### Hedge Manager
The Hedge manager will create the hedging strategy for the solver. It will output the combination of orders/intents that must be sent on/off-chain so that solver is delta neutral with all its opened contracts. This will request the opening of one or more positions, and can be called at the accepting of an RFQ.

### Collateral Manager
This will analyze and report the solver uPNL. The Collateral Manager must assure that contracts have enough margin not to be liquidated. 

**_NOTE:_** Since contracts can have different settlement symbols, the collateral must be calculated in different symbols. This may require the streaming of swap data, in order to calculate conversions.

**_IMPORTANT:_** The collateral manager must define which contracts can be closed, and which tokens can be withdrawn. The closing of a contract may liquidate others, due to the trading of uPNL. E.g. a long contract that is being collateralized by a short contract and vice-versa, if one of the contracts is closed, the tokens cannot be withdraw, or the other contract will be liquidated.


### Maket Data Manager
This will be responsible for providing the solver with exchenge data (books and tickers).

### Order Manager
This will be responsible for executing orders on the exchange.


# Tasks for MVP
- Receive derivative RFQ:
    - Integrate with EVM Manager.
    - Create different types of derivatives contracts.
    - Create tests for contracts actions.

- Read Binance market data:
    - Subscribe to tickers:
    - Subscribe to orderbooks.

- Manage Binance orders:
    - Send order requests;
    - Track order lifetime.

- Create Hedger Manager:
    - Create off-chain order requests based on solver intended position.

- Create Collateral Manager:
    - Track custody across all symbols.
    - Verify uPNL.
    - Approve actions based on available collateral.


# Main sequence of events
1. PartyA Creates an RFQ.
2. Solver locks the RFQ.
3. Hedge Manager determines hedge orders.
4. Order Manager creates orders on exchange.
5. Collateral Manager approves the contract margin (based on solver uPNL and deposits).
6. Solver accepts the RFQ.
