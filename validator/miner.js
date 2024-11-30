const hre = require("hardhat");
const config = require("#root/validator/config.js");

let miningInterval;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 0; // ms

async function testConnection() {
  try {
    await hre.network.provider.send("eth_blockNumber");
    return true;
  } catch {
    return false;
  }
}

async function mineBlock() {
  try {
    await hre.network.provider.send("evm_mine");
    console.log("Mined 1 block");
    reconnectAttempts = 0; // Reset reconnect attempts on successful mine
  } catch (error) {
    console.error("Mining error:", error);

    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      reconnectAttempts++;
      console.log(
        `Reconnection attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} in ${
          RECONNECT_DELAY / 1000
        } seconds...`
      );

      // Pause mining
      stopMining();

      // Try to reconnect after delay
      setTimeout(async () => {
        if (await testConnection()) {
          console.log("Reconnected successfully");
          startMining();
        } else {
          console.error("Reconnection failed");
          if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
            console.error("Max reconnection attempts reached. Exiting...");
            process.exit(1);
          }
          // Try mining again which will trigger another reconnection attempt if needed
          mineBlock();
        }
      }, RECONNECT_DELAY);
    } else {
      console.error("Max reconnection attempts reached. Exiting...");
      process.exit(1);
    }
  }
}

function stopMining() {
  if (miningInterval) {
    clearInterval(miningInterval);
    miningInterval = null;
  }
}

function startMining() {
  if (miningInterval) {
    stopMining(); // Clear any existing interval
  }

  console.log("Starting block mining...");
  console.log(`Mining interval: ${config.mineInterval} seconds`);

  mineBlock(); // Mine first block immediately
  miningInterval = setInterval(mineBlock, config.mineInterval * 1000);
}

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("\nStopping miner...");
  stopMining();
  process.exit();
});

// Start mining if this script is run directly
if (require.main === module) {
  startMining();
}

module.exports = { startMining, stopMining };
