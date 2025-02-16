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
        name: 'Custody',
        version: '1.0',
        chainId: chainId,
        verifyingContract: pSymmAddress
    };
}

async function signCreateCustodyParams(params, privateKey, pSymmAddress, custodyId) {
    const domain = await getDomain(pSymmAddress);

    const types = {
        EIP712Domain: [
            { name: 'name', type: 'string' },
            { name: 'version', type: 'string' },
            { name: 'chainId', type: 'uint256' },
            { name: 'verifyingContract', type: 'address' }
        ],
        createCustodyParams: [
            { name: 'partyA', type: 'address' },
            { name: 'partyB', type: 'address' },
            { name: 'custodyId', type: 'uint256' },
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
        primaryType: 'createCustodyParams',
        value: params,
        privateKey
    });
}

async function signTransferToCustodyParams(params, privateKey, pSymmAddress, custodyId) {
    console.log("Params being signed:", params);

    const value = {
        partyA: params.partyA,
        partyB: params.partyB,
        custodyId: custodyId,
        collateralAmount: BigInt(params.collateralAmount),
        collateralToken: params.collateralToken,
        expiration: BigInt(params.expiration),
        timestamp: BigInt(params.timestamp),
        nonce: params.nonce
    };

    const domain = await getDomain(pSymmAddress);

    const types = {
        transferToCustodyParams: [
            { name: 'partyA', type: 'address' },
            { name: 'partyB', type: 'address' },
            { name: 'custodyId', type: 'uint256' },
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
        primaryType: 'transferToCustodyParams',
        value,
        privateKey
    });
}

async function signTransferFromCustodyParams(params, privateKey, pSymmAddress, custodyId) {
    const domain = await getDomain(pSymmAddress);

    const types = {
        transferFromCustodyParams: [
            { name: 'partyA', type: 'address' },
            { name: 'partyB', type: 'address' },
            { name: 'custodyId', type: 'uint256' },
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
    signCreateCustodyParams,
    signTransferToCustodyParams,
    signTransferFromCustodyParams
};