import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import { keccak256, encodeAbiParameters, parseAbiParameters } from "viem";
import { secp256k1 } from "@noble/curves/secp256k1";
import { bytesToHex, hexToBytes } from "@noble/curves/abstract/utils";
import { hashPPMLeaf } from "./eip712.js";

export class PPMTree {
  constructor() {
    this.leaves = [];
    this.tree = null;
    this.signatures = new Map(); // Store signatures for each leaf
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
  addLeaf(leaf, signature) {
    this.leaves.push({ ...leaf, ...signature });
  }

  // Build the merkle tree
  buildTree() {
    this.tree = StandardMerkleTree.of(this.leaves, [
      "uint256", // timestamp
      "string", // actionType
      "string", // chainId
      "address", // pSymm
      "bytes", // encoded args

      "uint8", // P.parity
      "bytes32", // P.px
      "bytes32", // sig.e
      "bytes32", // sig.s
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
