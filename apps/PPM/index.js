import { createSchnorrSignature } from "./PPMTree.js";
import { privateKeyToAccount } from "viem/accounts";
import { aggregatePublicKeys } from "./schnorr.js";

async function main() {
  // Example private keys (in production these would be securely managed)
  const partyAKey = BigInt(
    "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"
  );
  const partyBKey = BigInt(
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
  );

  // Get public keys using viem
  const partyAPubKey = privateKeyToAccount(
    `0x${partyAKey.toString(16)}`
  ).publicKey;
  const partyBPubKey = privateKeyToAccount(
    `0x${partyBKey.toString(16)}`
  ).publicKey;

  // Aggregate public keys
  const aggregatedPubKey = aggregatePublicKeys([partyAPubKey, partyBPubKey]);
  console.log("Aggregated public key:", aggregatedPubKey.toHex());

  // Create action data
  const action1 = {
    index: 1,
    type: "transfer",
    chainId: 12,
    pSymm: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
    party: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    args: {
      receiver: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
      amount: 1000000,
    },
  };

  // Sign action1 using Schnorr
  const sigA1 = createSchnorrSignature(action1, partyAKey);
  const sigB1 = createSchnorrSignature(action1, partyBKey);

  console.log("Action 1 signatures:");
  console.log("Party A signature:", sigA1);
  console.log("Party B signature:", sigB1);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
