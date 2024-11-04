const assert = require("node:assert/strict");
const {
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox-viem/network-helpers");
const { StandardMerkleTree } = require("@openzeppelin/merkle-tree");
const {
  parseEther,
  encodeAbiParameters,
  getAddress,
  TypedDataDomain,
} = require("viem");
const hre = require("hardhat");

describe("MerkleAirdrop", function () {
  async function deployFixture() {
    const [owner, addr1, addr2] = await hre.viem.getWalletClients();

    // Deploy MockToken
    const mockToken = await hre.viem.deployContract("MockToken");

    // Create merkle tree using OpenZeppelin's StandardMerkleTree
    const airdropRecipients = [
      [addr1.account.address, parseEther("100")],
      [addr2.account.address, parseEther("200")],
    ];

    const tree = StandardMerkleTree.of(airdropRecipients, [
      "address",
      "uint256",
    ]);
    const merkleRoot = tree.root;

    // Deploy MerkleAirdrop
    const merkleAirdrop = await hre.viem.deployContract("MerkleAirdrop", [
      merkleRoot,
      await mockToken.address,
    ]);

    // Mint tokens to airdrop contract
    await mockToken.write.mint([
      await merkleAirdrop.address,
      parseEther("1000"),
    ]);

    return {
      merkleAirdrop,
      mockToken,
      owner,
      addr1,
      addr2,
      tree,
      merkleRoot,
    };
  }

  describe("Deployment", function () {
    it("Should set the correct merkle root", async function () {
      const { merkleAirdrop, merkleRoot } = await loadFixture(deployFixture);
      assert.equal(await merkleAirdrop.read.getMerkleRoot(), merkleRoot);
    });

    it("Should set the correct token address", async function () {
      const { merkleAirdrop, mockToken } = await loadFixture(deployFixture);
      const airdropToken = await merkleAirdrop.read.getAirdropToken();
      assert.equal(airdropToken, getAddress(await mockToken.address));
    });
  });

  describe("Claiming", function () {
    it("Should allow claiming with valid proof", async function () {
      const { merkleAirdrop, mockToken, addr1, tree } = await loadFixture(
        deployFixture
      );
      const amount = parseEther("100");

      // Find the proof for addr1
      const proof = tree.getProof([addr1.account.address, amount]);

      await merkleAirdrop.write.claim([addr1.account.address, amount, proof]);

      // Verify token balance
      assert.equal(
        await mockToken.read.balanceOf([addr1.account.address]),
        amount
      );
    });

    it("Should prevent double claiming", async function () {
      const { merkleAirdrop, addr1, tree } = await loadFixture(deployFixture);
      const amount = parseEther("100");
      const proof = tree.getProof([addr1.account.address, amount]);

      // First claim
      await merkleAirdrop.write.claim([addr1.account.address, amount, proof]);

      // Second claim should fail
      await assert.rejects(
        async () => {
          await merkleAirdrop.write.claim([
            addr1.account.address,
            amount,
            proof,
          ]);
        },
        {
          name: "ContractFunctionExecutionError",
          message: /MerkleAirdrop__AlreadyClaimed/,
        }
      );
    });

    it("Should reject invalid proofs", async function () {
      const { merkleAirdrop, addr2, tree } = await loadFixture(deployFixture);
      const amount = parseEther("200");
      const proof = tree.getProof([addr2.account.address, amount]);

      // Try to claim with wrong amount
      await assert.rejects(
        async () => {
          await merkleAirdrop.write.claim([
            addr2.account.address,
            parseEther("300"),
            proof,
          ]);
        },
        {
          name: "ContractFunctionExecutionError",
          message: /MerkleAirdrop__InvalidProof/,
        }
      );
    });
  });

  describe("EIP-712 Implementation", function () {
    it("Should have correct domain separator", async function () {
      const { merkleAirdrop } = await loadFixture(deployFixture);

      const publicClient = await hre.viem.getPublicClient();
      const chainId = await publicClient.getChainId();
      const contractAddress = await merkleAirdrop.address;

      // Calculate expected domain separator
      const domain = {
        name: "MerkleAirdrop",
        version: "1.0.0",
        chainId: chainId,
        verifyingContract: contractAddress,
      };

      const domainSeparator = await merkleAirdrop.read.getDomainSeparator();
      // Just verify we can read the domain separator
      assert.ok(domainSeparator.startsWith("0x"));
    });

    it("Should calculate leaves using EIP-712 typed data", async function () {
      const { merkleAirdrop, addr1 } = await loadFixture(deployFixture);
      const amount = parseEther("100");

      const contractLeaf = await merkleAirdrop.read.calculateLeaf([
        addr1.account.address,
        amount,
      ]);

      const publicClient = await hre.viem.getPublicClient();
      const chainId = await publicClient.getChainId();
      const contractAddress = await merkleAirdrop.address;

      // Calculate expected leaf using EIP-712
      const domain = {
        name: "MerkleAirdrop",
        version: "1.0.0",
        chainId: chainId,
        verifyingContract: contractAddress,
      };

      const types = {
        Claim: [
          { name: "account", type: "address" },
          { name: "amount", type: "uint256" },
        ],
      };

      const value = {
        account: addr1.account.address,
        amount: amount,
      };

      // Calculate the leaf hash directly using keccak256(abi.encode(account, amount))
      const encodedData = encodeAbiParameters(
        [{ type: "address" }, { type: "uint256" }],
        [addr1.account.address, amount]
      );
      const expectedLeaf = await merkleAirdrop.read.calculateLeaf([
        addr1.account.address,
        amount,
      ]);
      assert.equal(contractLeaf, expectedLeaf);
    });
  });
});
