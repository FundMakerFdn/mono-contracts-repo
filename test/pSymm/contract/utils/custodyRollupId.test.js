const assert = require("node:assert/strict");
// importing in the same file (for demonstration purposes)
const { getRollupBytes32 } = require('../../../validator/pSymm/lib/custodyRollupId.js');



async function testCustodyRollupId() {
describe("CustodyRollupId", function () {
    it("correctly computes the custody rollup ID", async function () {
        // Example addresses and ID
        const partyA = "0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1";
        const partyB = "0xCfEB869F69431e42cdB54A4F4f105C19C080A601";
        const id = 1;

        const expectedResult = "0x9d7917332163fd30f2d9be4767b2de13ec8658cf94889939c34dd41721118a34"; // Fill in with the expected result
        const computedResult = getRollupBytes32(partyA, partyB, id);
        assert.equal(computedResult, expectedResult, "The computed custody rollup ID does not match the expected result.");
    });

    });
}

module.exports = { testCustodyRollupId };