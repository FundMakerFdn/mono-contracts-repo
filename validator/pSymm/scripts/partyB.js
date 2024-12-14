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
    walletClient,
    pSymm,
    mockSymm,
  });

  await partyB.start();
  console.log("Waiting for PartyA to connect...");

  // Get PartyA's address
  // const partyAAddress = (await hre.viem.getWalletClients())[0].account.address;

  // Execute flow - only respond to partyA's actions
  await partyB.depositPersonal("10");

  partyB.server.on("connection", async (socket) => {
    // Wait for custody initialization from partyA
    await new Promise((resolve) => setTimeout(resolve, 3000));
    await partyB.dropActionQueue(); // party A executes custody init
    // wait for counterparty transfers
    await new Promise((resolve) => setTimeout(resolve, 4000));
    await partyB.executeOnchain();
  });

  await new Promise((resolve) => {
    process.on("SIGINT", async () => {
      partyB.stop();
      console.log("Withdrawing deposit...");
      await partyB.withdrawPersonal("10");
      resolve();
    });
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
