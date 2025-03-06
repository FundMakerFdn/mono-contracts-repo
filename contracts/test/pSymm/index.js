const assert = require("node:assert/strict");
const {
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox-viem/network-helpers");
const {
  keccak256,
  concat,
  toBytes,
  encodeAbiParameters,
} = require("viem");
const fs = require("fs");
const path = require("path");
const os = require("node:os");
const { StandardMerkleTree } = require("@openzeppelin/merkle-tree");
const { deployFixture, convertAddressToX, CHAIN_ID } = require("./deploy");

describe("psymm", function () {
  async function addressToCustody(
    psymm,
    USDC,
    USDE,
    partyA,
    partyB,
    USDC_PRECISION,
    USDE_PRECISION,
    custodyId_A,
    custodyId_B
  ) {
    await USDC.write.approve([psymm.address, 10 * 10 ** USDC_PRECISION], {
      account: partyA.account,
    });
    await USDE.write.approve([psymm.address, 10 * 10 ** USDE_PRECISION], {
      account: partyB.account,
    });

    await psymm.write.addressToCustody(
      [custodyId_A, USDC.address, 10 * 10 ** USDC_PRECISION],
      { account: partyA.account }
    );
    await psymm.write.addressToCustody(
      [custodyId_B, USDE.address, 10 * 10 ** USDE_PRECISION],
      { account: partyB.account }
    );

    assert.equal(
      await psymm.read.getCustodyBalances([custodyId_A, USDC.address]),
      BigInt(10 * 10 ** USDC_PRECISION),
      "USDC balance should be 10"
    );
    assert.equal(
      await psymm.read.getCustodyBalances([custodyId_B, USDE.address]),
      BigInt(10 * 10 ** USDE_PRECISION),
      "USDE balance should be 10"
    );
  }

  async function custodyToAddress(
    psymm,
    USDC,
    partyA,
    partyB,
    custodyId_A,
    USDC_PRECISION
  ) {
    const amount = 5n * 10n ** BigInt(USDC_PRECISION);
    const destination = partyB.account.address;

    const timestamp = BigInt(Math.floor(Date.now() / 1000));
    const pubKey = { parity: 0, x: convertAddressToX(partyA.account.address) };
    const sig = {
      px: keccak256(toBytes("mock-px")),
      e: keccak256(toBytes("mock-e")),
      s: keccak256(toBytes("mock-s")),
    };

    // Construct the leaf exactly as the contract does
    const leafData = encodeAbiParameters(
      [
        { type: "string" },
        { type: "uint256" },
        { type: "address" },
        { type: "uint8" },
        { type: "bytes" },
        { type: "uint8" },
        { type: "bytes32" },
      ],
      [
        "custodyToAddress",
        CHAIN_ID.HARDHAT,
        psymm.address,
        0,
        encodeAbiParameters([{ type: "address" }], [destination]), // Nested encoding for encodedParams
        0,
        pubKey.x,
      ]
    );
    const leaf = keccak256(concat([keccak256(leafData)]));

    // Single-leaf tree: root = leaf, proof = []
    const root = leaf;
    const proof = [];

    // Call custodyToAddress
    await psymm.write.custodyToAddress(
      [
        USDC.address,
        destination,
        amount,
        {
          id: custodyId_A,
          state: 0,
          timestamp: timestamp,
          pubKey: pubKey,
          sig: sig,
          merkleProof: proof,
        },
      ],
      { account: partyA.account }
    );

    const custodyBalanceAfter = await psymm.read.getCustodyBalances([
      custodyId_A,
      USDC.address,
    ]);
    const destinationBalance = await USDC.read.balanceOf([destination]);

    assert.equal(
      custodyBalanceAfter,
      5n * 10n ** BigInt(USDC_PRECISION),
      "Custody balance should be reduced by 5"
    );
    assert.equal(
      destinationBalance,
      amount,
      "Destination should receive 5 USDC"
    );
  }

  it("Should correctly handle pSymm operations", async function () {
    const {
      psymm_partyA,
      psymm_partyB,
      USDC,
      USDE,
      partyA,
      partyB,
      USDC_PRECISION,
      USDE_PRECISION,
      custodyId_A,
      custodyId_B,
    } = await loadFixture(deployFixture);
    await addressToCustody(
      psymm_partyA,
      USDC,
      USDE,
      partyA,
      partyB,
      USDC_PRECISION,
      USDE_PRECISION,
      custodyId_A,
      custodyId_B
    );
    await custodyToAddress(
      psymm_partyA,
      USDC,
      partyA,
      partyB,
      custodyId_A,
      USDC_PRECISION,
      USDE_PRECISION,
      custodyId_A,
      custodyId_B
    );
  });
});
