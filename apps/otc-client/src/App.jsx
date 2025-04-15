import { useEffect, useReducer, useRef } from "react";
import PartyTable from "./components/PartyTable";
import { formatPublicKey, shortenText } from "./utils";
import { createWalletClient, custom } from "viem";
import { hardhat } from "viem/chains";
import "./App.css";
import contracts from "@fundmaker/pSymmFIX/contracts";
import { pSymmUtils, MsgBuilder } from "@fundmaker/pSymmFIX";

const hardhatNetwork = {
  chainId: "0x7A69", // 31337 in hexadecimal
  chainName: "Hardhat Local",
  rpcUrls: ["http://localhost:8545"],
  nativeCurrency: {
    name: "Ether",
    symbol: "ETH",
    decimals: 18,
  },
  blockExplorerUrls: [],
};

async function addHardhatNetwork() {
  try {
    await window.ethereum.request({
      method: "wallet_addEthereumChain",
      params: [hardhatNetwork],
    });
    console.log("Hardhat network added successfully!");
  } catch (error) {
    console.error("Failed to add Hardhat network:", error);
  }
}

async function switchToHardhat() {
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: "0x7A69" }],
    });
    console.log("Switched to Hardhat network!");
  } catch (error) {
    console.error("Failed to switch network:", error);
    addHardhatNetwork();
    switchToHardhat();
  }
}

const initialState = {
  counterparties: [],
  selectedCounterparty: null,
  account: "",
  client: null,
  websocket: null,
  wsStatus: "disconnected", // disconnected, connecting, connected, error
  connectionState: "idle", // idle, awaiting PPM template
  logs: [],
};

function reducer(state, action) {
  switch (action.type) {
    case "SET_PARTIES":
      return {
        ...state,
        counterparties: action.parties,
      };
    case "SET_SELECTED_COUNTERPARTY":
      return {
        ...state,
        selectedCounterparty: action.party,
      };
    case "SET_ACCOUNT":
      return {
        ...state,
        account: action.account,
      };
    case "SET_CLIENT":
      return {
        ...state,
        client: action.client,
      };
    case "SET_WEBSOCKET":
      return {
        ...state,
        websocket: action.websocket,
        wsStatus: action.status || state.wsStatus,
      };
    case "SET_WS_STATUS":
      return {
        ...state,
        wsStatus: action.status,
      };
    case "SET_CONNECTION_STATE":
      return {
        ...state,
        connectionState: action.state,
      };
    case "ADD_LOG":
      return {
        ...state,
        logs: [...state.logs, action.log],
      };
    default:
      return state;
  }
}

function App() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const logContainerRef = useRef(null);

  useEffect(() => {
    const initializeParties = async () => {
      try {
        // Check if MetaMask is installed
        if (!window.ethereum) {
          alert("Please install MetaMask!");
          return;
        }

        await switchToHardhat();

        // Create wallet client
        const walletClient = createWalletClient({
          chain: hardhat,
          transport: custom(window.ethereum),
        });
        const [address] = await walletClient.requestAddresses();
        dispatch({ type: "SET_ACCOUNT", account: address });
        dispatch({ type: "SET_CLIENT", client: walletClient });
        const psymm = new pSymmUtils(contracts);

        // Get parties using the utility function and filter for Solvers
        const parties = await psymm.getParties();
        const solverParties = parties.filter(
          (party) => party.role === "Solver"
        );
        dispatch({ type: "SET_PARTIES", parties: solverParties });
      } catch (error) {
        console.error("Error fetching parties:", error);
        setEntries([]);
      }
    };

    initializeParties();
  }, []);

  const addLog = (message) => {
    dispatch({
      type: "ADD_LOG",
      log: `[${new Date().toLocaleTimeString()}] ${message}`,
    });
  };

  const connectToWebSocket = (ipAddress) => {
    dispatch({ type: "SET_WS_STATUS", status: "connecting" });
    addLog(`Attempting to connect to ${ipAddress}:8080`);
    const ws = new WebSocket(`ws://${ipAddress}:8080`);

    ws.onopen = () => {
      dispatch({ type: "SET_WEBSOCKET", websocket: ws, status: "connected" });
      addLog(`Connection established to ${ipAddress}:8080`);
      const msgBuilder = new MsgBuilder({
        senderCompID: state.account,
        custodyID: "CUSTODY_ID",
      });
      const ppmhMessage = msgBuilder.createPPMHandshake("COUNTERPARTY_ID");
      const messageStr = JSON.stringify(ppmhMessage);
      ws.send(messageStr);
      addLog(`Sent PPMH message: ${messageStr}`);
      dispatch({ type: "SET_CONNECTION_STATE", state: "awaiting PPM template" });
    };

    ws.onmessage = (event) => {
      addLog(`Received message: ${event.data}`);
      try {
        const message = JSON.parse(event.data);
        if (message.StandardHeader && message.StandardHeader.MsgType === "PPMT") {
          addLog(`Received PPM Template: ${JSON.stringify(message.PPMT, null, 2)}`);
          dispatch({ type: "SET_CONNECTION_STATE", state: "idle" });
        }
      } catch (error) {
        addLog(`Error parsing message: ${error.message}`);
      }
    };

    ws.onerror = (error) => {
      dispatch({ type: "SET_WS_STATUS", status: "error" });
      addLog(`WebSocket error: ${error.message || "Unknown error"}`);
    };

    ws.onclose = () => {
      dispatch({ type: "SET_WS_STATUS", status: "disconnected" });
      dispatch({ type: "SET_CONNECTION_STATE", state: "idle" });
      addLog(`Connection closed`);
    };
  };

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [state.logs]);

  return (
    <div className="container">
      <div className="wallet-status">
        {state.account
          ? `Connected wallet: ${state.account}`
          : "Wallet not connected"}
      </div>

      {state.wsStatus === "disconnected" || state.wsStatus === "error" ? (
        <>
          <div className="tables-container">
            <PartyTable
              data={state.counterparties}
              title="Counterparties"
              selectedParty={state.selectedCounterparty}
              onSelectParty={(party) =>
                dispatch({ type: "SET_SELECTED_COUNTERPARTY", party })
              }
            />
          </div>

          {state.selectedCounterparty && state.wsStatus !== "connecting" && (
            <div className="selected-party-info">
              <div>
                <h3>Selected Counterparty</h3>
                <p>IP Address: {state.selectedCounterparty.ipAddress}</p>
                <p>
                  Public Key:{" "}
                  {formatPublicKey(state.selectedCounterparty.pubKey)}
                </p>
                <p>Address: {state.selectedCounterparty.address}</p>
              </div>
              <button
                onClick={() =>
                  connectToWebSocket(state.selectedCounterparty.ipAddress)
                }
                className="ready-status"
              >
                Connect to {state.selectedCounterparty.ipAddress}
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="selected-party-info">
          <h3>WebSocket Connection Status</h3>
          <p>
            Status:{" "}
            {state.wsStatus === "connecting" ? "Connecting..." : "Connected"}
          </p>
          <p>Connection State: {state.connectionState}</p>
          {state.wsStatus === "error" && (
            <p>Error occurred. Please try again.</p>
          )}
        </div>
      )}
      <div
        className="log-container"
        style={{
          marginTop: "2rem",
          backgroundColor: "#f5f5f5",
          padding: "1rem",
          borderRadius: "4px",
          maxHeight: "200px",
          overflowY: "auto",
        }}
        ref={logContainerRef}
      >
        <h3>Connection Log</h3>
        <pre style={{ fontFamily: "monospace", margin: 0 }}>
          {state.logs.map((log, index) => (
            <div key={index}>{log}</div>
          ))}
        </pre>
      </div>
    </div>
  );
}

export default App;
