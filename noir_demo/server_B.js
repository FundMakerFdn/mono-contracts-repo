const WebSocket = require('ws');

let seq = { a: 1, b: 1 };
let storage = {
  messages: [],
  orders: [],
  lastQuote: null
};

const partyClient = "0xPartyA";
const partyBroker = "0xPartyB";
const getDate = () => Date.now() * 1_000_000;

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

const instrument = {
  Symbol: "BTC/USD",
  InstrumentID: "PSYMM0000131104",
  InstrumentType: "PERP",
};

const wss = new WebSocket.Server({ port: 3002 });

wss.on('connection', (ws) => {
  console.log('PartyA connected');

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

  ws.on('message', (data) => {
    const message = JSON.parse(data);
    console.log('Received from PartyA:', message);

    storage.messages = [message, ...storage.messages.slice(0, 1)];

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
        console.log('Received ACK from PartyA');
        break;
    }
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });

  ws.on('close', () => {
    console.log('PartyA disconnected');
  });
});

function handleLogon(ws) {
  console.log('Processing logon request');
  ws.send(JSON.stringify(makeAckB()));
}

function handleQuoteRequest(ws, request) {
  ws.send(JSON.stringify(makeAckB()));

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
    ValidUntilTime: getDate() + 2 * 86400 * 1_000_000_000, // 2 days
    StandardTrailer: makeStandardTrailer(false),
  };

  storage.lastQuote = quote;
  ws.send(JSON.stringify(quote));
}

function handleNewOrder(ws, order) {
  ws.send(JSON.stringify(makeAckB()));

  storage.orders.push(order);

  const halfQty = Math.floor(order.OrderQtyData.OrderQty / 2);
  
  const execReport1 = {
    StandardHeader: makeStandardHeader("8", false),
    OrderID: `ORD${Date.now()}`,
    ClOrdID: order.ClOrdID,
    ExecID: `EXEC${Date.now()}_1`,
    ExecType: "F",
    OrdStatus: "1", // Partially filled
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

  setTimeout(() => {
    const execReport2 = {
      StandardHeader: makeStandardHeader("8", false),
      OrderID: execReport1.OrderID,
      ClOrdID: order.ClOrdID,
      ExecID: `EXEC${Date.now()}_2`,
      ExecType: "F",
      OrdStatus: "2", // Filled
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

// Error handling for the server
wss.on('error', (error) => {
  console.error('WebSocket server error:', error);
});

console.log('PartyB server running on port 3002');