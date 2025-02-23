import {
  keccak256,
  toHex,
  parseAbiParameters,
  encodeAbiParameters,
  concat,
  pad,
} from "viem";
import { StandardMerkleTree } from "@openzeppelin/merkle-tree";

class PPMBuilder {
  constructor() {
    this.ppmItems = [];
    this.argsToTypes = {
      deploySMA: "string smaType,address factoryAddress,bytes callData",
      callSMA: "string smaType,address smaAddress,bytes callData",
      custodyToAddress: "address receiver",
      custodyToSMA: "string smaType,address token",
      changeCustodyState: "uint8 newState",
    };
  }

  // Expands object combinations for array values in party, chainId, and state
  expandObject(obj) {
    const keysToExpand = ["party", "chainId", "state"];

    const arrays = Object.fromEntries(
      keysToExpand
        .filter((key) => key in obj)
        .map((key) => [key, Array.isArray(obj[key]) ? obj[key] : [obj[key]]])
    );

    if (Object.keys(arrays).length === 0) return [obj];

    const combinations = Object.entries(arrays).reduce(
      (acc, [key, values]) => {
        return acc.flatMap((combo) =>
          values.map((value) => ({ ...combo, [key]: value }))
        );
      },
      [{}]
    );

    const baseObj = { ...obj };
    keysToExpand.forEach((key) => delete baseObj[key]);

    return combinations.map((combo) => ({ ...baseObj, ...combo }));
  }

  addItem(_item) {
    const item = { ..._item }; // copy by value
    if (item.type === "callSMA") {
      const callData = this.encodeCalldata(
        item.args.callData.type,
        item.args.callData.args
      );
      item.args.callData = callData;
    }
    const parsed = parseAbiParameters(this.argsToTypes[item.type]).slice(
      0,
      item.args.length
    );

    const argList = [];
    for (const { name } of parsed) {
      argList.push(item.args[name]);
    }

    item.args = encodeAbiParameters(parsed, argList);
    console.log("Full encoded args:", item.args);

    const expanded = this.expandObject(item);
    this.ppmItems.push(...expanded);
    return expanded;
  }

  getPPM() {
    return this.ppmItems;
  }

  buildTreeRoot() {
    const values = this.ppmItems.map((item) => [
      item.type,
      item.chainId,
      item.pSymm,
      item.state,
      item.args,
      item.party.parity,
      pad(item.party.x),
    ]);
    console.log("Merkle tree leaves: ", values);

    const tree = StandardMerkleTree.of(values, [
      "string", // entry type
      "uint256", // chainId
      "address", // pSymm
      "uint8", // state
      "bytes", // abi.encode(args)
      "uint8", // party.parity
      "bytes32", // party.x
    ]);

    return tree.root;
  }

  encodeCalldata(funcType, funcArgs) {
    // funcType example: "borrow(address,uint256)"
    // Compute the function selector (first 4 bytes of keccak256 of the function signature)
    const selector = keccak256(toHex(funcType)).slice(0, 10); // selector is 0x01020304

    // Extract parameter types from funcType
    const paramTypes = funcType.slice(
      funcType.indexOf("(") + 1,
      funcType.lastIndexOf(")")
    );

    const params = encodeAbiParameters(
      // support partial calldata in funcArgs
      parseAbiParameters(paramTypes).slice(0, funcArgs.length),
      funcArgs
    );

    const callData = concat([selector, params]);
    console.log("Encoded callData:", callData);

    return callData;
  }
}

export { PPMBuilder };
