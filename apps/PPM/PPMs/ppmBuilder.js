// --- Utility to Expand Combinations ---
// Looks for "party", "chainId", and "state" keys.
// If any of these are arrays, produce one object per combination.
function expandObject(obj) {
    const keysToExpand = ["party", "chainId", "state"];
    const arrays = {};
    keysToExpand.forEach((key) => {
      if (obj.hasOwnProperty(key)) {
        arrays[key] = Array.isArray(obj[key]) ? obj[key] : [obj[key]];
      }
    });
    const expandKeys = Object.keys(arrays);
    if (expandKeys.length === 0) return [obj];
  
    const combinations = [];
    function helper(index, current) {
      if (index === expandKeys.length) {
        combinations.push({ ...current });
        return;
      }
      const key = expandKeys[index];
      arrays[key].forEach((value) => {
        current[key] = value;
        helper(index + 1, current);
      });
    }
    helper(0, {});
  
    // Merge each combination with non-expanded properties.
    return combinations.map((combo) => {
      const clone = { ...obj };
      expandKeys.forEach((key) => delete clone[key]);
      return { ...clone, ...combo };
    });
  }

  function addPPM(item) {
    const expanded = expandObject(item);
    ppmItems.push(...expanded);
    return expanded;
  }
  
  export { addPPM };