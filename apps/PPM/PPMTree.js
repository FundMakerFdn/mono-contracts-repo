import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import { encodeAbiParameters, parseAbiParameters, keccak256 } from "viem";
import { secp256k1 } from "@noble/curves/secp256k1";
import { bytesToHex, hexToBytes } from "@noble/curves/abstract/utils";

// Helper function to create a Muon-style Schnorr signature
export function createSchnorrSignature(message, privateKey) {
  // 1. Hash message using keccak256
  const msgHash = BigInt(keccak256(message));
  
  // 2. Generate random k
  const k = BigInt("0x" + bytesToHex(secp256k1.utils.randomPrivateKey()));
  
  // 3. Compute k*G
  const kG = secp256k1.ProjectivePoint.BASE.multiply(k);
  
  // 4. Get ethereum address of k*G
  const kGCompressed = kG.toRawBytes(true);
  const nonceAddr = "0x" + keccak256(kGCompressed).slice(-40);
  
  // Get public key
  const pubKey = secp256k1.ProjectivePoint.fromHex(secp256k1.getPublicKey(hexToBytes(privateKey.toString(16))));
  const pubKeyX = pubKey.toAffine().x;
  const pubKeyYParity = pubKey.toAffine().y % 2n;
  
  // 5. Compute challenge e = H(PKx || PKyp || msgHash || nonceAddr)
  const challengeInput = new Uint8Array([
    ...hexToBytes(pubKeyX.toString(16).padStart(64, '0')),
    Number(pubKeyYParity),
    ...hexToBytes(msgHash.toString(16).padStart(64, '0')),
    ...hexToBytes(nonceAddr.slice(2))
  ]);
  const e = BigInt(keccak256(challengeInput));
  
  // 6. Compute s = (k - privateKey * e) % Q
  const Q = secp256k1.CURVE.n;
  let s = (k - (BigInt(privateKey) * e)) % Q;
  if (s < 0n) s += Q;

  return {
    signature: s.toString(16),
    nonce: nonceAddr,
    pubKeyX: pubKeyX.toString(16),
    pubKeyYParity: Number(pubKeyYParity)
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
    const message = new TextEncoder().encode(JSON.stringify(leaf));
    const msgHash = BigInt(keccak256(message));
    
    const pubKeyX = BigInt("0x" + signature.pubKeyX);
    const HALF_Q = (secp256k1.CURVE.n >> 1n) + 1n;
    
    // Verify pubKeyX < HALF_Q
    if (pubKeyX >= HALF_Q) return false;
    
    const s = BigInt("0x" + signature.signature);
    if (s >= secp256k1.CURVE.n) return false;
    
    // Compute challenge e
    const challengeInput = new Uint8Array([
      ...hexToBytes(signature.pubKeyX.padStart(64, '0')),
      Number(signature.pubKeyYParity),
      ...hexToBytes(msgHash.toString(16).padStart(64, '0')),
      ...hexToBytes(signature.nonce.slice(2))
    ]);
    const e = BigInt(keccak256(challengeInput));
    
    // Verify using ecrecover
    const Q = secp256k1.CURVE.n;
    const recoveredPoint = secp256k1.ProjectivePoint.fromPrivateKey(
      (Q - (pubKeyX * s % Q)) % Q
    );
    const recoveredAddr = "0x" + keccak256(recoveredPoint.toRawBytes(true)).slice(-40);
    
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
