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
              TickSize: "0.00100000",
              BaseAssetPrecision: 8,
              MinNotional: "10.00000000",
              MaxNotional: "90000000.00000000",
              FundingRate: "+2",
              FundingMethod: "/funding/cryptoperp",
              cancelGracePeriod: 300,
              minContractAmount: 1000,
              maxLimitOrderFromPrice: 1.1,
              minLimitOrderFromPrice: 0.9,
            },
        },
    ],


    
    //getPrice()
    //getHistoricalPrice()
    //getFunding()
    PSYMMSIN: [
        {
            PSYMMSIN: "PSYMM1234567890",
            Ticker: "BTCUSDT",
            AssetType: "PERP",
            AssetCategory: "CRYPTO",
            Note: "",
            PriceSource:["/binance/futures/asset:{BTCUSDT}","/bybit/futures/asset:{BTCUSDT}"],
            FundingSource:["/binance/funding/asset:{BTCUSDT}","/bybit/funding/asset:{BTCUSDT}"],
            PriceDecimals: 18,
        },
    ],  

}


// ACK queeu ( queue where we verify we received ACK of a message