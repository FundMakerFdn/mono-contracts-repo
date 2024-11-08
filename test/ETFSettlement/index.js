const { shouldCreateSettlement } = require('./Settlement.creation');
const { shouldExecuteEarlyAgreement } = require('./Settlement.earlyAgreement');
const { shouldMoveToNextBatch } = require('./Settlement.nextBatch');

function shouldBehaveLikeETFSettlement() {
    describe("Settlement Creation", async function () {
        shouldCreateSettlement();
    });

    describe("Early Agreement", async function () {
        shouldExecuteEarlyAgreement();
    });

    describe("Move to Next Batch", async function () {
        shouldMoveToNextBatch();
    });
}

module.exports = {
    shouldBehaveLikeETFSettlement
};
