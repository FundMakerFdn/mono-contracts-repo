const assert = require("node:assert/strict");
const hre = require("hardhat");

async function deployFixture() {

  const [deployer, partyA, partyB] = await hre.viem.getWalletClients();

  const indexRegistry = await hre.viem.deployContract("IndexRegistry");

  const IndexDatas = {
    name: "PanteraIndex",
    ticker: "SYPC",
    curatorFee: 1,
    }
  const partyAData = {
    role: "Trader",
    ipAddress: "127.0.0.2",
    partyType: 1,
  };

  await indexRegistry.write.registerIndex([IndexDatas.name, IndexDatas.ticker, IndexDatas.curatorFee], {
    account: partyA.account,
  });

  return {
    indexRegistry,
    deployer,
    partyA,
    partyB,
  };
}

module.exports = {
  deployFixture,
};

async function main() {
  const contracts = await deployFixture();

  // Prepare data for output
  const outputData = {
    indexRegistry: contracts.indexRegistry.address,
    deployer: contracts.deployer.account.address,
    partyA: contracts.partyA.account.address,
    partyB: contracts.partyB.account.address,
  };

  // Write to file
  const fs = require("fs");
  fs.writeFileSync("./contracts.tmp.json", JSON.stringify(outputData, null, 2));

  console.log("Contract data written to ./contracts.tmp.json");
  return contracts;
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}