import { secp256k1 } from "@noble/curves/secp256k1";
import { bytesToHex, createPublicClient, http } from "viem";
import fs from "fs";
import path from "path";

/**
 * Generate a deterministic Schnorr key pair from a numeric seed
 * @param {number} seed - Numeric seed to derive the key pair (e.g., 0, 1, 2)
 * @returns {Object} Object containing public and private keys
 */
function keyFromSeed(seed) {
  // Create a deterministic but random-looking 32-byte array from the seed
  const privateKeyBytes = new Uint8Array(32);

  // Use a simple PRNG algorithm with the seed
  let state = BigInt(seed) + 1n; // Add 1 to avoid seed=0 generating all zeros

  for (let i = 0; i < 32; i++) {
    // Simple LCG (Linear Congruential Generator)
    // Using parameters from Numerical Recipes
    state = (1664525n * state + 1013904223n) % 2n ** 32n;
    privateKeyBytes[i] = Number(state % 256n);
  }

  // Ensure the private key is valid for secp256k1 (between 1 and curve order - 1)
  const privateKeyBigInt =
    secp256k1.utils.normPrivateKeyToScalar(privateKeyBytes);

  // Convert to hex string
  const privateKey = bytesToHex(privateKeyBytes);

  // Derive the public key
  const publicKeyPoint = secp256k1.ProjectivePoint.BASE.multiply(
    BigInt(privateKey)
  );
  const publicKey = bytesToHex(publicKeyPoint.toRawBytes(true));

  return {
    pubKey: publicKey,
    privKey: privateKey.toString(),
  };
}

async function getGuardianData({
  rpcUrl,
  partyRegistryAddress,
  myGuardianPubKeys,
  beforeBlock = "latest",
  fromBlock = 0n,
}) {
  const publicClient = createPublicClient({
    transport: http(rpcUrl),
  });

  // Updated event ABI to include pubKey
  const partyRegisteredEventAbi = {
    anonymous: false,
    inputs: [
      { indexed: false, name: "role", type: "string" },
      { indexed: true, name: "party", type: "address" },
      { indexed: false, name: "ipAddress", type: "string" },
      {
        indexed: false,
        name: "pubKey",
        type: "tuple",
        components: [
          { name: "parity", type: "uint8" },
          { name: "x", type: "bytes32" },
        ],
      },
    ],
    name: "PartyRegistered",
    type: "event",
  };

  try {
    const logs = await publicClient.getLogs({
      address: partyRegistryAddress,
      event: partyRegisteredEventAbi,
      fromBlock,
      toBlock: beforeBlock,
    });

    // Filter only guardian entries matching our pubkeys
    return logs
      .filter(
        (log) =>
          log.args.role === "Guardian" &&
          myGuardianPubKeys.some(
            (key) => key === convertPubKey(log.args.pubKey)
          )
      )
      .map((log) => ({
        ipAddress: log.args.ipAddress,
        pubKey: log.args.pubKey,
        blockNumber: log.blockNumber,
        transactionHash: log.transactionHash,
      }));
  } catch (error) {
    console.error("Error fetching PartyRegistered events:", error);
    throw new Error("Failed to fetch PartyRegistered events");
  }
}

function convertPubKey(pubKey) {
  // Convert parity from 27/28 to 2/3 for compressed format
  const prefix = (pubKey.parity - 27 + 2).toString(16).padStart(2, "0");
  // Remove 0x prefix from x coordinate if present
  const x = pubKey.x.startsWith("0x") ? pubKey.x.slice(2) : pubKey.x;
  // Combine prefix and x coordinate
  return "0x" + prefix + x;
}

export {
  keyFromSeed,
  getGuardianData,
  convertPubKey,
};
