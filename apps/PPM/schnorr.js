import { secp256k1 } from "@noble/curves/secp256k1";
import { bytesToHex, concatBytes } from "@noble/curves/abstract/utils";
import { keccak256, hexToBytes } from "viem";

// Sign a message using Schnorr signature
export function sign(msg, privateKey) {
  // Generate random k
  const k = secp256k1.utils.randomPrivateKey();

  // Calculate R = G * k
  const R = secp256k1.ProjectivePoint.BASE.multiply(
    BigInt("0x" + bytesToHex(k))
  );

  // Get public key P = G * privateKey
  const P = secp256k1.ProjectivePoint.BASE.multiply(privateKey);

  // Calculate challenge e = H(R || P || msg)
  const challengeInput = new Uint8Array([
    ...R.toRawBytes(),
    ...P.toRawBytes(),
    ...msg,
  ]);
  const e = BigInt(keccak256(challengeInput));

  // Calculate s = k + e * privateKey
  const s = (BigInt("0x" + bytesToHex(k)) + e * privateKey) % secp256k1.CURVE.n;

  return {
    R: R,
    s: s,
    e: e,
  };
}

// Verify a Schnorr signature
export function verify(R, s, e, P) {
  // Check G * s = R + e * P
  const Gs = secp256k1.ProjectivePoint.BASE.multiply(s);
  const eP = P.multiply(e);
  const RPlus_eP = R.add(eP);

  return Gs.equals(RPlus_eP);
}

// Aggregate multiple public keys into a single key with rogue-key attack protection
export function aggregatePublicKeys(publicKeys) {
  if (!Array.isArray(publicKeys) || publicKeys.length === 0) {
    throw new Error("Must provide array of public keys");
  }

  // Convert hex strings to bytes and sort by big endian numeric value
  publicKeys = publicKeys.map(hexToBytes).sort((a, b) => {
    const aBig = BigInt("0x" + bytesToHex(a));
    const bBig = BigInt("0x" + bytesToHex(b));
    return Number(aBig - bBig);
  });

  // Concatenate all public keys and hash them to create the challenge
  const allKeysBytes = concatBytes(...publicKeys);
  const challenge = hexToBytes(keccak256(allKeysBytes));

  // Calculate sum of (H(L||Xi) * Xi) where L is the hash of all keys
  let aggregatedKey = secp256k1.ProjectivePoint.ZERO;
  for (const pubKey of publicKeys) {
    // Create per-key challenge by hashing challenge with public key
    const keyBytes = pubKey; //.toRawBytes();
    debugger;
    const keyChallenge = BigInt(keccak256(concatBytes(challenge, keyBytes)));

    // Convert public key bytes to Point and multiply by challenge
    const pubKeyPoint = secp256k1.ProjectivePoint.fromHex(pubKey);
    aggregatedKey = aggregatedKey.add(pubKeyPoint.multiply(keyChallenge));
  }

  return aggregatedKey;
}
