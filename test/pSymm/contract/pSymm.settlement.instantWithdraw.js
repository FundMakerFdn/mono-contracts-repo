const assert = require("node:assert/strict");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox-viem/network-helpers");
const { deployFixture } = require("./pSymm.deployment");
const { signTypedData } = require('viem/accounts');
const { parseEther, keccak256, encodePacked } = require("viem");

async function getDomain(pSymmSettlementAddress) {
    const chainId = 31337;
    return {
        name: 'pSymmSettlement',
        version: '1.0',
        chainId: chainId,
        verifyingContract: pSymmSettlementAddress
    };
}

async function signInstantWithdrawParams(params, privateKey, pSymmSettlementAddress) {
    const domain = await getDomain(pSymmSettlementAddress);

    const types = {
        InstantWithdraw: [
            { name: 'settlementId', type: 'bytes32' },
            { name: 'replacedParty', type: 'address' },
            { name: 'isA', type: 'bool' },
            { name: 'instantWithdrawFee', type: 'uint256' },
            { name: 'instantWithdrawToken', type: 'address' }
        ]
    };

    return await signTypedData({
        domain,
        types,
        primaryType: 'InstantWithdraw',
        value: params,
        privateKey
    });
}

//TODO initaite pSymm custody rollup


async function shouldExecuteInstantWithdraw() {
    it("should execute an instant withdraw with EIP-712 signature", async function () {
        const { pSymmSettlement, pSymm, partyA, partyB, mockUSDC } = await loadFixture(deployFixture);

        // Assume a settlement has been opened
        const custodyRollupId = keccak256(encodePacked(['address', 'address', 'uint256'], [partyA.account.address, partyB.account.address, 1]));
        const merkleRoot = keccak256(encodePacked(['string'], ["merkleRoot"]));
        const settlementId = await pSymmSettlement.write.openSettlement([
            partyA.account.address,
            partyB.account.address,
            custodyRollupId,
            merkleRoot,
            true
        ], {
            account: partyA.account,
        });

        const params = {
            settlementId,
            replacedParty: partyA.account.address,
            isA: true,
            instantWithdrawFee: parseEther("10"),
            instantWithdrawToken: mockUSDC.address
        };

        // Check initial balance of partyA
        const initialBalance = await mockUSDC.read.balanceOf([partyA.account.address]);

        const signature = await signInstantWithdrawParams(params, partyA.privateKey, pSymmSettlement.address);

        await pSymmSettlement.write.executeInstantWithdraw([
            params.settlementId,
            params.replacedParty,
            params.instantWithdrawFee,
            params.instantWithdrawToken,
            params.isA,
            signature
        ], {
            account: partyB.account,
        });

        // Check final balance of partyA
        const finalBalance = await mockUSDC.read.balanceOf([partyA.account.address]);

        // Verify the fee has been deducted
        assert.equal(
            finalBalance,
            initialBalance - params.instantWithdrawFee,
            "Instant withdraw fee was not deducted correctly"
        );

        // Verify the state change or event emission
        const settlementData = await pSymmSettlement.read.getSettlementData([params.settlementId]);
        assert.equal(settlementData.state, 2, "Instant withdraw state not updated");
    });
}

module.exports = {
    shouldExecuteInstantWithdraw,
};