import { secp256k1 } from "@noble/curves/secp256k1";
import { bytesToHex } from "@noble/curves/abstract/utils";
import { keccak256 } from "viem";

// Sign a message using Schnorr signature
export function sign(msg, privateKey) {
  // Generate random k
  const k = secp256k1.utils.randomPrivateKey();
  
  // Calculate R = G * k
  const R = secp256k1.ProjectivePoint.BASE.multiply(BigInt('0x' + bytesToHex(k)));
  
  // Get public key P = G * privateKey
  const P = secp256k1.ProjectivePoint.BASE.multiply(privateKey);
  
  // Calculate challenge e = H(R || P || msg)
  const challengeInput = new Uint8Array([
    ...R.toRawBytes(),
    ...P.toRawBytes(),
    ...msg
  ]);
  const e = BigInt(keccak256(challengeInput));
  
  // Calculate s = k + e * privateKey
  const s = (BigInt('0x' + bytesToHex(k)) + e * privateKey) % secp256k1.CURVE.n;
  
  return {
    R: R,
    s: s,
    e: e
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
