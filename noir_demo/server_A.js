const express = require('express');
const WebSocket = require('ws');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const STORAGE_PATH = path.join(__dirname, 'storage', 'storageA.json');


if (!fs.existsSync(path.dirname(STORAGE_PATH))) {
  fs.mkdirSync(path.dirname(STORAGE_PATH), { recursive: true })
}

let seq = { a: 1, b: 1 };
let storage = {
  positions: [],
  messages: [],
  balance: '0',
  upnl: '0'
};

const saveStorage = () => {
  try {
    fs.writeFileSync(STORAGE_PATH, JSON.stringify(storage, null, 2));
  } catch (error) {
    console.error('Error saving storage:', error);
  }
};

const resetStorage = () => {
  storage = {
    positions: [],
    messages: [],
    balance: '0',
    upnl: '0'
  };
  saveStorage();
};

resetStorage();

const partyClient = "0xPartyA";
const partyBroker = "0xPartyB";
const getDate = () => Date.now() * 1_000_000;


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
  Signature: "0xSignature",
});

const makeAck = () => ({
  StandardHeader: makeStandardHeader("ACK", true),
  RefMsgSeqNum: seq.b - 1,
  StandardTrailer: makeStandardTrailer(true),
});


const wsClient = new WebSocket('ws://localhost:3002');

wsClient.on('open', () => {
  console.log('Connected to PartyB');

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

  if (Array.isArray(storage.messages)) {
    storage.messages = [message, ...(storage.messages.slice(0, 1) || [])];
  } else {
    storage.messages = [message];
  }

  switch (message.StandardHeader.MsgType) {
    case 'PPM':
      wsClient.send(JSON.stringify(makeAck()));
      break;

    case 'S':
      wsClient.send(JSON.stringify(makeAck()));
      break;

    case '8':
      handleExecutionReport(message);
      wsClient.send(JSON.stringify(makeAck()));
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

  const totalValue = storage.positions.reduce((sum, pos) => {
    const qty = parseFloat(pos.CumQty);
    const price = parseFloat(pos.Price);
    const lastPrice = parseFloat(pos.LastPx);
    const pnl = pos.Side === '1'
      ? (lastPrice - price) * qty
      : (price - lastPrice) * qty;
    return sum + pnl;
  }, 0);

  storage.upnl = totalValue.toFixed(2);
  saveStorage();
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

// app.post('/api/partyA/collateral', (req, res) => {
//   res.json({
//     balance: '0',
//     upnl: storage.upnl
//   });
// });

// Start server
const PORT = 3001;
app.listen(PORT, () => {
  console.log(`PartyA server running on port ${PORT}`);
});