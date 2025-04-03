const fs = require("fs");
const path = require("path");

const DEPLOYMENT_LOG_FILE = path.resolve(__dirname, "../deployments-base.json");

async function getIndexRegistryAddress(chainId) {
  if (!fs.existsSync(DEPLOYMENT_LOG_FILE)) {
    throw new Error(`Deployments file ${DEPLOYMENT_LOG_FILE} not found`);
  }
  const deployments = JSON.parse(fs.readFileSync(DEPLOYMENT_LOG_FILE, "utf8") || "[]");
  const deployment = deployments.find(
    (d) => d.contractName === "IndexRegistry" && d.chainId === chainId
  );
  if (!deployment) {
    throw new Error(`IndexRegistry not found in ${DEPLOYMENT_LOG_FILE} for chainId ${chainId}`);
  }
  return deployment.address;
}

async function registerIndex(indexRegistry, deployer, txOptions = {}) {
  const IndexDatas = {
    name: "PanteraIndex",
    ticker: "SYPC",
    curatorFee: 1,
  };
  await indexRegistry.write.registerIndex(
    [IndexDatas.name, IndexDatas.ticker, IndexDatas.curatorFee],
    { ...txOptions, account: deployer.account }
  );
  console.log("Index registered:", IndexDatas.name);
}

async function setCuratorWeights(indexRegistry, deployer, txOptions = {}) {
  const curratorWeights = {
    indexId: 1,
    timestamp: 1743465600,
    weights: "",
    price: 10,
  };
  await indexRegistry.write.setCuratorWeights(
    [curratorWeights.indexId, curratorWeights.timestamp, curratorWeights.weights, curratorWeights.price],
    { ...txOptions, account: deployer.account }
  );
  console.log("Curator weights set for index ID:", curratorWeights.indexId);
}

module.exports = { getIndexRegistryAddress, registerIndex, setCuratorWeights };