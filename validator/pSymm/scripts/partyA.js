const MockStorage = require("#root/validator/SettleMaker/storage/mockStorage.js");
const config = require("#root/validator/config.js");
const PSymmParty = require("#root/validator/pSymm/lib/pSymmParty.js");

async function main() {
  const deploymentData = await MockStorage.getDeploymentData(
    config.contractsTempFile
  );

  const pSymm = await hre.viem.getContractAt(
    "pSymm",
    deploymentData.data.contracts.pSymm
  );
  const mockSymm = await hre.viem.getContractAt(
    "MockSymm",
    deploymentData.data.contracts.MockSymm
  );
  const walletClient = (await hre.viem.getWalletClients())[0];

  const partyA = new PSymmParty({
    address: walletClient.account.address,
    port: 3001,
    walletClient,
    pSymm,
    mockSymm,
  });

  await partyA.start();
  await partyA.connectToCounterparty("http://127.0.0.1:3002");

  // Get PartyB's address
  const partyBAddress = (await hre.viem.getWalletClients())[1].account.address;

  // Execute flow
  await partyA.deposit("10");

  // Generate bilateral custody ID
  const bilateralCustodyId = Math.floor(Math.random() * 2 ** 20) + 1;

  await partyA.initiateCustodyFlow(partyBAddress, bilateralCustodyId);

  // Wait for counterparty signatures
  await new Promise((resolve) => setTimeout(resolve, 2000));

  await partyA.transferCustody(
    true,
    "5",
    partyBAddress,
    bilateralCustodyId,
    true
  );

  // Wait for custody operations
  await new Promise((resolve) => setTimeout(resolve, 2000));

  await partyA.transferCustody(
    false,
    "5",
    partyBAddress,
    bilateralCustodyId,
    true
  );
  await partyA.withdraw("10");

  // Print final tree state
  console.log("\nFinal Custody Rollup Tree State:");
  console.log(JSON.stringify(partyA.treeBuilder.getTree(), null, 2));

  partyA.stop();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
