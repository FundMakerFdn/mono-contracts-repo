
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

async function signEarlyAgreementParams(params, privateKey, pSymmSettlementAddress) {
    const domain = await getDomain(pSymmSettlementAddress);

    const types = {
        EarlyAgreement: [
            { name: 'settlementId', type: 'bytes32' },
            { name: 'custodyTarget', type: 'bytes32' },
            { name: 'custodyReceiver', type: 'bytes32' },
            { name: 'collateralToken', type: 'address' },
            { name: 'collateralAmount', type: 'uint256' },
            { name: 'expiration', type: 'uint256' },
            { name: 'nonce', type: 'bytes32' }
        ]
    };

    return await signTypedData({
        domain,
        types,
        primaryType: 'EarlyAgreement',
        value: params,
        privateKey
    });
}

//TODO initaite pSymm custody rollup

async function shouldExecuteEarlyAgreement() {
    it("should execute an early agreement with EIP-712 signature", async function () {
        const { pSymmSettlement, pSymm, partyA, partyB, mockUSDC } = await loadFixture(deployFixture);

        // Assume a settlement has been opened
        const custodyId = keccak256(encodePacked(['address', 'address', 'uint256'], [partyA.account.address, partyB.account.address, 1]));
        const merkleRoot = keccak256(encodePacked(['string'], ["merkleRoot"]));
        const settlementId = await pSymmSettlement.write.openSettlement([
            partyA.account.address,
            partyB.account.address,
            custodyId,
            merkleRoot,
            true
        ], {
            account: partyA.account,
        });

        const params = {
            settlementId,
            custodyTarget: custodyId,
            custodyReceiver: custodyId, // Assuming same for simplicity
            collateralToken: mockUSDC.address,
            collateralAmount: parseEther("100"),
            expiration: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
            nonce: "0xA300000000000000000000000000000000000000000000000000000000000000" // Mock nonce starting with 0xA3
        };

        const signatureA = await signEarlyAgreementParams(params, partyA.privateKey, pSymmSettlement.address);
        const signatureB = await signEarlyAgreementParams(params, partyB.privateKey, pSymmSettlement.address);

        params.signatureA = signatureA;
        params.signatureB = signatureB;

        await pSymmSettlement.write.executeEarlyAgreement([
            params.settlementId,
            params.custodyTarget,
            params.custodyReceiver,
            params.collateralToken,
            params.collateralAmount,
            params.expiration,
            params.nonce,
            params.signatureA
        ], {
            account: partyB.account,
        });

        // Verify the state change or event emission
        const settlementData = await pSymmSettlement.read.getSettlementData([params.settlementId]);
        assert.equal(settlementData.state, 1, "Early agreement state not updated");
    });
}

module.exports = {
    shouldExecuteEarlyAgreement,
};