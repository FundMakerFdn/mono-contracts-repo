import { secp256k1 } from "@noble/curves/secp256k1";
import { concatBytes } from "@noble/curves/abstract/utils";
import { keccak256, bytesToHex, hexToBytes } from "viem";

export function computeChallenge(aggregatedNonce, aggregatedPubKey, message) {
  // Convert R (aggregatedNonce) to Ethereum address format
  // Take last 20 bytes of keccak256 of uncompressed point bytes (minus 0x04 prefix)
  const rBytes = aggregatedNonce.toRawBytes(false).slice(1);
  const rAddr = bytesToHex(hexToBytes(keccak256(rBytes)).slice(12, 32));

  // Get compressed pubkey parts
  const pubBytes = aggregatedPubKey.toRawBytes(true);
  const parity = pubBytes[0] - 2 + 27; // Convert 0x02/0x03 to 27/28
  const px = bytesToHex(pubBytes.slice(1));

  // Encode like solidity abi.encodePacked(address, uint8, bytes32, bytes32)
  const encoded = concatBytes(
    hexToBytes(rAddr),
    new Uint8Array([parity]),
    hexToBytes(px),
    message
  );

  return BigInt(keccak256(encoded));
}

export function combineNonces(nonces, message) {
  if (!nonces || nonces.length === 0) throw new Error("Nonces required");
  let nonceBytes = new Uint8Array(0);
  for (const nonce of nonces) {
    nonceBytes = concatBytes(nonceBytes, nonce.toRawBytes());
  }
  const bindingCoeff = BigInt(keccak256(concatBytes(nonceBytes, message)));
  let effectiveNonce = secp256k1.ProjectivePoint.ZERO;
  for (let i = 0; i < nonces.length; i++) {
    const weight = bindingCoeff ** BigInt(i) % secp256k1.CURVE.n;
    effectiveNonce = effectiveNonce.add(nonces[i].multiply(weight));
  }
  return effectiveNonce;
}

export function aggregateNonces(allNonces, message) {
  if (!allNonces || allNonces.length === 0) throw new Error("Nonces required");
  let aggregated = secp256k1.ProjectivePoint.ZERO;
  for (const nonces of allNonces) {
    aggregated = aggregated.add(combineNonces(nonces, message));
  }
  return aggregated;
}

export function aggregatePublicKeys(publicKeys) {
  if (!publicKeys || publicKeys.length === 0)
    throw new Error("Public keys required");
  const sortedKeys = publicKeys.slice().sort((a, b) => {
    return BigInt(a) < BigInt(b) ? -1 : 1;
  });
  const keysBytes = concatBytes(...sortedKeys.map((hex) => hexToBytes(hex)));
  const L = keccak256(keysBytes);
  const keyChallenges = {};
  let aggregatedKey = secp256k1.ProjectivePoint.ZERO;
  for (const pubKey of sortedKeys) {
    const pubKeyBytes = hexToBytes(pubKey);
    const a_i = BigInt(keccak256(concatBytes(hexToBytes(L), pubKeyBytes)));
    keyChallenges[pubKey] = a_i;
    const pubPoint = secp256k1.ProjectivePoint.fromHex(pubKeyBytes);
    aggregatedKey = aggregatedKey.add(pubPoint.multiply(a_i));
  }
  return { keyChallenges, aggregatedKey };
}

export function combinePartialSignatures(partialSigs) {
  if (!partialSigs || partialSigs.length === 0)
    throw new Error("Signatures required");
  let s = 0n;
  let R = null;

  for (const sig of partialSigs) {
    s = (s + sig.s) % secp256k1.CURVE.n;
    R = R ? R.add(sig.R) : sig.R;
  }

  return { R, s, challenge: partialSigs[0].challenge };
}

export function verifySignature(s, challenge, aggregatedPubKey, message) {
  // R = G*s - P*e
  const R = secp256k1.ProjectivePoint.BASE.multiply(s).subtract(
    aggregatedPubKey.multiply(challenge)
  );

  // e' = h(R || P || m)
  const e = computeChallenge(R, aggregatedPubKey, message);

  // check e' == e
  return e === challenge;
}

export class SchnorrParty {
  constructor(pubKey, privateKey, v = 1) {
    this.pubKey = pubKey;
    this.privateKey = BigInt(privateKey);
    this.v = v;
    this.nonces = [];
    this.secretNonces = [];
    this.effectiveNonce = null;
    this.keyChallenge = null;
  }

  generateNonces() {
    this.nonces = [];
    this.secretNonces = [];
    for (let i = 0; i < this.v; i++) {
      const kBytes = secp256k1.utils.randomPrivateKey();
      const k = BigInt(bytesToHex(kBytes));
      const R = secp256k1.ProjectivePoint.BASE.multiply(k);
      this.secretNonces.push(k);
      this.nonces.push(R);
    }
    return this.nonces;
  }

  acceptNonces(allNonces, message) {
    this.effectiveNonce = aggregateNonces(allNonces, message);
    return this.effectiveNonce;
  }

  partiallySign(challenge, message) {
    if (this.nonces.length !== this.v || this.secretNonces.length !== this.v) {
      throw new Error("Nonces not generated");
    }
    let nonceBytes = new Uint8Array(0);
    for (const nonce of this.nonces) {
      nonceBytes = concatBytes(nonceBytes, nonce.toRawBytes());
    }
    const bindingCoeff = BigInt(keccak256(concatBytes(nonceBytes, message)));
    let effectiveSecretNonce = BigInt(0);
    for (let i = 0; i < this.v; i++) {
      const weight = bindingCoeff ** BigInt(i) % secp256k1.CURVE.n;
      effectiveSecretNonce =
        (effectiveSecretNonce + this.secretNonces[i] * weight) %
        secp256k1.CURVE.n;
    }
    const s =
      (effectiveSecretNonce + challenge * this.keyChallenge * this.privateKey) %
      secp256k1.CURVE.n;
    const effectiveNonce = combineNonces(this.nonces, message);
    return { R: effectiveNonce, s, challenge };
  }
}
