const { shouldDeploySettleMaker } = require("./SettleMaker/SettleMaker.deployment");
const { shouldDeployPSymm } = require("./pSymm/contract/pSymm.deployment");

describe("Deployment Tests", function () {
  describe("SettleMaker Deployment Tests", shouldDeploySettleMaker);
  describe("pSymm Deployment Tests", shouldDeployPSymm);
});

module.exports = function () {
  describe("SettleMaker Deployment Tests", shouldDeploySettleMaker);
  describe("pSymm Deployment Tests", shouldDeployPSymm);
};
