import { useState, useEffect } from "react";
import "./App.css";
import contracts from "@fundmaker/pSymmFIX/contracts.json";

function App() {
  const [entries, setEntries] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIP, setSelectedIP] = useState(null);

  useEffect(() => {
    // Mock function to generate IPs
    const mockIPs = Array.from({ length: 6 }, (_, i) => `127.0.0.${i + 1}`);
    setEntries(mockIPs);
    console.log(contracts);
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
