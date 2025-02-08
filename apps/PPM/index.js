import { createSchnorrSignature } from "./PPMTree.js";
import { privateKeyToAccount } from "viem/accounts";
import {
  SchnorrParty,
  aggregatePublicKeys,
  aggregateNonces,
  computeChallenge,
  combinePartialSignatures,
  verifySignature,
} from "./schnorr.js";

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

async function main() {
  const v = 3;

  const aggregated = aggregatePublicKeys([partyAPubKey, partyBPubKey]);
  console.log("Aggregated public key:", aggregated.aggregatedKey.toHex());

  const partyA = new SchnorrParty(partyAPubKey, partyAKey, v);
  const partyB = new SchnorrParty(partyBPubKey, partyBKey, v);
  // Set key challenges from aggregation
  partyA.keyChallenge = aggregated.keyChallenges[partyAPubKey];
  partyB.keyChallenge = aggregated.keyChallenges[partyBPubKey];

  const action = {
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
  const message = new TextEncoder().encode(JSON.stringify(action));

  debugger;
  // Broadcast 1: Each party generates and broadcasts its nonce.
  const noncesA = partyA.generateNonces();
  const noncesB = partyB.generateNonces();
  partyA.acceptNonces([noncesA, noncesB], message);
  partyB.acceptNonces([noncesA, noncesB], message);

  // Computation step: Aggregate nonces and compute the challenge.
  const aggregatedNonce = aggregateNonces([noncesA, noncesB], message);
  const challenge = computeChallenge(
    aggregatedNonce,
    aggregated.aggregatedKey,
    message
  );

  // Broadcast 2: Each party computes and broadcasts its partial signature
  const partialSigA = partyA.partiallySign(challenge, message);
  const partialSigB = partyB.partiallySign(challenge, message);

  console.log("Party A partial signature:", partialSigA);
  console.log("Party B partial signature:", partialSigB);

  // Combine partial signatures
  const combinedSignature = combinePartialSignatures([
    partialSigA,
    partialSigB,
  ]);
  console.log("Combined signature:", {
    R: combinedSignature.R.toHex(),
    s: combinedSignature.s.toString(16),
    challenge: combinedSignature.challenge.toString(16),
  });

  // Verify combined signature
  const isValid = verifySignature(
    combinedSignature.R,
    combinedSignature.s,
    combinedSignature.challenge,
    aggregated.aggregatedKey
  );
  console.log("Combined signature valid:", isValid);

  if (isValid) {
    // Convert R.x to 32 bytes
    const rBytes = combinedSignature.R.x.toString(16).padStart(64, "0");
    // Convert s to 32 bytes
    const sBytes = combinedSignature.s.toString(16).padStart(64, "0");
    // Get recovery bit (v) based on R.y being even/odd
    const v = combinedSignature.R.y & 1n ? 28 : 27;

    // Combine v, r, s into 65-byte signature
    const signature = `0x${rBytes}${sBytes}${v.toString(16)}`;
    console.log("65-byte signature:", signature);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
