const custody = {

    baseToken: [
        {
            chainId: 1,
            ISIN: "PSYMM123",
            tokenName: "USDC",
            tokenPrecision: 6,
            token: "0x1",
            backupConditionUnpeggedPriceLower: 0.9,
            backupConditionUnpeggedPriceUpper: 0,
            priority: 0,
        },
        {
            chainId: 2,
            ISIN: "PSYMM123",
            tokenName: "USDC",
            tokenPrecision: 6,
            token: "0x2",
            backupConditionUnpeggedPriceLower: 0.9,
            backupConditionUnpeggedPriceUpper: 0,
            priority: 0,
        },
        {
            chainId: 1,
            ISIN: "PSYMM123",
            tokenName: "USDT",
            tokenPrecision: 18,
            token: "0x3",
            backupConditionUnpeggedPriceLower: 0.9,
            backupConditionUnpeggedPriceUpper: 0,
            priority: 1,
        },
        {
            chainId: 2,
            ISIN: "PSYMM123",
            tokenName: "USDT",
            tokenPrecision: 18,
            token: "0x4",
            backupConditionUnpeggedPriceLower: 0.9,
            backupConditionUnpeggedPriceUpper: 0,
            priority: 1,
        },
    ],

    //collaterals
    collaterals: [
        {
            party: "0xPartyA",
            chainId: 1,
            token: "0x1",
            amount: 10000,
            haircut: 0.1,
        },
        {
            party: "0xPartyB",
            chainId: 1,
            token: "0x2",
            amount: 10000,
            haircut: 0.1,
        },
    ],

    //tempVariables
    totalCollateralValue: [ // In base token
        {
            party: "0xPartyA",
            value: 10000,
        },
        {
            party: "0xPartyB",
            value: 10000,
        },
    ],

    custodyLimits: {
        heartbeatPeriod: 300,
        heartbeatAckPercentage: 0.9,
        positionMaxNumber: 100,
        positionNumber: 0,
        quoteMaxNumber: 100,
        quoteNumber: 0,
    },

    instrumentList: [
        {
            Symbol: "BTC/USD",
            InstrumentID: "PSYMM0000131104",
            InstrumentType: "PERP",
            quoteMethod: "/swap",
            InstrumentDetails: {
              InitialMarginClient: "0.10",
              InitialMarginBroker: "0",
              MaintenanceMarginClient: "0.05",
              MaintenanceMarginBroker: "0.05",
              LiquidationFeeClient: "0.01",
              LiquidationFeeBroker: "0.01",
              MinPrice: "0.00100000",
              MaxPrice: "1000.00000000",
              TickSize: "0.00100000",
              MinNotional: "10.00000000",
              MaxNotional: "90000000.00000000",
              fundingRateSource: "0xFundingRateSource",
              FundingRate: "1",
              FundingRatePrecision: "3",
              cancelGracePeriod: 300,
              minContractAmount: 1000,
              maxLimitOrderFromPrice: 1.1,
              minLimitOrderFromPrice: 0.9,
            },
        },
    ],


    ISINList: [
        {
            ISIN: "US1234567890",
            AssetName: "pSymm ETF",
            AssetSymbol: "PSYM",
            AssetDescription: "pSymm ETF",
            AssetLogo: "https://pSymm.com/logo.png",
            AssetPriceFeed: "https://pSymm.com/pricefeed.json",
            AssetPriceFeedDecimals: 18,
        },
    ],
/*
    FundingAgreementList: [
        {
            FundingAgreementID: "PSYMM0000131104",
            Type:"BinanceFutures",
            Source: "BinanceFutures"
            1/ Before funding, counterparty sign a funding range agreement on next funding.
1.1/ Case where counterparty reject funding range, both parties direct to close position.
2/ At funding time, counterparty sign a funding agreement of paid funding.

        },
    ],*/

}

/*
Checks

"Filter failure: PRICE_FILTER"	price is too high, too low, and/or not following the tick size rule for the symbol.
"Filter failure: PERCENT_PRICE"	price is X% too high or X% too low from the average weighted price over the last Y minutes.
"Filter failure: NOTIONAL"	price * quantity is not within range of the minNotional and maxNotional
"Filter failure: MAX_NUM_ORDERS"	Account has too many open orders on the symbol.
"Filter failure: EXCHANGE_MAX_NUM_ORDERS"	Account has too many open orders on the exchange.


{
    "symbol":"DTRY",
    "status":"TRADING",
    "baseAsset":"D",
    "baseAssetPrecision":8,
    "quoteAsset":"TRY",
    "quotePrecision":8,
    "quoteAssetPrecision":8,
    "baseCommissionPrecision":8,
    "quoteCommissionPrecision":8,
    "orderTypes":["LIMIT","LIMIT_MAKER","MARKET","STOP_LOSS","STOP_LOSS_LIMIT","TAKE_PROFIT","TAKE_PROFIT_LIMIT"],
    "ocoAllowed":true,
    "otoAllowed":true,
    "quoteOrderQtyMarketAllowed":true,
    "cancelReplaceAllowed":true,
    "filters":[
        {"filterType":"PRICE_FILTER",
        "minPrice":"0.00100000",
        "maxPrice":"1000.00000000",
        "tickSize":"0.00100000"},
        {"filterType":"LOT_SIZE",
        "minQty":"0.10000000",
        "maxQty":"92141578.00000000",
        "stepSize":"0.10000000"},
    {"filterType":"PERCENT_PRICE_BY_SIDE",
        "bidMultiplierUp":"5",
        "bidMultiplierDown":"0.2",
        "askMultiplierUp":"5",
        "askMultiplierDown":"0.2",
        "avgPriceMins":5},
    {"filterType":"NOTIONAL",
        "minNotional":"10.00000000",
        "applyMinToMarket":true,
        "maxNotional":"90000000.00000000",
        "applyMaxToMarket":false,
        "avgPriceMins":5},
    {"filterType":"MAX_NUM_ORDERS",
        "maxNumOrders":200},
    {"filterType":"MAX_NUM_ALGO_ORDERS",
        "maxNumAlgoOrders":5}
    ],
    "},

    {
        "ISIN": "US1234567890",
        "AssetName": "pSymm ETF",
        "AssetSymbol": "PSYM",
        "AssetDescription": "pSymm ETF",
        "AssetLogo": "https://pSymm.com/logo.png",
        "AssetPriceFeed": "https://pSymm.com/pricefeed.json",
        "AssetPriceFeedDecimals": 18,
        
      }


      


