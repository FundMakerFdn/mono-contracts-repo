const assert = require("node:assert/strict");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox-viem/network-helpers");
const { createWalletClient, http, parseEther, keccak256, toHex, signMessage, getAddresses, bytesToHex,padHex } = require("viem");
const hre = require("hardhat");
const { CHAIN_ID, partyAKey, partyBKey } = require("./globalVariables");
const { secp256k1 } = require("@noble/curves/secp256k1");



function getEthAddress(pubKey) {
  const uncompressed = pubKey.toRawBytes(false).slice(1);
  const address = '0x' + keccak256(bytesToHex(uncompressed)).slice(-40);
  return address;
}

function getPrivateKey(privKey) {
  return '0x' + privKey.toString(16).padStart(64, '0');
}


const privKey1 = BigInt("108078771984830124600355193204788566298491186505099151973852777160369603407622");
const privKey2 = BigInt("7891829825022353305250989758951738829770690738760132127959515379927448105508");
const partyAPubKey = secp256k1.ProjectivePoint.BASE.multiply(privKey1);
const partyBPubKey = secp256k1.ProjectivePoint.BASE.multiply(privKey2);
const combinedPrivKey = (privKey1 + privKey2) % secp256k1.CURVE.n;
const combinedPubKey = secp256k1.ProjectivePoint.BASE.multiply(combinedPrivKey);
const partyAPubKey0 = getPrivateKey(privKey1);    
const partyBPubKey0 = getPrivateKey(privKey2);
const combinedPubKey0 = getPrivateKey(combinedPrivKey);

async function deployTestFixture() {
  const [deployer] = await hre.viem.getWalletClients();
  const rpcUrl = process.env.RPC_URL || "http://localhost:8545";
  
  const partyA = createWalletClient({
    account: partyAPubKey0, 
    chain: CHAIN_ID.HARDHAT,
    transport: http(rpcUrl)
  }); 
  const partyB = createWalletClient({
    account: partyBPubKey0, 
    chain: CHAIN_ID.HARDHAT,
    transport: http(rpcUrl)
  });
  const combinedClient = createWalletClient({
    account: combinedPubKey0, 
    chain: CHAIN_ID.HARDHAT,
    transport: http(rpcUrl)
  });

  const partyAAddress = await  partyA.getAddresses();
  const partyBAddress = await partyB.getAddresses();
  const combinedAddress = await combinedClient.getAddresses();
  const partyAPub = partyAAddress[0];
  const partyBPub = partyBAddress[0];
  const combinedPub = combinedAddress[0];
  
console.log("combinedPubKey", getEthAddress(combinedPubKey));
console.log("combinedPub", combinedPub);

  const publicClient = await hre.viem.getPublicClient();
  const noirPsymm = await hre.viem.deployContract("noirPsymm", []);
  const mockUSDC = await hre.viem.deployContract("MockUSDC", []);
  return { noirPsymm, mockUSDC, deployer, partyA, partyB, combinedClient, partyAPub, partyBPub, combinedPub, publicClient };
}

function shouldDeployNoirPsymm() {
  it("should deploy successfully", async function () {
    const { noirPsymm } = await loadFixture(deployTestFixture);
    assert.ok(noirPsymm.address, "noirPsymm not deployed");
  });
}

module.exports = {
  shouldDeployNoirPsymm,
  deployTestFixture
};
