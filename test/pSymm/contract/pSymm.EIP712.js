const assert = require("node:assert/strict");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox-viem/network-helpers");
const { deployFixture } = require("./pSymm.deployment");
const { getRollupBytes32 } = require("./pSymm.collateral");
const { signTypedData } = require('viem/accounts');
const { privateKeyToAccount } = require('viem/accounts');
const hre = require("hardhat");

async function getDomain(pSymmAddress) {
    const chainId = 31337;
    return {
        name: 'CustodyRollup',
        version: '1.0',
        chainId: chainId,
        verifyingContract: pSymmAddress
    };
}

async function signCreateCustodyRollupParams(params, privateKey, pSymmAddress) {
    const domain = await getDomain(pSymmAddress);

    const types = {
        EIP712Domain: [
            { name: 'name', type: 'string' },
            { name: 'version', type: 'string' },
            { name: 'chainId', type: 'uint256' },
            { name: 'verifyingContract', type: 'address' }
        ],
        createCustodyRollupParams: [
            { name: 'partyA', type: 'address' },
            { name: 'partyB', type: 'address' },
            { name: 'custodyRollupId', type: 'uint256' },
            { name: 'settlementAddress', type: 'address' },
            { name: 'MA', type: 'bytes32' },
            { name: 'isManaged', type: 'bool' },
            { name: 'expiration', type: 'uint256' },
            { name: 'timestamp', type: 'uint256' },
            { name: 'nonce', type: 'bytes32' }
        ]
    };

    return await signTypedData({
        domain,
        types,
        primaryType: 'createCustodyRollupParams',
        value: params,
        privateKey
    });
}

async function signTransferToCustodyRollupParams(params, privateKey, pSymmAddress) {
    console.log("Params being signed:", params);

    // More robust validation
    if (!params) {
        throw new Error("Params object is undefined");
    }

    // Convert custodyRollupId to a number if it's a hex string
    const custodyRollupId = params.custodyRollupId.startsWith('0x') 
        ? BigInt(params.custodyRollupId).toString() 
        : params.custodyRollupId;

    const value = {
        partyA: params.partyA,
        partyB: params.partyB,
        custodyRollupId: custodyRollupId,
        collateralAmount: BigInt(params.collateralAmount),
        collateralToken: params.collateralToken,
        expiration: BigInt(params.expiration),
        timestamp: BigInt(params.timestamp),
        nonce: params.nonce
    };

    const domain = await getDomain(pSymmAddress);

    const types = {
        transferToCustodyRollupParams: [
            { name: 'partyA', type: 'address' },
            { name: 'partyB', type: 'address' },
            { name: 'custodyRollupId', type: 'uint256' },
            { name: 'collateralAmount', type: 'uint256' },
            { name: 'collateralToken', type: 'address' },
            { name: 'expiration', type: 'uint256' },
            { name: 'timestamp', type: 'uint256' },
            { name: 'nonce', type: 'bytes32' }
        ]
    };

    return await signTypedData({
        domain,
        types,
        primaryType: 'transferToCustodyRollupParams',
        value,
        privateKey
    });
}

async function signTransferFromCustodyRollupParams(params, privateKey, pSymmAddress) {
    const domain = await getDomain(pSymmAddress);

    const types = {
        transferFromCustodyRollupParams: [
            { name: 'partyA', type: 'address' },
            { name: 'partyB', type: 'address' },
            { name: 'custodyRollupId', type: 'uint256' },
            { name: 'collateralAmount', type: 'uint256' },
            { name: 'collateralToken', type: 'address' },
            { name: 'expiration', type: 'uint256' },
            { name: 'timestamp', type: 'uint256' },
            { name: 'nonce', type: 'bytes32' }
        ]
    };

    return await signTypedData({
        domain,
        types,
        value: params,
        privateKey
    });
}

module.exports = {
    signCreateCustodyRollupParams,
    signTransferToCustodyRollupParams,
    signTransferFromCustodyRollupParams
};