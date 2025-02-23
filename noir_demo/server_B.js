const WebSocket = require("ws");
const fs = require("fs");
const path = require("path");

const { createPublicClient, http, createWalletClient } = require("viem");
const { privateKeyToAccount } = require("viem/accounts");
const { hardhat } = require("viem/chains");

const MockTokenAbi =
	require("./frontend/artifacts/contracts/MockPPM.sol/MockToken.json").abi;
const MockDepositAbi =
	require("./frontend/artifacts/contracts/MockPPM.sol/MockDeposit.json").abi;

const contracts = require("./frontend/src/contracts.json").contract;
console.log("contracts: ", contracts);

const MOCK_TOKEN_ADDRESS = contracts.MockToken;
const MOCK_DEPOSIT_ADDRESS = contracts.MockDeposit;

const STORAGE_PATH = path.join(__dirname, "storage", "storageB.json");

if (!fs.existsSync(path.dirname(STORAGE_PATH))) {
	fs.mkdirSync(path.dirname(STORAGE_PATH), { recursive: true });
}

let seq = { a: 1, b: 1 };
let storage = {
	messages: [],
	orders: [],
	lastQuote: null,
};

try {
	const data = fs.readFileSync(STORAGE_PATH, "utf8");
	if (data) {
		storage = JSON.parse(data);
	}
} catch (error) {
	console.error("Error loading storage:", error);
	fs.writeFileSync(STORAGE_PATH, JSON.stringify(storage, null, 2));
}

const saveStorage = () => {
	try {
		console.log("Storage B: ", storage);
		fs.writeFileSync(STORAGE_PATH, JSON.stringify(storage, null, 2));
	} catch (error) {
		console.error("Error saving storage:", error);
	}
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

async function setupInitialState() {
	try {
		const publicClient = createPublicClient({
			chain: hardhat,
			transport: http(),
		});

		// Use your deployment private key here
		const account = privateKeyToAccount(
			"0xdf57089febbacf7ba0bc227dafbffa9fc08a93fdc68e1e42411a14efcf23656e"
		);
		const walletClient = createWalletClient({
			chain: hardhat,
			transport: http(),
			account,
		});

		// 1. Mint tokens
		const mintTx = await walletClient.writeContract({
			address: MOCK_TOKEN_ADDRESS,
			abi: MockTokenAbi,
			functionName: "mint",
			args: [account.address, depositAmount],
		});
		await publicClient.waitForTransactionReceipt({ hash: mintTx });

		// 2. Approve deposit
		const approveTx = await walletClient.writeContract({
			address: MOCK_TOKEN_ADDRESS,
			abi: MockTokenAbi,
			functionName: "approve",
			args: [MOCK_DEPOSIT_ADDRESS, depositAmount],
		});
		await publicClient.waitForTransactionReceipt({ hash: approveTx });

		// 3. Deposit to custody
		const depositTx = await walletClient.writeContract({
			address: MOCK_DEPOSIT_ADDRESS,
			abi: MockDepositAbi,
			functionName: "deposit",
			args: [depositAmount],
		});
		await publicClient.waitForTransactionReceipt({ hash: depositTx });

		console.log("Initial setup completed successfully");
	} catch (error) {
		console.error("Error in initial setup:", error);
	}
}

setupInitialState().then(() => {
	const wss = new WebSocket.Server({ port: 3002 });
	wss.on("connection", (ws) => {
		console.log("PartyA connected");

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
				},
			],
			StandardTrailer: makeStandardTrailer(false),
		};
		ws.send(JSON.stringify(reportPPM));

		ws.on("message", (data) => {
			const message = JSON.parse(data);
			console.log("Received from PartyA:", message);

			if (Array.isArray(storage.messages)) {
				storage.messages = [message, ...(storage.messages.slice(0, 1) || [])];
			} else {
				storage.messages = [message];
			}

			switch (message.StandardHeader.MsgType) {
				case "A": // Logon
					handleLogon(ws);
					break;

				case "R": // QuoteRequest
					handleQuoteRequest(ws, message);
					break;

				case "D": // NewOrderSingle
					handleNewOrder(ws, message);
					break;

				case "ACK": // Acknowledgment
					console.log("Received ACK from PartyA");
					saveStorage();
					break;
			}
		});

		ws.on("error", (error) => {
			console.error("WebSocket error:", error);
		});

		ws.on("close", () => {
			console.log("PartyA disconnected");
		});
	});

  wss.on("error", (error) => {
    console.error("WebSocket server error:", error);
  });
});

function handleLogon(ws) {
	console.log("Processing logon request");
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
		ValidUntilTime: getDate() + 2 * 86400 * 1_000_000_000,
		StandardTrailer: makeStandardTrailer(false),
	};

	storage.lastQuote = quote;
	saveStorage();
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
		saveStorage();
	}, 2000);
}

console.log("PartyB server running on port 3002");
