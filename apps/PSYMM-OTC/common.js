const { secp256k1 } = require("@noble/curves/secp256k1");
const { bytesToHex, createPublicClient, http } = require("viem");
const fs = require("fs");
const path = require("path");

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

function getContractAddresses() {
  try {
    // Assuming the contracts.tmp.json is in the project root
    const contractsPath = path.resolve(process.cwd(), "contracts.tmp.json");
    const contractsData = fs.readFileSync(contractsPath, "utf8");
    return JSON.parse(contractsData);
  } catch (error) {
    console.error("Error reading contracts.tmp.json:", error);
    throw new Error("Failed to load contract addresses");
  }
}
async function getGuardianData({
  rpcUrl,
  partyRegistryAddress,
  beforeBlock = "latest",
  fromBlock = 0n,
}) {
  // Create a public client with the provided RPC URL
  const publicClient = createPublicClient({
    transport: http(rpcUrl),
  });

  // Define the ABI for the GuardianDataRegistered event
  const guardianDataEventAbi = {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        name: "ipGuardian",
        type: "string",
      },
      {
        indexed: false,
        name: "ipParty",
        type: "string",
      },
    ],
    name: "GuardianDataRegistered",
    type: "event",
  };

  try {
    // Get logs for the GuardianDataRegistered event
    const logs = await publicClient.getLogs({
      address: partyRegistryAddress,
      event: guardianDataEventAbi,
      fromBlock,
      toBlock: beforeBlock,
    });

    // Process and return the events
    return logs.map((log) => ({
      ipGuardian: log.args.ipGuardian,
      ipParty: log.args.ipParty,
      blockNumber: log.blockNumber,
      transactionHash: log.transactionHash,
    }));
  } catch (error) {
    console.error("Error fetching PartyRegistered events:", error);
    throw new Error("Failed to fetch PartyRegistered events");
  }
}

module.exports = {
  keyFromSeed,
  getContractAddresses,
  getGuardianData,
};
