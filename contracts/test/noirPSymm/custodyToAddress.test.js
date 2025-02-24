const assert = require("node:assert/strict");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox-viem/network-helpers");
const { parseEther, keccak256, padHex, encodeAbiParameters} = require("viem");
const hre = require("hardhat");
const { deployTestFixture } = require("./noirPsymm.deployment");
const { CHAIN_ID } = require("./globalVariables");
const { StandardMerkleTree } = require("@openzeppelin/merkle-tree");

function shouldCustodyToAddress() {
  describe("Test custodyToAddress", function () {
    it("should transfer tokens from custody to an external address", async function () {
      let tx;
      async function processTx() {
        await publicClient.waitForTransactionReceipt({ hash: tx });
      }

      const {
        noirPsymm,
        mockUSDC,
        partyAPub,
        partyBPub,
        combinedClient,
        combinedPub,
        publicClient,
      } = await loadFixture(deployTestFixture);

      // Transfer tokens to parties and approve noirPsymm for spending.
      const funding = parseEther("1000");
      tx = await mockUSDC.write.mint([partyAPub, funding]);
      await processTx();
      tx = await mockUSDC.write.mint([partyBPub, funding]);
      await processTx();
      tx = await mockUSDC.write.approve([noirPsymm.address, funding], { account: partyAPub });
      await processTx();
      tx = await mockUSDC.write.approve([noirPsymm.address, funding], { account: partyBPub });
      await processTx();

      // Build the Merkle tree with the whitelist data.
      // The leaf contains: ["custodyToAddress", chainId, noirPsymm.address, custody state (0), whitelisted signer]
      const leafData = [
        ["custodyToAddress", CHAIN_ID.HARDHAT, noirPsymm.address, 0, combinedPub],
      ];
      const tree = StandardMerkleTree.of(leafData, [
        "string",
        "uint256",
        "address",
        "uint8",
        "address",
      ]);
      // Use the Merkle tree root as the custody identifier (_id)
      const merkleRoot = tree.root;
      // Get the Merkle proof for the only leaf (index 0)
      const merkleProof = tree.getProof(0).map((node) => node.data);

      // Set up parameters for the custodyToAddress call.
      const _id = merkleRoot;
      const _token = mockUSDC.address;
      const _destination = combinedPub;
      const _amount = parseEther("100");
      const _timestamp = Math.floor(Date.now() / 1000);
      // Convert "hi" into a valid bytes32 using padHex (2 bytes padded to 32 bytes).
      const _commitment = padHex("0x6869", 66);
      const _nullifier = padHex("0x6869", 66);


      const types = [
        "uint256",
        "string",
        "bytes32",
        "address",
        "address",
        "uint256",
        "bytes32",
        "bytes32",
      ];
      const valuesForMessage = [
        _timestamp,
        "custodyToAddress",
        _id,
        _token,
        _destination,
        _amount,
        _commitment,
        _nullifier,
      ];
      console.log("types", valuesForMessage);
      const encodedMessage = encodeAbiParameters(types, valuesForMessage);
      const messageHash = keccak256(encodedMessage);

      // Sign the message with the combined client.
      const signature = await combinedClient.signMessage({ message: messageHash });

      // Execute the custodyToAddress function with the signature and Merkle proof.
      tx = await noirPsymm.write.custodyToAddress(
        [
          _id,
          _token,
          _destination,
          _amount,
          _timestamp,
          _destination, // _signer must match the whitelisted signer in the tree.
          signature,
          merkleProof,
          _nullifier,
          _commitment,
        ],
        { account: combinedPub }
      );
      await publicClient.waitForTransactionReceipt({ hash: tx });

      // Verify that tokens have been transferred.
      const balance = await mockUSDC.read.balanceOf([_destination]);
      assert.equal(balance, _amount.toString(), "Token transfer failed");
    });
  });
}

module.exports = { shouldCustodyToAddress };
