const { shouldDeployPSYMM } = require("./MockPPM.deployment");

describe("PSYMM", function () {
  describe("PSYMM Deployment", function () {
    shouldDeployPSYMM();
  });
});


/*
async function performCTC(
    { psymm_partyA, psymm_partyB, USDC, USDE, deployer, USDC_PRECISION, USDE_PRECISION },
  ) {

    // --- Build the Merkle tree for custodyToCustody ---
    // NOTE: The off-chain leaf now exactly mirrors the on-chain leaf construction:
    // keccak256(abi.encode("custodyToCustody", chainId, address(this), custodyState (0), _signer))
    const leafData = [
      [
        "custodyToCustody",
        CHAIN_ID.HARDHAT,
        noirPsymm.address,
        0,
        deployer.account.address,
      ],
    ];
    const tree = StandardMerkleTree.of(leafData, [
      "string",
      "uint256",
      "address",
      "uint8",
      "address",
    ]);
    let merkleRoot = tree.root;
    // Convert the merkleRoot to a bytes32 value.
    merkleRoot = toHex(hexToBytes(merkleRoot));
    // Convert each proof element to bytes32.
    const merkleProof = tree
      .getProof(0)
      .map((node) => toHex(hexToBytes(node.data)));

    // Update the PPM mapping in the contract with the new Merkle root.
    await noirPsymm.write.updatePPM([toHex(pad(0)), merkleRoot]);
    const storedPPM = await noirPsymm.read.PPMs([toHex(pad(0))]);
    assert.equal(storedPPM, merkleRoot, "PPM should be updated");

    // --- Call custodyToCustody ---
    // The parameters must match the on-chain expectation:
    // _zkProof, _id, _nullifier, _commitment1, _commitment2, _signer, _merkleProof
    // console.log("hello", CHAIN_ID.HARDHAT, noirPsymm.address, 0, deployer.account.address )
    await noirPsymm.write.custodyToCustody([
      bytesToHex(proof), // _zkProof
      toHex(pad(0)), // _id (custody id)
      keccak256(pad(0)), // _nullifier
      commitmentA, // _commitment1
      commitmentB, // _commitment2
      deployer.account.address, // _signer (whitelisted signer)
      0, // _state
      merkleProof, // _merkleProof
    ]);


    return { commitmentA, commitmentB };
  }
    */