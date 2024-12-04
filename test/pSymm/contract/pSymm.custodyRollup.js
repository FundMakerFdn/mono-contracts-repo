const assert = require("node:assert/strict");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox-viem/network-helpers");
const { deployFixture } = require("./pSymm.deployment");
const { getRollupBytes32 } = require("./pSymm.collateral");
const { signTypedData } = require('viem/accounts');
const { privateKeyToAccount } = require('viem/accounts');
const hre = require("hardhat");
const { signCreateCustodyParams, signTransferToCustodyParams, signTransferFromCustodyParams } = require('./pSymm.EIP712');

         
async function shouldInitAndTransferRollup() {
    it("should initialize a custody rollup with EIP-712 signature", async function () {
        const { pSymm, partyA, partyB } = await loadFixture(deployFixture);

        const params = {
            partyA: partyA.account.address,
            partyB: partyB.account.address,
            custodyId: 1,
            settlementAddress: "0x0000000000000000000000000000000000000000", // Mock settlement address
            MA: "0x0000000000000000000000000000000000000000000000000000000000000000", // Mock MA as bytes32
            isManaged: false,
            expiration: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
            timestamp: Math.floor(Date.now() / 1000),
            nonce: "0xA000000000000000000000000000000000000000000000000000000000000000" // Mock nonce starting with 0xA
        };

        const signatureA = await signCreateCustodyParams(params, partyA.privateKey, pSymm.address);
        const signatureB = await signCreateCustodyParams(params, partyB.privateKey, pSymm.address);

        params.signatureA = signatureA;
        params.signatureB = signatureB;

        await pSymm.CreateCustody(params);

        const custodyId = getRollupBytes32(params.partyA, params.partyB, params.custodyId);
        const custody = await pSymm.getCustody(custodyId);

        assert.equal(custody.partyA, params.partyA, "Custody rollup partyA mismatch");
        assert.equal(custody.partyB, params.partyB, "Custody rollup partyB mismatch");
    });

    it("should transfer to a custody rollup with EIP-712 signature", async function () {
        const { pSymm, partyA, partyB, mockUSDC } = await loadFixture(deployFixture);

        const params = {
            partyA: partyA.account.address,
            partyB: partyB.account.address,
            custodyId: 1,
            collateralAmount: parseEther("100"),
            collateralToken: mockUSDC.address,
            expiration: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
            timestamp: Math.floor(Date.now() / 1000),
            nonce: "0xA100000000000000000000000000000000000000000000000000000000000000" // Mock nonce starting with 0xA1
        };

        const signatureA = await signTransferToCustodyParams(params, partyA.privateKey, pSymm.address);
        const signatureB = await signTransferToCustodyParams(params, partyB.privateKey, pSymm.address);

        params.signatureA = signatureA;
        params.signatureB = signatureB;

        await pSymm.transferToCustody(params, 1);

        const custodyId = getRollupBytes32(params.partyA, params.partyB, params.custodyId);
        const balance = await pSymm.getCustodyBalance(custodyId, params.collateralToken);

        assert.equal(balance.toString(), params.collateralAmount.toString(), "Transfer to custody rollup failed");
    });

    it("should transfer from a custody rollup with EIP-712 signature", async function () {
        const { pSymm, partyA, partyB, mockUSDC } = await loadFixture(deployFixture);

        const params = {
            partyA: partyA.account.address,
            partyB: partyB.account.address,
            custodyId: 1,
            collateralAmount: parseEther("100"),
            collateralToken: mockUSDC.address,
            expiration: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
            timestamp: Math.floor(Date.now() / 1000),
            nonce: "0xA200000000000000000000000000000000000000000000000000000000000000" // Mock nonce starting with 0xA2
        };

        const signatureA = await signTransferFromCustodyParams(params, partyA.privateKey, pSymm.address);
        const signatureB = await signTransferFromCustodyParams(params, partyB.privateKey, pSymm.address);

        params.signatureA = signatureA;
        params.signatureB = signatureB;

        const receiverCustodyId = getRollupBytes32(partyB.account.address, partyB.account.address, 2);

        await pSymm.transferFromCustody(params, receiverCustodyId);

        const balance = await pSymm.getCustodyBalance(receiverCustodyId, params.collateralToken);

        assert.equal(balance.toString(), params.collateralAmount.toString(), "Transfer from custody rollup failed");
    });
}

module.exports = {
    shouldInitAndTransferRollup,
};
