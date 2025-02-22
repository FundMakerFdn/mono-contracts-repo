const express = require('express');
const WebSocket = require('ws');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Sequence counter
let seq = { a: 1, b: 1 };

// Storage
let storage = {
  positions: [],
  messages: [],
  balance: '1000',
  upnl: '0'
};

const partyClient = "0xPartyA";
const partyBroker = "0xPartyB";

const getDate = () => Date.now() * 1_000_000; // nanoseconds

// Helper functions from the protocol
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

const makeAckA = () => ({
  StandardHeader: makeStandardHeader("ACK", true),
  RefMsgSeqNum: seq.b - 1,
  StandardTrailer: makeStandardTrailer(true),
});

// WebSocket connection to PartyB
const wsClient = new WebSocket('ws://localhost:3002');

wsClient.on('open', () => {
  console.log('Connected to PartyB');
  // Send logon message
  const logon = {
    StandardHeader: makeStandardHeader("A", true),
    HeartBtInt: 10,
    StandardTrailer: makeStandardTrailer(true),
  };
  wsClient.send(JSON.stringify(logon));
});

wsClient.on('message', (data) => {
  const message = JSON.parse(data);
  console.log('Received from PartyB:', message);

  // Store message
  storage.messages = [message, ...storage.messages.slice(0, 1)];

  // Process different message types
  switch (message.StandardHeader.MsgType) {
    case 'PPM':
      // Send ack for PPM report
      wsClient.send(JSON.stringify(makeAckA()));
      break;
    
    case 'S': // Quote
      // Store quote and send ack
      wsClient.send(JSON.stringify(makeAckA()));
      break;
    
    case '8': // ExecutionReport
      // Update positions
      handleExecutionReport(message);
      wsClient.send(JSON.stringify(makeAckA()));
      break;
  }
});

function handleExecutionReport(report) {
  const existingPosition = storage.positions.find(p => p.OrderID === report.OrderID);
  if (existingPosition) {
    storage.positions = storage.positions.map(p =>
      p.OrderID === report.OrderID
        ? { ...p, CumQty: report.CumQty, LastPx: report.LastPx }
        : p
    );
  } else {
    storage.positions.push({
      OrderID: report.OrderID,
      ClOrdID: report.ClOrdID,
      Side: report.Side,
      CumQty: report.CumQty,
      Price: report.Price,
      LastPx: report.LastPx
    });
  }
}

// API Routes
app.post('/api/partyA/buy', (req, res) => {
  const { price, quantity } = req.body;
  
  const newOrderSingle = {
    StandardHeader: makeStandardHeader("D", true),
    ClOrdID: `ORD${Date.now()}`,
    Instrument: {
      Symbol: "BTC/USD",
      InstrumentID: "PSYMM0000131104",
      InstrumentType: "PERP",
    },
    Price: price,
    Side: "1", // Buy
    TransactTime: getDate(),
    OrderQtyData: {
      OrderQty: quantity,
    },
    OrdType: "2", // Limit order
    StandardTrailer: makeStandardTrailer(true),
  };
  
  wsClient.send(JSON.stringify(newOrderSingle));
  res.json({ success: true });
});

app.post('/api/partyA/position', (req, res) => {
  res.json({ positions: storage.positions });
});

app.post('/api/partyA/collateral', (req, res) => {
  res.json({
    balance: storage.balance,
    upnl: storage.upnl
  });
});

// Start server
const PORT = 3001;
app.listen(PORT, () => {
  console.log(`PartyA server running on port ${PORT}`);
});