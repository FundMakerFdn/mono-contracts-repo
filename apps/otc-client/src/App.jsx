import { useState, useEffect } from "react";
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

// async function addHardhatNetwork() {
//   try {
//     await window.ethereum.request({
//       method: "wallet_addEthereumChain",
//       params: [hardhatNetwork],
//     });
//     console.log("Hardhat network added successfully!");
//   } catch (error) {
//     console.error("Failed to add Hardhat network:", error);
//   }
// }

async function switchToHardhat() {
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: "0x7A69" }],
    });
    console.log("Switched to Hardhat network!");
  } catch (error) {
    console.error("Failed to switch network:", error);
    // If the network hasn't been added, you can call addHardhatNetwork() here.
  }
}

function App() {
  const [entries, setEntries] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIP, setSelectedIP] = useState(null);
  const [account, setAccount] = useState("");
  const [client, setClient] = useState(null);

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
        setAccount(address);

        setClient(walletClient);
        const psymm = new pSymmUtils(contracts);

        // Get parties using the utility function
        const parties = await psymm.getParties();
        // Extract IP addresses from parties
        const partyIPs = parties.map((party) => party.ipAddress);
        setEntries(partyIPs);
      } catch (error) {
        console.error("Error fetching parties:", error);
        setEntries([]);
      }
    };

    initializeParties();
  }, []);

  const filteredEntries = entries.filter((entry) =>
    entry.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleConnect = async () => {
    if (!client) return;

    try {
      console.log("Connected to:", selectedIP);
    } catch (error) {
      console.error("Error connecting:", error);
    }
  };

  return (
    <div className="container">
      <div className="wallet-status">
        {account
          ? `Connected wallet: ${account.slice(0, 6)}...${account.slice(-4)}`
          : "Wallet not connected"}
      </div>

      <input
        type="text"
        className="search-input"
        placeholder="Search..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />

      <div className="entries-list">
        {filteredEntries.map((entry, index) => (
          <div
            key={index}
            className={`entry-item ${selectedIP === entry ? "selected" : ""}`}
            onClick={() => setSelectedIP(entry)}
          >
            {entry}
          </div>
        ))}
      </div>

      <button
        className={`connect-button ${selectedIP ? "active" : ""}`}
        onClick={handleConnect}
        disabled={!selectedIP}
      >
        {selectedIP ? `Connect to ${selectedIP}` : "Choose an IP"}
      </button>
    </div>
  );
}

export default App;
