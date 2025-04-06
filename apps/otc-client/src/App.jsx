import { useState, useEffect } from "react";
import { createWalletClient, custom } from "viem";
import { hardhat } from "viem/chains";
import "./App.css";
import contracts from "@fundmaker/pSymmFIX/contracts.json";
import { getParties } from "@fundmaker/pSymmFIX";

function App() {
  const [entries, setEntries] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIP, setSelectedIP] = useState(null);

  useEffect(() => {
    console.log(contracts);
    const initializeParties = async () => {
      // Create wallet client
      const client = createWalletClient({
        chain: hardhat,
        transport: custom(window.ethereum),
      });

      try {
        // Get parties using the utility function
        const parties = await getParties(client);
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

  const handleConnect = () => {
    console.log("Connecting...");
  };

  return (
    <div className="container">
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
      >
        {selectedIP ? `Connect to ${selectedIP}` : "Choose"}
      </button>
    </div>
  );
}

export default App;
