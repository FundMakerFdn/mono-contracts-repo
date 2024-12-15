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

  await partyB.depositPersonal("10");

  partyB.server.on("connection", async (socket) => {
    // wait for counterparty interaction
    await new Promise((resolve) => setTimeout(resolve, 2000));
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
