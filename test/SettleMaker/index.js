const { shouldManageValidators } = require('./SettleMaker.validators');

function shouldBehaveLikeSettleMaker() {
    describe("Validator Registry", async function () {
        shouldManageValidators();
    });
}

module.exports = {
    shouldBehaveLikeSettleMaker
};
