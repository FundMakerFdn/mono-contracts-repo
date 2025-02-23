const { shouldDeployNoirPsymm } = require("./noirPsymm.deployment");

describe("noirPsymm", function () {
  describe("noirPsymm Deployment", function () {
    shouldDeployNoirPsymm();
  });
});


const assert = require("node:assert/strict");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox-viem/network-helpers");
const { parseEther, keccak256, toHex } = require("viem");
const hre = require("hardhat");

async function deployFixture() {
  const [deployer, partyA, partyB] = await hre.viem.getWalletClients();
  const publicClient = await hre.viem.getPublicClient();

  // Deploy the noirPsymm contract (which requires no constructor arguments)
  const noirPsymm = await hre.viem.deployContract("noirPsymm", []);
  return { noirPsymm, deployer, partyA, partyB, publicClient };
}

describe("noirPsymm", function () {
  it("should deposit a new commitment via addressToCustody", async function () {
    const { noirPsymm, partyA, publicClient } = await loadFixture(deployFixture);
    
    // Generate a commitment (here using keccak256 of a string)
    const commitment = keccak256(toHex("commitment1"));
    
    const tx = await noirPsymm.write.addressToCustody([commitment], {
      account: partyA.account,
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
    
    // Look for the Deposit event (the event signature is "Deposit(bytes32,uint32,uint256)")
    const depositEventTopic = keccak256(toHex("Deposit(bytes32,uint32,uint256)"));
    const depositLog = receipt.logs.find((log) => log.topics[0] === depositEventTopic);
    assert(depositLog, "Deposit event not found");
    
    // Verify that nextIndex was updated and the commitment is stored in leaves[0]
    const nextIndex = await noirPsymm.read.nextIndex([]);
    assert.equal(Number(nextIndex), 1, "nextIndex should be 1");
    
    const storedCommitment = await noirPsymm.read.leaves([0]);
    assert.equal(storedCommitment, commitment, "Stored commitment mismatch");
  });

  it("should reject duplicate commitment in addressToCustody", async function () {
    const { noirPsymm, partyA } = await loadFixture(deployFixture);
    const commitment = keccak256(toHex("commitment2"));
    
    // First deposit should succeed
    await noirPsymm.write.addressToCustody([commitment], { account: partyA.account });
    
    // A second deposit with the same commitment should revert
    await assert.rejects(
      async () => {
        await noirPsymm.write.addressToCustody([commitment], { account: partyA.account });
      },
      {
        message: /The commitment has been submitted/,
      }
    );
  });

  it("should fail custodyToAddress with insufficient custody balance", async function () {
    const { noirPsymm, partyA, partyB } = await loadFixture(deployFixture);
    
    // Use an arbitrary custody ID (which by default has zero balance)
    const _id = keccak256(toHex("testId"));
    // For testing, use partyA's address as a dummy token address
    const _token = partyA.account.address;
    const _destination = partyB.account.address;
    const _amount = parseEther("10");
    const _timestamp = BigInt(Math.floor(Date.now() / 1000));
    const signer = partyA.account.address;
    const signature = "0x"; // dummy signature (won't reach ECDSA check because balance check fails)
    const merkleProof = []; // empty proof

    await assert.rejects(
      async () => {
        await noirPsymm.write.custodyToAddress(
          [
            _id,
            _token,
            _destination,
            _amount,
            _timestamp,
            signer,
            signature,
            merkleProof,
          ],
          { account: partyA.account }
        );
      },
      {
        message: /Insufficient custody balance/,
      }
    );
  });

  it("should fail changeCustodyState with invalid merkle proof", async function () {
    const { noirPsymm, partyA } = await loadFixture(deployFixture);
    
    // Use an arbitrary custody id (defaults to state 0)
    const _id = keccak256(toHex("testCustodyState"));
    const _state = 1;
    const _timestamp = BigInt(Math.floor(Date.now() / 1000));
    const signer = partyA.account.address;
    const signature = "0x"; // dummy signature
    const merkleProof = []; // empty proof should fail verification

    await assert.rejects(
      async () => {
        await noirPsymm.write.changeCustodyState(
          [_id, _state, _timestamp, signer, signature, merkleProof],
          { account: partyA.account }
        );
      },
      {
        message: /Invalid merkle proof/,
      }
    );
  });
});

module.exports = {
  deployFixture,
};
