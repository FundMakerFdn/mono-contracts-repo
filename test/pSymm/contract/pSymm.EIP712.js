const { ethers } = require("ethers");
const { keccak256, defaultAbiCoder, toUtf8Bytes, solidityPack } = ethers.utils;

// Define the EIP-712 domain
const domain = {
  name: "pSymm",
  version: "1",
  chainId: 1, // Replace with your chain ID
  verifyingContract: "0xYourContractAddress", // Replace with your contract address
};

// Define the types for the EIP-712 message
const types = {
  createCustodyRollupParams: [
    { name: "partyA", type: "address" },
    { name: "partyB", type: "address" },
    { name: "custodyRollupId", type: "uint256" },
    { name: "settlementAddress", type: "address" },
    { name: "MA", type: "bytes32" },
    { name: "isManaged", type: "bool" },
    { name: "expiration", type: "uint256" },
    { name: "timestamp", type: "uint256" },
    { name: "nonce", type: "uint256" },
  ],
  // Add other types as needed
};

// Function to generate EIP-712 signature
async function generateEIP712Signature(wallet, params, typeName) {
  const domainSeparator = keccak256(
    defaultAbiCoder.encode(
      ["bytes32", "bytes32", "bytes32", "uint256", "address"],
      [
        keccak256(toUtf8Bytes("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)")),
        keccak256(toUtf8Bytes(domain.name)),
        keccak256(toUtf8Bytes(domain.version)),
        domain.chainId,
        domain.verifyingContract,
      ]
    )
  );

  const structHash = keccak256(
    defaultAbiCoder.encode(
      types[typeName].map((t) => t.type),
      types[typeName].map((t) => params[t.name])
    )
  );

  const digest = keccak256(
    solidityPack(
      ["string", "bytes32", "bytes32"],
      ["\x19\x01", domainSeparator, structHash]
    )
  );

  return await wallet.signMessage(ethers.utils.arrayify(digest));
}

// Example usage
async function main() {
  const walletA = new ethers.Wallet("0xYourPrivateKeyA"); // Replace with private key
  const walletB = new ethers.Wallet("0xYourPrivateKeyB"); // Replace with private key

  const params = {
    partyA: walletA.address,
    partyB: walletB.address,
    custodyRollupId: 1,
    settlementAddress: "0xSettlementAddress", // Replace with actual address
    MA: keccak256(toUtf8Bytes("SomeData")),
    isManaged: true,
    expiration: Math.floor(Date.now() / 1000) + 3600,
    timestamp: Math.floor(Date.now() / 1000),
    nonce: 0,
  };

  const signatureA = await generateEIP712Signature(walletA, params, "createCustodyRollupParams");
  const signatureB = await generateEIP712Signature(walletB, params, "createCustodyRollupParams");

  console.log("Signature A:", signatureA);
  console.log("Signature B:", signatureB);
}

main().catch(console.error);