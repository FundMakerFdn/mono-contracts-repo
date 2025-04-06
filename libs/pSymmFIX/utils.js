const contractsConfig = require("./contracts.json");

const getContractAddresses = async () => {
  return contractsConfig;
};

module.exports = { getContractAddresses };
