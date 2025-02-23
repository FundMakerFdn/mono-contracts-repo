const assert = require("node:assert/strict");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox-viem/network-helpers");
const { parseEther, keccak256, toHex, signMessage, getAddresses, bytesToHex,padHex } = require("viem");
const hre = require("hardhat");
const { deployTestFixture } = require("./noirPsymm.deployment");
const { CHAIN_ID, partyAKey, partyBKey } = require("./globalVariables");
const { secp256k1 } = require("@noble/curves/secp256k1");
const { StandardMerkleTree } = require("@openzeppelin/merkle-tree");

function getEthAddress(pubKey) {
    // Get uncompressed public key and remove '04' prefix
    const uncompressed = pubKey.toRawBytes(false).slice(1);
    // Take keccak256 hash and get last 20 bytes
    const address = '0x' + keccak256(bytesToHex(uncompressed)).slice(-40);
    return address;
  }

function getMetamaskPrivateKey(privKey) {
    // Convert to hex and pad to 32 bytes (64 characters) with leading zeros
    return '0x' + privKey.toString(16).padStart(64, '0');
}
  
  
function shouldCustodyToAddress() {
  describe("Test custodyToAddress", function () {
    it("should transfer tokens from custody to an external address", async function () {
      let tx;

      async function processTx() {
        await publicClient.waitForTransactionReceipt({ hash: tx });
      }

      const { noirPsymm, mockUSDC, deployer, partyA, partyB, publicClient } = await loadFixture(deployTestFixture);
      const partyAAddress = await  partyA.getAddresses();
      const partyBAddress = await partyB.getAddresses();
      const partyAPub = partyAAddress[0];
      const partyBPub = partyBAddress[0];
      const privKey1 = BigInt(bytesToHex(secp256k1.utils.randomPrivateKey()));
  const privKey2 = BigInt(bytesToHex(secp256k1.utils.randomPrivateKey()));
      const partyAPubKey = secp256k1.ProjectivePoint.BASE.multiply(privKey1);
      const partyBPubKey = secp256k1.ProjectivePoint.BASE.multiply(privKey2);
      const combinedPrivKey = (privKey1 + privKey2) % secp256k1.CURVE.n;
      const combinedPubKey = secp256k1.ProjectivePoint.BASE.multiply(combinedPrivKey);


      console.log("partyAPubKey", privKey1, partyAPubKey);
      console.log("partyBPubKey", privKey2, partyBPubKey);
      console.log("combinedPrivKey", getMetamaskPrivateKey(combinedPrivKey));
      console.log("combinedPubKey", getEthAddress(combinedPubKey));
      console.log("partyAPub", partyAPub);
      // Transfer tokens to the noirPsymm contract so it can forward tokens
      const funding = parseEther("1000");
      tx = await mockUSDC.write.mint([partyAPub, funding]);
      processTx()
      tx = await mockUSDC.write.mint([partyBPub, funding]);
      processTx()
      //approve
      tx = await mockUSDC.write.approve([noirPsymm.address, funding], { account: partyAPub });
      processTx()
      tx = await mockUSDC.write.approve([noirPsymm.address, funding], { account: partyBPub });
      processTx()

      const pubKey1 = secp256k1.ProjectivePoint.BASE.multiply(partyAPubKey);
      const pubKey2 = secp256k1.ProjectivePoint.BASE.multiply(partyBPubKey);
      // Combine private keys (modular addition)

      const combinedPubKeyAlt = partyAPub.add(partyBPub);
      console.log("Combined Public Key:", combinedPubKey.toHex(true));
      console.log("Combined Public Key (alt):", combinedPubKeyAlt.toHex(true));



    const values = [
        "custodyToAddress",
        CHAIN_ID.HARDHAT,
        noirPsymm.address,
        0,
        partyAPub,
        combinedPubKey
        ];
        console.log("Merkle tree leaves: ", values);
    
        const tree = StandardMerkleTree.of(values, [
        "string", // entry type
        "uint256", // chainId
        "address", // pSymm
        "uint8", // state
        "address", // _destination
        "address", // _signer
        ]);


      // addressToCustody
      const commitmentA0 = keccak256(
        toHex(
          hre.ethers.utils.defaultAbiCoder.encode(
            ["string", "uint256", "address", "uint8", "address", "address"],
            ["custodyToAddress", CHAIN_ID.HARDHAT, noirPsymm.address, 0, partyAPub, partyAPub]
          )
        )
      );
      const commitmentB0 = keccak256(
        toHex(
          hre.ethers.utils.defaultAbiCoder.encode(
            ["string", "uint256", "address", "uint8", "address", "address"],
            ["custodyToAddress", CHAIN_ID.HARDHAT, noirPsymm.address, 0, partyBPub, partyBPub]
          )
        )
      );

      tx = await noirPsymm.write.addressToCustody([commitmentA0, funding, mockUSDC.address], { account: partyA.account });
      processTx()
      const balance = await mockUSDC.read.balanceOf([noirPsymm.address]);
      assert.equal(balance, funding);

      tx = await noirPsymm.write.addressToCustody([commitmentB0, funding, mockUSDC.address], { account: partyB.account });
      processTx()
      
      
      const { signMessage } = require("viem");
      const signatureA = await signMessage({ privateKey: partyA.account.privateKey, message: ethSignedMessageHash });
      const signatureB = await signMessage({ privateKey: partyB.account.privateKey, message: ethSignedMessageHash });
      const multiSig = signatureA + signatureB.slice(2);
      

      const nextIndex = await noirPsymm.read.nextIndex([]);
       
    });

   
  });
}

module.exports = { shouldCustodyToAddress };
