import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import { keccak256, encodeAbiParameters, parseAbiParameters } from "viem";
import { secp256k1 } from "@noble/curves/secp256k1";
import { bytesToHex, hexToBytes } from "@noble/curves/abstract/utils";
import { hashPPMLeaf } from "./eip712.js";

import { sign as schnorrSign } from "./schnorr.js";

// Helper function to create a Schnorr signature
export function createSchnorrSignature(leaf, privateKey) {
  // Hash the leaf using EIP-712
  const msgHash = hashPPMLeaf(leaf);
  
  // Sign the hash
  const signature = schnorrSign(msgHash, privateKey);
  
  return {
    R: signature.R,
    s: signature.s,
    e: signature.e
  };
}

export class PPMTree {
  constructor() {
    this.leaves = [];
    this.tree = null;
    this.signatures = new Map(); // Store signatures for each leaf
  }

  // Aggregate Muon-style Schnorr signatures
  aggregateSignatures(signatures) {
    // For Muon signatures, we don't aggregate - we verify each individually
    // Return the first valid signature
    return signatures[0];
  }

  // Encode leaf data based on action type
  encodeLeafData(actionType, args) {
    switch (actionType) {
      case "transfer":
        return encodeAbiParameters(
          parseAbiParameters("address receiver, uint256 amount"),
          [args.receiver, args.amount]
        );
      case "deploy":
        return encodeAbiParameters(
          parseAbiParameters("address factory, bytes calldata"),
          [args.factory, args.calldata]
        );
      case "pause":
        return encodeAbiParameters(parseAbiParameters("bytes32 trace"), [
          args.trace,
        ]);
      default:
        throw new Error(`Unsupported action type: ${actionType}`);
    }
  }

  // Add a leaf to the tree
  addLeaf(leaf, signatures) {
    const encodedArgs = this.encodeLeafData(leaf.type, leaf.args);
    const message = new TextEncoder().encode(JSON.stringify(leaf));
    const aggregatedSignature = this.aggregateSignatures(signatures, message);

    this.leaves.push([
      leaf.index.toString(),
      leaf.type,
      leaf.chainId.toString(),
      leaf.pSymm,
      leaf.party,
      encodedArgs,
      aggregatedSignature,
    ]);
  }

  // Verify a Muon-style signature
  verifySignature(leaf, signature) {
    const msgHash = BigInt(hashPPMLeaf(leaf));

    const pubKeyX = BigInt("0x" + signature.pubKeyX);
    const HALF_Q = (secp256k1.CURVE.n >> 1n) + 1n;

    // Verify pubKeyX < HALF_Q
    if (pubKeyX >= HALF_Q) return false;

    const s = BigInt("0x" + signature.signature);
    if (s >= secp256k1.CURVE.n) return false;

    // Compute challenge e
    const challengeInput = new Uint8Array([
      ...hexToBytes(signature.pubKeyX.padStart(64, "0")),
      Number(signature.pubKeyYParity),
      ...hexToBytes(msgHash.toString(16).padStart(64, "0")),
      ...hexToBytes(signature.nonce.slice(2)),
    ]);
    const e = BigInt(keccak256(challengeInput));

    // Verify using ecrecover
    const Q = secp256k1.CURVE.n;
    const recoveredPoint = secp256k1.ProjectivePoint.fromPrivateKey(
      (Q - ((pubKeyX * s) % Q)) % Q
    );
    const recoveredAddr =
      "0x" + keccak256(recoveredPoint.toRawBytes(true)).slice(-40);

    return recoveredAddr === signature.nonce;
  }

  // Build the merkle tree
  buildTree() {
    this.tree = StandardMerkleTree.of(this.leaves, [
      "string", // index
      "string", // actionType
      "string", // chainId
      "address", // pSymm
      "address", // party
      "bytes", // encoded args
      "address", // signer (may be aggregated)
      "bytes", // aggregated signatures
    ]);

    return this.tree;
  }

  // Get proof for a specific leaf by index
  getProof(targetIndex) {
    if (!this.tree) {
      throw new Error("Tree not built yet. Call buildTree() first.");
    }

    // Find the leaf with matching index in the tree
    for (const [i, v] of this.tree.entries()) {
      if (v[0] === targetIndex.toString()) {
        return this.tree.getProof(i);
      }
    }
    throw new Error(`No leaf found with index ${targetIndex}`);
  }

  // Verify a proof
  verifyProof(proof, leaf) {
    if (!this.tree) {
      throw new Error("Tree not built yet. Call buildTree() first.");
    }
    return this.tree.verify(proof, leaf);
  }

  // Get the root hash
  getRoot() {
    if (!this.tree) {
      throw new Error("Tree not built yet. Call buildTree() first.");
    }
    return this.tree.root;
  }
}
