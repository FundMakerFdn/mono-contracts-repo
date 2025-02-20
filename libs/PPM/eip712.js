import { encodeAbiParameters, parseAbiParameters, keccak256 } from "viem";

const PPM_DOMAIN = {
  name: "PPM",
  version: "1",
  chainId: 1, // This should be configurable
  verifyingContract: "0x0000000000000000000000000000000000000000", // This should be configurable
};

const PPM_TYPES = {
  PPMLeaf: [
    { name: "index", type: "uint256" },
    { name: "actionType", type: "string" },
    { name: "chainId", type: "uint256" },
    { name: "pSymm", type: "address" },
    { name: "party", type: "address" },
    { name: "encodedArgs", type: "bytes" },
  ],
};

function hashDomain(domain) {
  return keccak256(
    encodeAbiParameters(
      parseAbiParameters(
        "bytes32 nameHash, bytes32 versionHash, uint256 chainId, address verifyingContract"
      ),
      [
        keccak256(new TextEncoder().encode(domain.name)),
        keccak256(new TextEncoder().encode(domain.version)),
        BigInt(domain.chainId),
        domain.verifyingContract,
      ]
    )
  );
}

function encodeType(typeName, types) {
  const [primary, ...deps] = findDependencies(typeName, types);
  const allTypes = [primary, ...deps].sort();
  return allTypes
    .map((type) => {
      const [name, fields] = type;
      return `${name}(${fields
        .map(({ name, type }) => `${type} ${name}`)
        .join(",")})`;
    })
    .join("");
}

function findDependencies(primaryType, types, deps = []) {
  deps.includes(primaryType) || deps.push(primaryType);
  for (const field of types[primaryType]) {
    const match = field.type.match(/^\w*/);
    if (match && types[match[0]] && !deps.includes(match[0])) {
      findDependencies(match[0], types, deps);
    }
  }
  return deps.map((type) => [type, types[type]]);
}

function hashType(primaryType, types) {
  return keccak256(new TextEncoder().encode(encodeType(primaryType, types)));
}

function hashStruct(primaryType, data, types) {
  const encodedData = types[primaryType].map((field) => {
    let value = data[field.name];
    if (field.type === "string" || field.type === "bytes") {
      return keccak256(new TextEncoder().encode(value));
    }
    return value;
  });

  return keccak256(
    encodeAbiParameters(
      parseAbiParameters(
        types[primaryType].map((field) => field.type).join(",")
      ),
      encodedData
    )
  );
}

export function hashPPMLeaf(leaf) {
  const domain = {
    ...PPM_DOMAIN,
    chainId: leaf.chainId,
  };

  const encodedArgs = leaf.args
    ? encodeAbiParameters(
        parseAbiParameters(
          leaf.type === "transfer"
            ? "address receiver, uint256 amount"
            : "bytes32 trace"
        ),
        leaf.type === "transfer"
          ? [leaf.args.receiver, leaf.args.amount]
          : [leaf.args.trace]
      )
    : "0x";

  const structData = {
    index: BigInt(leaf.index),
    actionType: leaf.type,
    chainId: BigInt(leaf.chainId),
    pSymm: leaf.pSymm,
    party: leaf.party,
    encodedArgs,
  };

  const domainHash = hashDomain(domain);
  const typeHash = hashType("PPMLeaf", PPM_TYPES);
  const structHash = hashStruct("PPMLeaf", structData, PPM_TYPES);

  return keccak256(
    encodeAbiParameters(
      parseAbiParameters(
        "bytes32 domainHash, bytes32 typeHash, bytes32 structHash"
      ),
      [domainHash, typeHash, structHash]
    )
  );
}
