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

  addPPM(item) {
    const expanded = this.expandObject(item);
    this.ppmItems.push(...expanded);
    return expanded;
  }

  getPPM() {
    return this.ppmItems;
  }
}

export { PPMBuilder };
