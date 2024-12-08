const Database = require("better-sqlite3");
const crypto = require("crypto");
const fs = require("fs");

class MockStorage {
  static async getDeploymentData(configPath) {
    try {
      // Read deployment data from temp file
      const tempData = JSON.parse(fs.readFileSync(configPath));
      const dataHash = tempData.dataHash;
      
      // Create temporary storage instance to fetch data
      const storage = new MockStorage();
      const deploymentData = storage.get(dataHash);
      storage.close();
      
      if (!deploymentData || !deploymentData.data) {
        throw new Error("Could not find deployment data for hash: " + dataHash);
      }
      
      return {
        dataHash,
        data: deploymentData.data
      };
    } catch (err) {
      throw new Error(`Error getting deployment data: ${err.message}`);
    }
  }
  constructor(dbPath = "mock.db") {
    this.db = new Database(dbPath);

    // Create table if it doesn't exist
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS storage_data (
        hash TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        timestamp INTEGER NOT NULL
      )
    `);

    // Prepare statements
    this.insertStmt = this.db.prepare(
      "INSERT OR REPLACE INTO storage_data (hash, data, timestamp) VALUES (?, ?, ?)"
    );
    this.getStmt = this.db.prepare(
      "SELECT data, timestamp FROM storage_data WHERE hash = ?"
    );
  }

  // Store data and return its hash
  store(data) {
    const hash = crypto
      .createHash("sha256")
      .update(JSON.stringify(data))
      .digest("hex");

    this.insertStmt.run(hash, JSON.stringify(data), Date.now());
    return hash;
  }

  // Get data by hash
  get(hash) {
    const row = this.getStmt.get(hash);
    if (!row) return null;

    return {
      data: JSON.parse(row.data),
      timestamp: row.timestamp,
    };
  }

  // Close database connection
  close() {
    this.db.close();
  }
}

module.exports = MockStorage;
