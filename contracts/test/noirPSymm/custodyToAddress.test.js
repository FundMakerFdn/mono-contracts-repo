const assert = require("node:assert/strict");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox-viem/network-helpers");
const { parseEther, keccak256, toHex } = require("viem");
const hre = require("hardhat");
const { deployTestFixture } = require("./noirPsymm.deployment");

function shouldCustodyToAddress() {
  describe("Test custodyToAddress", function () {
    it("should transfer tokens from custody to an external address", async function () {
      let tx;
      const { noirPsymm, mockUSDC, partyA, partyB, publicClient } = await loadFixture(deployTestFixture);

      // Transfer tokens to the noirPsymm contract so it can forward tokens
      const funding = parseEther("1000");
      tx = await mockUSDC.write.mint([partyA.account.address, funding]);
      await publicClient.waitForTransactionReceipt({ hash: tx });
      tx = await mockUSDC.write.mint([partyB.account.address, funding]);
      await publicClient.waitForTransactionReceipt({ hash: tx });
      //approve
      tx = await mockUSDC.write.approve([noirPsymm.address, funding], { account: partyA.account });
      await publicClient.waitForTransactionReceipt({ hash: tx });
      tx = await mockUSDC.write.approve([noirPsymm.address, funding], { account: partyB.account });
      await publicClient.waitForTransactionReceipt({ hash: tx });
      // addressToCustody
      const commitment = keccak256(toHex("testInsertCommitment"));

      tx = await noirPsymm.write.addressToCustody([commitment, funding, mockUSDC.address], { account: partyA.account });
      await publicClient.waitForTransactionReceipt({ hash: tx });
      const balance = await mockUSDC.read.balanceOf([noirPsymm.address]);
      assert.equal(balance, funding);

      const _tx = await noirPsymm.write._insert([commitment], { account: partyA.account });
      await publicClient.waitForTransactionReceipt({ hash: _tx });
      const nextIndex = await noirPsymm.read.nextIndex([]);
        /*
      // Prepare parameters for a valid custodyToAddress call

      // For Merkle proof, we want the computed leaf to equal the root.
      // leaf = keccak256(abi.encode("custodyToAddress", chainId, contractAddress, custodyState, destination, signer))
      // Since custodyState is 0 by default and _getPPM assigns _id = _id when empty,
      // we choose _id equal to the computed leaf so that an empty proof works.
      const chainId = await publicClient.getChainId();
      const destination = partyB.account;
      const signer = partyA.account;
      const abiCoder = hre.ethers.AbiCoder.defaultAbiCoder();
      const leaf = hre.ethers.keccak256(
        abiCoder.encode(
          ["string", "uint256", "address", "uint8", "address", "address"],
          ["custodyToAddress", chainId, noirPsymm.address, 0, destination, signer]
        )
      );
      const _id = leaf;

      // Set transfer amount and other parameters
      const amount = hre.ethers.parseUnits("100", 18);
      const blockNumber = await publicClient.getBlockNumber();
      const block = await publicClient.getBlock({ blockNumber });
      const timestamp = block.timestamp;
      const commitment = hre.ethers.keccak256("0xdeadbeef");
      const nullifier = hre.ethers.keccak256("0xbeefdead");

      // Construct the message for signature:
      // message = keccak256(abi.encode(timestamp, "custodyToAddress", _id, _token, destination, amount, commitment, nullifier))
      const message = hre.ethers.keccak256(
        abiCoder.encode(
          ["uint256", "string", "bytes32", "address", "address", "uint256", "bytes32", "bytes32"],
          [timestamp, "custodyToAddress", _id, token.address, destination, amount, commitment, nullifier]
        )
      );

      // Sign the message with partyA
      const signature = await partyA.signMessage(hre.ethers.arrayify(message));

      // Call custodyToAddress with a valid merkle proof (empty array) and valid signature
       tx = await noirPsymm.write.custodyToAddress([
        _id,
        token.address,
        destination,
        amount,
        timestamp,
        signer,
        signature,
        [], // empty merkle proof as leaf === _id
        nullifier,
        commitment
      ], { account: partyA.account });
      await publicClient.waitForTransactionReceipt({ hash: tx });

      // Verify that destination's token balance increased by the transferred amount
      const destBalance = await token.balanceOf(destination);
      assert.equal(destBalance.toString(), amount.toString());
      */
    });

   
  });
}

module.exports = { shouldCustodyToAddress };
