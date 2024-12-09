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
    counterpartyUrl: "http://127.0.0.1:3002",
    walletClient,
    pSymm,
    mockSymm,
    // custodyId: process.env.CUSTODY_ID || Math.floor(Math.random() * (2**20)) + 1,
  });

  await partyA.start();

  // Get PartyB's address
  const partyBAddress = (await hre.viem.getWalletClients())[1].account.address;

  // Execute flow
  await partyA.deposit("10");
  await partyA.initiateCustodyFlow(partyBAddress);

  // Wait for counterparty signatures
  await new Promise((resolve) => setTimeout(resolve, 2000));

  await partyA.transferToCustody("5", partyBAddress);

  // Wait for custody operations
  await new Promise((resolve) => setTimeout(resolve, 2000));

  await partyA.closeCustody("5", partyBAddress);
  await partyA.withdraw("5");

  partyA.stop();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
