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

  const curratorWeights = [{
    indexId : 1,
    timestamp : 1743465600,
    weights : "",
    price : 10,
    }]

  await indexRegistry.write.registerIndex([IndexDatas.name, IndexDatas.ticker, IndexDatas.curatorFee], {
    account: partyA.account,
  });

  const data1 = await indexRegistry.read.getIndexDatas([1]);

  const i = 0;
  await indexRegistry.write.setCuratorWeights([curratorWeights[i].indexId, curratorWeights[i].timestamp, curratorWeights[i].weights, curratorWeights[i].price], {
    account: partyA.account,
  });
  
  const data2 = await indexRegistry.read.getData([1, 1743465600, partyA.account.address]);



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