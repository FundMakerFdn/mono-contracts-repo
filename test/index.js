const { shouldBehaveLikeETFSettlement } = require("./ETFMaker");
const { shouldBehaveLikeSettleMaker } = require("./SettleMaker");

describe("SettleMaker Unit Tests", function () {
  /*
  describe("ETFSettlement", async function () {
    shouldBehaveLikeETFSettlement();
  });
*/
  describe("SettleMaker", async function () {
    shouldBehaveLikeSettleMaker();
  });
});
