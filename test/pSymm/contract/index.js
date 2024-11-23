const { shouldDeploypSymm } = require('./pSymm.deployment');

function shouldBehaveLikepSymm() {
  describe("Deployment", async function() {
    shouldDeploypSymm();
  });
}

module.exports = {
  shouldBehaveLikepSymm
};
