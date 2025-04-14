import { useEffect, useReducer } from "react";
import PartyTable from "./components/PartyTable";
import { formatPublicKey, shortenText } from "./utils";
import { createWalletClient, custom } from "viem";
import { hardhat } from "viem/chains";
import "./App.css";
import contracts from "@fundmaker/pSymmFIX/contracts";
import { pSymmUtils } from "@fundmaker/pSymmFIX";

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
    default:
      return state;
  }
}

function App() {
  const [state, dispatch] = useReducer(reducer, initialState);

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
        const solverParties = parties.filter(party => party.role === "Solver");
        dispatch({ type: "SET_PARTIES", parties: solverParties });
      } catch (error) {
        console.error("Error fetching parties:", error);
        setEntries([]);
      }
    };

    initializeParties();
  }, []);

  return (
    <div className="container">
      <div className="wallet-status">
        {state.account
          ? `Connected wallet: ${state.account}`
          : "Wallet not connected"}
      </div>

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

      {state.selectedCounterparty && (
        <div className="selected-party-info">
          <div>
            <h3>Selected Counterparty</h3>
            <p>IP Address: {state.selectedCounterparty.ipAddress}</p>
            <p>
              Public Key: {formatPublicKey(state.selectedCounterparty.pubKey)}
            </p>
            <p>Address: {state.selectedCounterparty.address}</p>
          </div>
          <div className="ready-status">Ready to connect!</div>
        </div>
      )}
    </div>
  );
}

export default App;
