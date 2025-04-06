import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const getContractAddresses = async () => {
  const contractsPath = join(__dirname, 'contracts.json');
  const contractsData = await readFile(contractsPath, 'utf8');
  return JSON.parse(contractsData);
};

export const getParties = async (client) => {
  const publicClient = await client.getPublicClient();
  const addresses = await getContractAddresses();

  // Get PartyRegistry contract instance
  const partyRegistry = await client.getContractAt(
    "PartyRegistry",
    addresses.partyRegistry
  );

  // Get all PartyRegistered events
  const partyRegisteredEvents = await publicClient.getLogs({
    address: addresses.partyRegistry,
    event: {
      anonymous: false,
      inputs: [
        { indexed: false, name: "role", type: "string" },
        { indexed: true, name: "party", type: "address" },
        { indexed: false, name: "ipAddress", type: "string" },
        {
          indexed: false,
          name: "pubKey",
          type: "tuple",
          components: [
            { name: "parity", type: "uint8" },
            { name: "x", type: "bytes32" },
          ],
        },
      ],
      name: "PartyRegistered",
      type: "event",
    },
    fromBlock: 0n,
  });

  const parties = [];
  for (const event of partyRegisteredEvents) {
    const { role, party, ipAddress, pubKey } = event.args;
    const partyData = await partyRegistry.read.partys([party]);
    parties.push({
      role,
      address: party,
      ipAddress,
      pubKey,
      data: partyData,
    });
  }

  return parties;
};
