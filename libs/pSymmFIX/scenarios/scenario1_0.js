/* ------------ Summary: ------------ */
// 0. A creates custody (onchain only, not in FIX)
// 1. A TTC (onchain only, not in FIX)
// 2a. Logon (only by A / client), B should verify A's signature
// 2b. B sends ReportPPM
// 2c. A sends MessageAck for ReportPPM
// 3a. A: QuoteRequest
// 3b. B: MessageAck for QuoteRequest
// 4a. B: Quote
// 4b. A: MessageAck for Quote
// 5a. A: NewOrderSingle
// 5b. B: MessageAck for NewOrderSingle
// 6a. B: first ExecutionReport, TTC of B (onchain onl)
// 6b. A: MessageAck for first ExecutionReport
// 7a. B: second ExecutionReport
// 7b. A: MessageAck for second ExecutionReport
// 8a. B: TFC
// 8b. A: MessageAck for B's TFC
// 9a. A: TFC
// 9b. B: MessageAck for A's TFC

/* ------------ Helpers ------------ */
const seq = { a: 1, b: 1 };
const partyClient = "0xPartyA";
const partyBroker = "0xPartyB";

const getDate = () => Date.now() * 1_000_000; // nanoseconds
const offsetTwoDays = 2 * 86400 * 1_000_000_000; // example offset in future

const transferParams = {
  EIP712Header:
    "transferCustodyParams(bool isAdd,address partyA,address partyB,uint256 custodyId,uint256 collateralAmount,address collateralToken,uint256 expiration,uint256 timestamp,uint256 partyId,uint256 nonce)",

  MA: "0x0000000000000000000000000000000000000000000000000000000000000001",
  IsManaged: "N",
  CollateralAmount: "5000000000000000000",
  CollateralToken: "0x1234567890abcdef1234567890abcdef12345679",
  // Timestamp for EIP712 is used from StandardHeader.SendingTime
  Expiration: getDate() + offsetTwoDays,
};

const makeStandardHeader = (MsgType, isPartyA, seq) => ({
  BeginString: "pSymm.FIX.2.0",
  MsgType,
  DeploymentID: 101,
  // (When Party B sends, SenderCompID is 0xPartyB, TargetCompID is 0xPartyA)
  // Optional: OnBehalfOfCompID, DeliverToCompID
  SenderCompID: isPartyA ? partyClient : partyBroker,
  TargetCompID: isPartyA ? partyBroker : partyClient,
  MsgSeqNum: isPartyA ? seq.a++ : seq.b++,
  CustodyID: "0xCustody123",
  // Optional: PossDupFlag (if resend)
  SendingTime: getDate(), // unix nanoseconds
  // Optional: LastMsgSeqNumProcessed (to let counterparty know)
});

const makeStandardTrailer = (isA) => ({
  PublicKey: isA ? partyClient : partyBroker,
  Signature: "0xSignature", // Either EIP712 signature, or generic FIX text msg signature
});

const makeAckA = (seq) => ({
  StandardHeader: makeStandardHeader("ACK", true, seq),
  RefMsgSeqNum: seq.B - 1,
  StandardTrailer: makeStandardTrailer(true),
});
const makeAckB = (seq) => ({
  StandardHeader: makeStandardHeader("ACK", false, seq),
  RefMsgSeqNum: seq.A - 1,
  StandardTrailer: makeStandardTrailer(false),
});

const instrument = {
  Symbol: "BTC/USD",
  InstrumentID: "PSYMM0000131104",
  InstrumentType: "PERP",
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
    FundingRate: "1",
    FundingRatePrecision: "3",
  },
};

/* ------------------------ */

// 0. A creates custody onchain
// 1. A deposits funds to the custody
// Done and checked onchain.

// 2a. Logon by A (only client sends Logon)
const logon = {
  StandardHeader: makeStandardHeader("A", true, seq),
  HeartBtInt: 10, // (Optional) Heartbeat interval seconds
  StandardTrailer: makeStandardTrailer(true),
};
// B should verify logon.StandardTrailer.Signature of logon message matches logon.StandardHeader.SenderCompID
// 2b. B sends ReportPPM.

const reportPPM = {
  StandardHeader: makeStandardHeader("PPM", false, seq),
  PPM: [
    {
      chainId: 12,
      pSymm: "0x888",
      party: "pSymm Commission",
      type: "transfer",
      receiver: "0x00",
      allocation: 10000,
    },
    {
      chainId: 12,
      pSymm: "0x888",
      party: "ETF Factory",
      type: "transfer",
      receiver: "0x00",
      allocation: 9999,
    },
    {
      chainId: 12,
      pSymm: "0x888",
      party: "Allocator",
      type: "transfer",
      receiver: "0x00",
      allocation: 1000,
      trace: "0x123",
    },
    {
      chainId: 12,
      pSymm: "0x888",
      party: "Currator",
      type: "deploy",
      receiver: "0x234",
      allocation: "0x9827",
    },
    {
      chainId: 12,
      pSymm: "0x888",
      party: "Guardian",
      type: "pause",
      receiver: "0x00",
      allocation: "0x123",
    },
  ],
  StandardTrailer: makeStandardTrailer(false),
};

// 2c. A sends PPM ack
const reportPPMAck = makeAckA(seq);

// 3a. A sends QuoteRequest <R>
const quoteRequest = {
  StandardHeader: makeStandardHeader("R", true, seq),
  QuoteReqID: "REQ123",
  QuoteReqGrp: [
    // repeatable group, can contain multiple instruments
    {
      Instrument: instrument,
      Side: "1", // Buy
      OrderQtyData: {
        OrderQty: "100",
      },
      Currency: "USD",
      ValidUntilTime: getDate() + offsetTwoDays,
      Price: "50000",
    },
  ],
  StandardTrailer: makeStandardTrailer(true),
};

// 3b. B sends MessageAck for QuoteRequest
const quoteRequestAck = makeAckB(seq);

// 4a. B sends Quote (one per Instrument requested in QuoteRequest / combo: TODO)
const quote = {
  StandardHeader: makeStandardHeader("S", false, seq),
  QuoteReqID: "REQ123",
  Instrument: instrument,
  Side: "1", // Buy
  OrderQtyData: {
    OrderQty: "100",
  },
  Currency: "USD",
  BidPx: "50000",
  OfferPx: "50100",
  BidSize: "100",
  OfferSize: "100",
  ValidUntilTime: getDate() + offsetTwoDays,
  StandardTrailer: makeStandardTrailer(false),
};

// 4b. A sends MessageAck for Quote
const quoteAck = makeAckA(seq);

// 5a. A sends NewOrderSingle
const newOrderSingle = {
  StandardHeader: makeStandardHeader("D", true, seq),
  ClOrdID: "ORD123", // Order ID assigned by client
  Instrument: instrument,
  Price: "50050", // only for limit orders
  Side: "1", // Buy
  TransactTime: getDate(),
  OrderQtyData: {
    OrderQty: "100",
  },
  OrdType: "2", // Limit order
  StandardTrailer: makeStandardTrailer(true),
};

// 5b. B sends MessageAck for NewOrderSingle
const newOrderSingleAck = makeAckB(seq);

// 6a. B sends first ExecutionReport
const execReport1 = {
  StandardHeader: makeStandardHeader("8", false, seq),
  OrderID: "ORD456", // Order ID assigned by broker
  ClOrdID: "ORD123", // Client order ID
  ExecID: "EXEC123123789", // execution ID, unique per each fill
  ExecType: "F", // "Trade" (not sure?)
  OrdStatus: "1", // partial fill
  Instrument: instrument,
  Side: "1",
  OrderQtyData: {
    OrderQty: "100",
  },
  Price: "50050",
  CumQty: "50", // 50/100
  LastQty: "50",
  LastPx: "50050",
  StandardTrailer: makeStandardTrailer(false),
};

// 6b. A sends MessageAck for first ExecutionReport
const execReport1Ack = makeAckA(seq);

// 7a. B sends second ExecutionReport
const execReport2 = {
  StandardHeader: makeStandardHeader("8", false, seq),
  OrderID: "ORD456", // Order ID assigned by broker
  ClOrdID: "ORD123", // Client order ID
  ExecID: "EXEC123123790", // different ExecID
  ExecType: "F", // "Trade"
  OrdStatus: "2", // Filled
  Instrument: instrument,
  Side: "1",
  OrderQtyData: {
    OrderQty: "100",
  },
  Price: "50050",
  CumQty: "100", // 100/100
  LastQty: "50",
  LastPx: "50050",
  StandardTrailer: makeStandardTrailer(false),
};

// 7b. A sends MessageAck for second ExecutionReport
const execReport2Ack = makeAckA(seq);

// 8a. B sends TransferFromCustody
const transferFromCustodyB = {
  StandardHeader: makeStandardHeader("TFC", false, seq),
  ...transferParams,
  PartyID: "2", // for EIP712 struct (?)
  StandardTrailer: makeStandardTrailer(false),
};

// 8b. A sends TransferFromCustodyAck for B's withdrawal
const transferAckA = makeAckA(seq);

// 9a. A sends TransferFromCustody
const transferFromCustodyA = {
  StandardHeader: makeStandardHeader("TFC", true, seq),
  ...transferParams,
  PartyID: "1", // for EIP712 struct (?)
  StandardTrailer: makeStandardTrailer(true),
};

// 9b. B sends TransferFromCustodyAck for A's withdrawal
const transferAckB = makeAckB(seq);

// 10. A logout
const logout = {
  StandardHeader: makeStandardHeader("5", true, seq),
  StandardTrailer: makeStandardTrailer(true),
};

/* end */

const commonPart = [
  // common with Scenario 1.0 & 1.1
  logon,
  reportPPM,
  reportPPMAck,
  quoteRequest,
  quoteRequestAck,
  quote,
  quoteAck,
  newOrderSingle,
  newOrderSingleAck,
  execReport1,
  execReport1Ack,
  execReport2,
  execReport2Ack,
  transferFromCustodyB,
];

/* end */
function main() {
  const all = [
    ...commonPart,
    transferAckB,
    transferFromCustodyA,
    transferAckA,
    logout,
  ];

  console.log(JSON.stringify(all, null, 4));
}

if (require.main == module) main();

module.exports = {
  transferParams,
  makeStandardHeader,
  makeStandardTrailer,
  makeAckA,
  makeAckB,
  instrument,
  commonPart,
};
