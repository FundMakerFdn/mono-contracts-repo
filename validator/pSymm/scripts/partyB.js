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
  const walletClient = (await hre.viem.getWalletClients())[1]; // Use second wallet

  const partyB = new PSymmParty({
    address: walletClient.account.address,
    port: 3002,
    counterpartyUrl: "http://127.0.0.1:3001",
    walletClient,
    pSymm,
    mockSymm,
  });

  await partyB.start();

  // Get PartyA's address
  const partyAAddress = (await hre.viem.getWalletClients())[0].account.address;

  // Execute flow
  await partyB.deposit("10");

  // PartyB waits for and responds to PartyA's messages
  // The socket handlers will automatically sign and respond

  // Keep running until interrupted
  await new Promise((resolve) => {
    process.on("SIGINT", () => {
      partyB.stop();
      resolve();
    });
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
