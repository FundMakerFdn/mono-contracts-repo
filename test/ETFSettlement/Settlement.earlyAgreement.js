const assert = require('node:assert/strict');
const { loadFixture } = require('@nomicfoundation/hardhat-toolbox-viem/network-helpers');
const { parseEther, keccak256, toHex } = require('viem');
const hre = require('hardhat');
const { MOCK_WETH } = require('./constants');
const { deployFixture } = require('./Settlement.creation');

function shouldExecuteEarlyAgreement() {
    it("should execute early agreement with valid signatures", async function () {
        const { mockSymm, etfSettlement, partyA, partyB } = await loadFixture(deployFixture);

        const partyACollateral = parseEther("100");
        const partyBCollateral = parseEther("50");

        await mockSymm.write.approve([etfSettlement.address, partyACollateral], {
            account: partyA.account,
        });
        await mockSymm.write.approve([etfSettlement.address, partyBCollateral], {
            account: partyB.account,
        });

        const etfParams = {
            priceMint: parseEther("1000"),
            mintTime: BigInt(Math.floor(Date.now() / 1000)),
            etfTokenAmount: parseEther("10"),
            etfToken: MOCK_WETH,
            interestRate: parseEther("0.05"),
            interestRatePayer: partyA.account.address,
        };

        const settlementId = await etfSettlement.write.createETFSettlement(
            [
                partyA.account.address,
                partyB.account.address,
                partyACollateral,
                partyBCollateral,
                mockSymm.address,
                etfParams,
            ],
            {
                account: partyA.account,
            }
        );

        const nonce = await etfSettlement.read.getNonce([partyA.account.address]);
        const partyAAmount = parseEther("120");
        const partyBAmount = parseEther("30");

        const publicClient = await hre.viem.getPublicClient();
        const chainId = await publicClient.getChainId();
        const contractAddress = await etfSettlement.address;

        const domain = {
            name: "ETF Settlement",
            version: "1.0.0",
            chainId: chainId,
            verifyingContract: contractAddress,
        };

        const types = {
            EarlyAgreement: [
                { name: "settlementId", type: "bytes32" },
                { name: "partyAAmount", type: "uint256" },
                { name: "partyBAmount", type: "uint256" },
                { name: "nonce", type: "uint256" },
            ],
        };

        const message = {
            settlementId,
            partyAAmount,
            partyBAmount,
            nonce,
        };

        const partyASignature = await partyA.signTypedData({
            domain,
            types,
            primaryType: "EarlyAgreement",
            message,
        });

        const partyBSignature = await partyB.signTypedData({
            domain,
            types,
            primaryType: "EarlyAgreement",
            message,
        });

        await etfSettlement.write.executeEarlyAgreement(
            [
                settlementId,
                partyAAmount,
                partyBAmount,
                partyASignature,
                partyBSignature,
            ],
            {
                account: partyA.account,
            }
        );

        const settlement = await etfSettlement.read.getSettlementData([settlementId]);
        assert.equal(settlement.state, 1n);
    });
}

module.exports = {
    shouldExecuteEarlyAgreement
};
