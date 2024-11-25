const hre = require("hardhat");
const config = require("./config");

let miningInterval;

async function mineBlock() {
  try {
    await hre.network.provider.send("evm_mine");
    console.log("Mined 1 block");
  } catch (error) {
    console.error("Mining error:", error);
    stopMining();
    process.exit(1);
  }
}

function stopMining() {
  if (miningInterval) {
    clearInterval(miningInterval);
    miningInterval = null;
  }
}

function startMining() {
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
