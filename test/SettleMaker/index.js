const { shouldDeploySettleMaker } = require('./SettleMaker.deployment');

function shouldBehaveLikeSettleMaker() {
  describe("Deployment", async function() {
    shouldDeploySettleMaker();
  });
}

module.exports = {
  shouldBehaveLikeSettleMaker
};
