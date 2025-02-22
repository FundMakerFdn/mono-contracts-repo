const WebSocket = require('ws');

// Sequence counter
let seq = { a: 1, b: 1 };

// Storage
let storage = {
  messages: [],
  orders: [],
  lastQuote: null
};

const partyClient = "0xPartyA";
const partyBroker = "0xPartyB";

const getDate = () => Date.now() * 1_000_000; // nanoseconds

// Helper functions
const makeStandardHeader = (MsgType, isPartyA) => ({
  BeginString: "pSymm.FIX.2.0",
  MsgType,
  DeploymentID: 101,
  SenderCompID: isPartyA ? partyClient : partyBroker,
  TargetCompID: isPartyA ? partyBroker : partyClient,
  MsgSeqNum: isPartyA ? seq.a++ : seq.b++,
  CustodyID: "0xCustody123",
  SendingTime: getDate(),
});

const makeStandardTrailer = (isA) => ({
  PublicKey: isA ? partyClient : partyBroker,
  Signature: "0xSignature", // Mock signature
});

const makeAckB = () => ({
  StandardHeader: makeStandardHeader("ACK", false),
  RefMsgSeqNum: seq.a - 1,
  StandardTrailer: makeStandardTrailer(false),
});

// Mock instrument data
const instrument = {
  Symbol: "BTC/USD",
  InstrumentID: "PSYMM0000131104",
  InstrumentType: "PERP",
};

// WebSocket server
const wss = new WebSocket.Server({ port: 3002 });

wss.on('connection', (ws) => {
  console.log('PartyA connected');

  // Send initial PPM report
  const reportPPM = {
    StandardHeader: makeStandardHeader("PPM", false),
    PPM: [
      {
        chainId: 12,
        pSymm: "0x888",
        party: "pSymm Commission",
        type: "transfer",
        receiver: "0x00",
        allocation: 10000,
      }
    ],
    StandardTrailer: makeStandardTrailer(false),
  };
  ws.send(JSON.stringify(reportPPM));

  // Handle messages from PartyA
  ws.on('message', (data) => {
    const message = JSON.parse(data);
    console.log('Received from PartyA:', message);

    // Store message
    storage.messages = [message, ...storage.messages.slice(0, 1)];

    // Process different message types
    switch (message.StandardHeader.MsgType) {
      case 'A': // Logon
        handleLogon(ws);
        break;
      
      case 'R': // QuoteRequest
        handleQuoteRequest(ws, message);
        break;
      
      case 'D': // NewOrderSingle
        handleNewOrder(ws, message);
        break;
      
      case 'ACK': // Acknowledgment
        // Process ack if needed
        break;
    }
  });
});

function handleLogon(ws) {
  ws.send(JSON.stringify(makeAckB()));
}

function handleQuoteRequest(ws, request) {
  // Send ack first
  ws.send(JSON.stringify(makeAckB()));

  // Generate random quote (mock implementation)
  const basePrice = 50000;
  const randomSpread = Math.random() * 100;
  
  const quote = {
    StandardHeader: makeStandardHeader("S", false),
    QuoteReqID: request.QuoteReqID,
    Instrument: instrument,
    BidPx: (basePrice - randomSpread).toFixed(2),
    OfferPx: (basePrice + randomSpread).toFixed(2),
    BidSize: "100",
    OfferSize: "100",
    ValidUntilTime: getDate() + 2 * 86400 * 1_000_000_000,
    StandardTrailer: makeStandardTrailer(false),
  };

  storage.lastQuote = quote;
  ws.send(JSON.stringify(quote));
}

function handleNewOrder(ws, order) {
  // Send ack first
  ws.send(JSON.stringify(makeAckB()));

  // Store order
  storage.orders.push(order);

  // Mock fill in two parts
  const halfQty = Math.floor(order.OrderQtyData.OrderQty / 2);
  
  // First execution report (partial fill)
  const execReport1 = {
    StandardHeader: makeStandardHeader("8", false),
    OrderID: `ORD${Date.now()}`,
    ClOrdID: order.ClOrdID,
    ExecID: `EXEC${Date.now()}_1`,
    ExecType: "F",
    OrdStatus: "1",
    Instrument: instrument,
    Side: order.Side,
    OrderQtyData: order.OrderQtyData,
    Price: order.Price,
    CumQty: halfQty.toString(),
    LastQty: halfQty.toString(),
    LastPx: order.Price,
    StandardTrailer: makeStandardTrailer(false),
  };

  ws.send(JSON.stringify(execReport1));

  // Second execution report (complete fill) after 2 seconds
  setTimeout(() => {
    const execReport2 = {
      StandardHeader: makeStandardHeader("8", false),
      OrderID: execReport1.OrderID,
      ClOrdID: order.ClOrdID,
      ExecID: `EXEC${Date.now()}_2`,
      ExecType: "F",
      OrdStatus: "2",
      Instrument: instrument,
      Side: order.Side,
      OrderQtyData: order.OrderQtyData,
      Price: order.Price,
      CumQty: order.OrderQtyData.OrderQty,
      LastQty: halfQty.toString(),
      LastPx: order.Price,
      StandardTrailer: makeStandardTrailer(false),
    };

    ws.send(JSON.stringify(execReport2));
  }, 2000);
}

console.log('PartyB server running on port 3002');