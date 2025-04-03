const hre = require("hardhat");
const { getContractAddresses } = require("#root/apps/PSYMM-OTC/common.js");

async function main() {
  const publicClient = await hre.viem.getPublicClient();
  const addresses = getContractAddresses();

  // Get PartyRegistry contract instance
  const partyRegistry = await hre.viem.getContractAt("PartyRegistry", addresses.partyRegistry);

  // Get all PartyRegistered events
  const partyRegisteredEvents = await publicClient.getLogs({
    address: addresses.partyRegistry,
    event: {
      anonymous: false,
      inputs: [
        { indexed: false, name: "role", type: "string" },
        { indexed: true, name: "party", type: "address" },
        { indexed: false, name: "ipAddress", type: "string" },
        { indexed: false, name: "pubKey", type: "tuple",
          components: [
            { name: "parity", type: "uint8" },
            { name: "x", type: "bytes32" }
          ]
        }
      ],
      name: "PartyRegistered",
      type: "event"
    },
    fromBlock: 0n
  });

  console.log("\nRegistered Parties:");
  console.log("==================");

  for (const event of partyRegisteredEvents) {
    const { role, party, ipAddress, pubKey } = event.args;

    // Get additional party data from contract
    const partyData = await partyRegistry.read.partys([party]);

    console.log(`\nRole: ${role}`);
    console.log(`Address: ${party}`);
    console.log(`IP Address: ${ipAddress}`);
    console.log(`Public Key:`);
    console.log(`  Parity: ${pubKey.parity}`);
    console.log(`  X: ${pubKey.x}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
