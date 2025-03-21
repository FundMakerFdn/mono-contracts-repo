const custody = {
  parties: [
    {
      name: "A",
      pubKey: "0xPartyA",
      address: "0xABCD",
      type: "trader",
    },
    {
      name: "B",
      pubKey: "0xPartyB",
      address: "0xEF10",
      type: "solver",
    },
    {
      name: "GA1",
      pubKey: "0xGA1",
      type: "guardian",
      toParty: "A",
      guardianIndex: 0,
    },
    {
      name: "GB1",
      pubKey: "0xGB1",
      type: "guardian",
      toParty: "B",
      guardianIndex: 0,
    },
    {
      name: "A+B", // trade
      pubKey: "0xAB1",
      type: "multisig",
    },
    {
      name: "A+B+GA", // withdraw to B
      pubKey: "0xAB2",
      type: "multisig",
    },
    {
      name: "A+B+GB", // withdraw to A
      pubKey: "0xAB3",
      type: "multisig",
    },
  ],

  /*
    NewOrderSingle D
    CancelOrder C  
    AddressToCustody ATC
    CustodyToAddress CTA
    FreezeOrder FO

    */

  //collaterals
  collaterals: [
    {
      party: "0xPartyA",
      chainId: 1,
      PSIN: "PSYMM123",
      amount: 10000,
      haircut: 0.1,
      isBaseToken: true,
    },
    {
      party: "0xPartyB",
      chainId: 1,
      PSIN: "PSYMM123",
      amount: 10000,
      haircut: 0.1,
      isBaseToken: true,
    },
  ],

  //tempVariables
  totalCollateralValue: [
    // In base token
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
};

// ACK queeu ( queue where we verify we received ACK of a message
//

module.exports = custody;
