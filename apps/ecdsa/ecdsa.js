import { secp256k1 } from "@noble/curves/secp256k1";
import { bytesToHex } from "viem";

// Demo of combining ECDSA private keys
function main() {
  // Generate two random private keys
  const privKey1 = BigInt(bytesToHex(secp256k1.utils.randomPrivateKey()));
  const privKey2 = BigInt(bytesToHex(secp256k1.utils.randomPrivateKey()));
  
  // Calculate their public keys
  const pubKey1 = secp256k1.ProjectivePoint.BASE.multiply(privKey1);
  const pubKey2 = secp256k1.ProjectivePoint.BASE.multiply(privKey2);
  
  // Combine private keys (modular addition)
  const combinedPrivKey = (privKey1 + privKey2) % secp256k1.CURVE.n;
  
  // Calculate combined public key directly from combined private key
  const combinedPubKey = secp256k1.ProjectivePoint.BASE.multiply(combinedPrivKey);
  
  // Also calculate combined public key by adding individual public keys
  const combinedPubKeyAlt = pubKey1.add(pubKey2);
  
  console.log("Private Key 1:", privKey1.toString(16));
  console.log("Private Key 2:", privKey2.toString(16));
  console.log("Combined Private Key:", combinedPrivKey.toString(16));
  console.log("\nPublic Key 1:", pubKey1.toHex(true));
  console.log("Public Key 2:", pubKey2.toHex(true));
  console.log("Combined Public Key:", combinedPubKey.toHex(true));
  console.log("Combined Public Key (alt):", combinedPubKeyAlt.toHex(true));
  
  // Verify that both methods of combining give the same result
  console.log("\nPublic keys match:", combinedPubKey.equals(combinedPubKeyAlt));
}

main();
