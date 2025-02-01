import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { hardhat } from "viem/chains";
import { PPMTree } from "./PPMTree.js";

// Setup clients
const publicClient = createPublicClient({
  chain: hardhat,
  transport: http(),
});

async function main() {
  // Example private keys (in production these would be securely managed)
  const partyAKey =
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
  const partyBKey =
    "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";

  // Create accounts
  const partyA = privateKeyToAccount(partyAKey);
  const partyB = privateKeyToAccount(partyBKey);

  // Create PPM Tree
  const ppmTree = new PPMTree();

  // Create action data
  const action1 = {
    index: 1,
    type: "transfer",
    chainId: 12,
    pSymm: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
    party: partyA.address,
    args: {
      receiver: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
      amount: 1000000,
    },
  };

  const action2 = {
    index: 2,
    type: "transfer",
    chainId: 12,
    pSymm: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
    party: partyB.address,
    args: {
      receiver: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
      amount: 2000000,
    },
  };

  // Sign the stringified action data
  const partyASignature = await partyA.signMessage({
    message: JSON.stringify(action1),
  });
  const partyBSignature = await partyB.signMessage({
    message: JSON.stringify(action1),
  });

  ppmTree.addLeaf(action1, [partyASignature, partyBSignature]);

  const partyASignature2 = await partyA.signMessage({
    message: JSON.stringify(action2),
  });
  const partyBSignature2 = await partyB.signMessage({
    message: JSON.stringify(action2),
  });

  ppmTree.addLeaf(action2, [partyASignature2, partyBSignature2]);

  // Build the tree
  const tree = ppmTree.buildTree();

  // Get root hash
  const root = ppmTree.getRoot();

  // Get proofs
  const proof1 = ppmTree.getProof(1);
  const proof2 = ppmTree.getProof(2);

  // Print each entry in the tree
  for (const [i, v] of tree.entries()) {
    console.log(`Entry ${i}:`, v);
  }
  console.log("Merkle Root:", root);
  console.log("Proof for first action:", proof1);
  console.log("Proof for second action:", proof2);

  // After getting signature from each party, we can submit root onchain
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
