import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import { encodeAbiParameters, parseAbiParameters } from "viem";

export class PPMTree {
  constructor() {
    this.leaves = [];
    this.tree = null;
    this.signatures = new Map(); // Store signatures for each leaf
  }

  // Combine signatures into a single string
  aggregateSignatures(signatures) {
    return signatures.sort().join(",");
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
    const aggregatedSignature = this.aggregateSignatures(signatures);

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

  // Build the merkle tree
  buildTree() {
    this.tree = StandardMerkleTree.of(this.leaves, [
      "string", // index
      "string", // actionType
      "string", // chainId
      "address", // pSymm
      "address", // party
      "bytes", // encoded args
      "string", // aggregated signatures
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
