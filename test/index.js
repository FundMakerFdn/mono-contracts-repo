const { shouldBehaveLikeETFSettlement } = require("./ETFSettlement");

describe("SettleMaker Unit Tests", function () {
  describe("ETFSettlement", async function () {
    shouldBehaveLikeETFSettlement();
  });
});
