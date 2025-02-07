import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import { encodeAbiParameters, parseAbiParameters } from "viem";
import { secp256k1 } from "@noble/curves/secp256k1";
import { sha256 } from "@noble/hashes/sha256";
import { bytesToNumberBE } from "@noble/curves/abstract/utils";

// Helper function to create a Schnorr signature
export function createSchnorrSignature(message, privateKey) {
  const r = secp256k1.utils.randomPrivateKey();
  const R = secp256k1.ProjectivePoint.BASE.multiply(bytesToNumberBE(r));
  const X = secp256k1.ProjectivePoint.fromHex(
    secp256k1.getPublicKey(privateKey)
  );
  const c = hashChallenge(R.toRawBytes(true), X.toRawBytes(true), message);
  const s = (bytesToNumberBE(r) + c * BigInt(privateKey)) % secp256k1.CURVE.n;
  return `${Buffer.from(R.toRawBytes(true)).toString("hex")},${s.toString(16)}`;
}

// Compute challenge scalar c = H(R || X || m)
function hashChallenge(R, X, message) {
  const data = new Uint8Array([...R, ...X, ...message]);
  const hash = sha256(data);
  return BigInt("0x" + Buffer.from(hash).toString("hex")) % secp256k1.CURVE.n;
}

export class PPMTree {
  constructor() {
    this.leaves = [];
    this.tree = null;
    this.signatures = new Map(); // Store signatures for each leaf
  }

  // Aggregate Schnorr signatures
  aggregateSignatures(signatures, message) {
    // Each signature should be an object containing {R: Point, s: bigint}
    const sigs = signatures.map((sig) => {
      const [R_bytes, s_hex] = sig.split(",");
      const R = secp256k1.ProjectivePoint.fromHex(R_bytes);
      const s = BigInt("0x" + s_hex);
      return { R, s };
    });

    // Aggregate R points and s values
    let R_agg = sigs[0].R;
    let s_agg = sigs[0].s;

    for (let i = 1; i < sigs.length; i++) {
      R_agg = R_agg.add(sigs[i].R);
      s_agg = (s_agg + sigs[i].s) % secp256k1.CURVE.n;
    }

    // Return aggregated signature as string
    return `${Buffer.from(R_agg.toRawBytes(true)).toString(
      "hex"
    )},${s_agg.toString(16)}`;
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

  // Verify an aggregated signature
  verifyAggregatedSignature(leaf, aggregatedSignature) {
    const message = new TextEncoder().encode(JSON.stringify(leaf));
    const [R_hex, s_hex] = aggregatedSignature.split(",");

    const R = secp256k1.ProjectivePoint.fromHex(R_hex);
    const s = BigInt("0x" + s_hex);

    // Get public key point X
    const X = secp256k1.ProjectivePoint.fromHex(
      secp256k1.getPublicKey(leaf.party)
    );

    // Compute challenge
    const c = hashChallenge(R.toRawBytes(true), X.toRawBytes(true), message);

    // Verify: s*G = R + c*X
    const sG = secp256k1.ProjectivePoint.BASE.multiply(s);
    const R_plus_cX = R.add(X.multiply(c));

    return sG.equals(R_plus_cX);
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
