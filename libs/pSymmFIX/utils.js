import { hardhat } from "viem/chains";
import { getContract, createPublicClient, http, custom } from "viem";

export class pSymmUtils {
  constructor(contracts) {
    let transport;
    if (typeof window !== "undefined") transport = custom(window.ethereum);
    else transport = http();

    this.client = createPublicClient({ chain: hardhat, transport });
    this.contracts = contracts;
  }

  async getParties() {
    // Get PartyRegistry contract instance
    const partyRegistry = getContract({
      address: this.contracts.partyRegistry,
      abi: [
        {
          inputs: [
            {
              internalType: "address",
              name: "",
              type: "address",
            },
          ],
          name: "partys",
          outputs: [
            {
              internalType: "string",
              name: "role",
              type: "string",
            },
            {
              internalType: "string",
              name: "ipAddress",
              type: "string",
            },
            {
              components: [
                {
                  internalType: "uint8",
                  name: "parity",
                  type: "uint8",
                },
                {
                  internalType: "bytes32",
                  name: "x",
                  type: "bytes32",
                },
              ],
              internalType: "struct Schnorr.PPMKey",
              name: "pubKey",
              type: "tuple",
            },
          ],
          stateMutability: "view",
          type: "function",
        },
      ],
      client: this.client,
    });

    // Get all PartyRegistered events
    const partyRegisteredEvents = await this.client.getLogs({
      address: this.contracts.partyRegistry,
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
  }
}
