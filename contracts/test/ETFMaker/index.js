const assert = require("node:assert/strict");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox-viem/network-helpers");
const { keccak256, pad } = require("viem");
const { deployFixture } = require("./deploy");

describe("psymm", function () {
  // Use async function for the test
  it("should allow deposits from address to custody", async function () {
    // Load the fixture
    const {
      psymm, 
      USDC, 
      partyA, 
      partyB, 
      USDC_PRECISION,
      custodyId_A,
      custodyId_B
    } = await loadFixture(deployFixture);
    
    console.log("psymm", psymm.address);
    
    // Check initial balances
    const initialBalanceA = await psymm.read.getCustodyBalances([custodyId_A, USDC.address]);
    console.log("Initial custody balance for partyA:", initialBalanceA.toString());
    
    // Check USDC balance of partyA before deposit
    const partyABalance = await USDC.read.balanceOf([partyA.account.address]);
    console.log("PartyA USDC balance:", partyABalance.toString());
    
    // We need to mint tokens to partyB first
    await USDC.write.mint([partyB.account.address, BigInt(10 * 10 ** USDC_PRECISION)], {
      account: partyB.account
    });
    
    // Approve tokens for deposit from both parties
    await USDC.write.approve([psymm.address, BigInt(10 * 10 ** USDC_PRECISION)], {
      account: partyA.account
    });
    
    await USDC.write.approve([psymm.address, BigInt(10 * 10 ** USDC_PRECISION)], {
      account: partyB.account
    });
    
    // Make deposits to custody
    await psymm.write.addressToCustody(
      [custodyId_A, USDC.address, BigInt(10 * 10 ** USDC_PRECISION)], 
      { account: partyA.account }
    );
    
    await psymm.write.addressToCustody(
      [custodyId_B, USDC.address, BigInt(10 * 10 ** USDC_PRECISION)], 
      { account: partyB.account }
    );
    
    // Check balances after deposits
    const postDepositBalanceA = await psymm.read.getCustodyBalances([custodyId_A, USDC.address]);
    const postDepositBalanceB = await psymm.read.getCustodyBalances([custodyId_B, USDC.address]);
    
    console.log("Post-deposit balance for partyA:", postDepositBalanceA.toString());
    console.log("Post-deposit balance for partyB:", postDepositBalanceB.toString());
    
    // Assert that the balances have increased by the expected amount
    assert.equal(
      postDepositBalanceA.toString(), 
      (BigInt(10 * 10 ** USDC_PRECISION)).toString(), 
      "PartyA's deposit did not update custody balance correctly"
    );
    
    assert.equal(
      postDepositBalanceB.toString(), 
      (BigInt(10 * 10 ** USDC_PRECISION)).toString(), 
      "PartyB's deposit did not update custody balance correctly"
    );
  });
});