import { getContractAddresses } from "@fundmaker/pSymmFIX/get-contracts";
import { pSymmUtils } from "@fundmaker/pSymmFIX";

const displayParty = ({ role, address, ipAddress, pubKey }) => {
  console.log(`\nRole: ${role}`);
  console.log(`Address: ${address}`);
  console.log(`IP Address: ${ipAddress}`);
  console.log(`Public Key:`);
  console.log(`  Parity: ${pubKey.parity}`);
  console.log(`  X: ${pubKey.x}`);
};

const listParties = async () => {
  try {
    const parties = await new pSymmUtils(
      await getContractAddresses()
    ).getParties();

    console.log("\nRegistered Parties:");
    console.log("==================");

    parties.forEach(displayParty);
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
};

listParties();
