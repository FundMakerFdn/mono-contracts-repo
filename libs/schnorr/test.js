const { secp256k1 } = require("@noble/curves/secp256k1");
const { bytesToHex, stringToBytes } = require("viem");
const { signMessage, verifySignature } = require("./index.js");

// Generate a random private key
const privateKey = secp256k1.utils.randomPrivateKey();
const privateKeyBigInt = BigInt(bytesToHex(privateKey));
console.log("Private key:", bytesToHex(privateKey));

// Derive the public key
const publicKey = secp256k1.ProjectivePoint.BASE.multiply(privateKeyBigInt);
console.log("Public key:", bytesToHex(publicKey.toRawBytes(true)));

// Message to sign
const message = stringToBytes("Hello, world");
console.log("Message:", "Hello, world");

// Sign the message
console.log("\nSigning message...");
const signature = signMessage(message, privateKeyBigInt);
console.log("R:", bytesToHex(signature.R.toRawBytes(true)));
console.log("s:", signature.s.toString());
console.log("challenge:", signature.challenge.toString());

// Verify the signature
console.log("\nVerifying signature...");
const isValid = verifySignature(
  signature.s,
  signature.challenge,
  publicKey,
  message
);
console.log("Signature valid:", isValid);

// Try with invalid signature (modify s)
// console.log("\nVerifying invalid signature...");
// const invalidS = (signature.s + 1n) % secp256k1.CURVE.n;
// const isInvalidValid = verifySignature(invalidS, signature.challenge, publicKey, message);
// console.log("Invalid signature reported as valid:", isInvalidValid);
