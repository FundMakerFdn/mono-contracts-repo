const assert = require("node:assert/strict");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox-viem/network-helpers");
const { deployFixture } = require("./pSymm.deployment");
const { getRollupBytes32 } = require("./pSymm.collateral");
const { signTypedData } = require('viem/accounts');
const { privateKeyToAccount } = require('viem/accounts');
const hre = require("hardhat");
const { signCreateCustodyRollupParams, signTransferToCustodyRollupParams, signTransferFromCustodyRollupParams } = require('./pSymm.EIP712');

         
async function shouldInitAndTransferRollup() {
    it("should initialize a custody rollup with EIP-712 signature", async function () {
        const { pSymm, partyA, partyB } = await loadFixture(deployFixture);

        const params = {
            partyA: partyA.account.address,
            partyB: partyB.account.address,
            custodyRollupId: 1,
            settlementAddress: "0x0000000000000000000000000000000000000000", // Mock settlement address
            MA: "0x0000000000000000000000000000000000000000000000000000000000000000", // Mock MA as bytes32
            isManaged: false,
            expiration: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
            timestamp: Math.floor(Date.now() / 1000),
            nonce: "0xA000000000000000000000000000000000000000000000000000000000000000" // Mock nonce starting with 0xA
        };

        const signatureA = await signCreateCustodyRollupParams(params, partyA.privateKey, pSymm.address);
        const signatureB = await signCreateCustodyRollupParams(params, partyB.privateKey, pSymm.address);

        params.signatureA = signatureA;
        params.signatureB = signatureB;

        await pSymm.createCustodyRollup(params);

        const custodyRollupId = getRollupBytes32(params.partyA, params.partyB, params.custodyRollupId);
        const custodyRollup = await pSymm.getCustodyRollup(custodyRollupId);

        assert.equal(custodyRollup.partyA, params.partyA, "Custody rollup partyA mismatch");
        assert.equal(custodyRollup.partyB, params.partyB, "Custody rollup partyB mismatch");
    });

    it("should transfer to a custody rollup with EIP-712 signature", async function () {
        const { pSymm, partyA, partyB, mockUSDC } = await loadFixture(deployFixture);

        const params = {
            partyA: partyA.account.address,
            partyB: partyB.account.address,
            custodyRollupId: 1,
            collateralAmount: parseEther("100"),
            collateralToken: mockUSDC.address,
            expiration: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
            timestamp: Math.floor(Date.now() / 1000),
            nonce: "0xA100000000000000000000000000000000000000000000000000000000000000" // Mock nonce starting with 0xA1
        };

        const signatureA = await signTransferToCustodyRollupParams(params, partyA.privateKey, pSymm.address);
        const signatureB = await signTransferToCustodyRollupParams(params, partyB.privateKey, pSymm.address);

        params.signatureA = signatureA;
        params.signatureB = signatureB;

        await pSymm.transferToCustodyRollup(params, 1);

        const custodyRollupId = getRollupBytes32(params.partyA, params.partyB, params.custodyRollupId);
        const balance = await pSymm.getCustodyRollupBalance(custodyRollupId, params.collateralToken);

        assert.equal(balance.toString(), params.collateralAmount.toString(), "Transfer to custody rollup failed");
    });

    it("should transfer from a custody rollup with EIP-712 signature", async function () {
        const { pSymm, partyA, partyB, mockUSDC } = await loadFixture(deployFixture);

        const params = {
            partyA: partyA.account.address,
            partyB: partyB.account.address,
            custodyRollupId: 1,
            collateralAmount: parseEther("100"),
            collateralToken: mockUSDC.address,
            expiration: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
            timestamp: Math.floor(Date.now() / 1000),
            nonce: "0xA200000000000000000000000000000000000000000000000000000000000000" // Mock nonce starting with 0xA2
        };

        const signatureA = await signTransferFromCustodyRollupParams(params, partyA.privateKey, pSymm.address);
        const signatureB = await signTransferFromCustodyRollupParams(params, partyB.privateKey, pSymm.address);

        params.signatureA = signatureA;
        params.signatureB = signatureB;

        const receiverCustodyRollupId = getRollupBytes32(partyB.account.address, partyB.account.address, 2);

        await pSymm.transferFromCustodyRollup(params, receiverCustodyRollupId);

        const balance = await pSymm.getCustodyRollupBalance(receiverCustodyRollupId, params.collateralToken);

        assert.equal(balance.toString(), params.collateralAmount.toString(), "Transfer from custody rollup failed");
    });
}

module.exports = {
    shouldInitAndTransferRollup,
};
