const Database = require("better-sqlite3");
const crypto = require("crypto");

class MockArweave {
  constructor(dbPath = "mock.db") {
    this.db = new Database(dbPath);

    // Create table if it doesn't exist
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS arweave_data (
        hash TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        timestamp INTEGER NOT NULL
      )
    `);

    // Prepare statements
    this.insertStmt = this.db.prepare(
      "INSERT OR REPLACE INTO arweave_data (hash, data, timestamp) VALUES (?, ?, ?)"
    );
    this.getStmt = this.db.prepare(
      "SELECT data, timestamp FROM arweave_data WHERE hash = ?"
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

module.exports = MockArweave;
