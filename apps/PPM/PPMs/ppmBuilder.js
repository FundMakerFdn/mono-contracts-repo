import {
  keccak256,
  toHex,
  parseAbiParameters,
  encodeAbiParameters,
  concat,
} from "viem";

class PPMBuilder {
  constructor() {
    this.ppmItems = [];
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
    const item = { ..._item };
    if (item.type === "callSMA") {
      const calldata = this.encodeCalldata(
        item.args.calldata.type,
        item.args.calldata.args
      );
      item.args.calldata = calldata;
    }

    const expanded = this.expandObject(item);
    this.ppmItems.push(...expanded);
    return expanded;
  }

  getPPM() {
    return this.ppmItems;
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

    console.log(selector, params);
    console.log(concat([selector, params]));
  }
}

export { PPMBuilder };
