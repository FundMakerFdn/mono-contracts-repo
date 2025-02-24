const { keccak256: viemKeccak256 } = require("viem");

function keccak256(left, right) {
  const input = Buffer.concat([left, right]);
  const hashHex = viemKeccak256(input);
  return Buffer.from(hashHex.slice(2), "hex");
}

function insert(commitment, nextIndex, zeros, filledSubtrees) {
  let currentHash = commitment;
  let currentIndex = nextIndex;
  if (!filledSubtrees || filledSubtrees.length === 0) {
    filledSubtrees = zeros.slice();
  }
  const proof = [];
  for (let level = 0; level < 10; level++) {
    if (currentIndex % 2 === 0) {
      proof.push(zeros[level]);
      filledSubtrees[level] = currentHash;
      currentHash = keccak256(currentHash, zeros[level]);
    } else {
      proof.push(filledSubtrees[level]);
      currentHash = keccak256(filledSubtrees[level], currentHash);
    }
    currentIndex = Math.floor(currentIndex / 2);
  }
  return [currentHash, filledSubtrees, proof];
}

function main() {
  const zeros = [];
  let currentZero = Buffer.alloc(32, 0);
  for (let i = 0; i < 10; i++) {
    zeros.push(currentZero);
    currentZero = keccak256(currentZero, currentZero);
  }
  const initialRoot = zeros[zeros.length - 1];
  console.log(`Initial Merkle root: 0x${initialRoot.toString("hex")}`);

  const testCommitment = Buffer.from(
    "1cb1b16d77322dc69122683e8d4576fa3a1315a6a8231ce36fb5b3913f44a93a",
    "hex"
  );
  let filledSubtrees = [];
  const [newRoot, updatedSubtrees, proof] = insert(
    testCommitment,
    0,
    zeros,
    filledSubtrees
  );
  console.log(`Merkle root after insertion: 0x${newRoot.toString("hex")}`);
  console.log("Merkle proof for the inserted element:");
  proof.forEach((el, idx) => {
    console.log(`Level ${idx}: 0x${el.toString("hex")}`);
  });
}

main();
