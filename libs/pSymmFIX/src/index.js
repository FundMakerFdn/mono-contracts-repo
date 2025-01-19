const mockFixDict = require("./mock-fix.json");

function setNestedVal(obj, path, value) {
  console.debug("DEBUG XXX", "set", path, "=", value);
  let i;
  for (i = 0; i < path.length - 1; i++) obj = obj[path[i]];

  obj[path[i]] = value;
}

class pSymmFIX {
  constructor(version) {
    this.version = version;
    this.dict = mockFixDict;
  }

  encode(fixObj) {
    if (!this.validateObj(fixObj)) return false;

    // Use the stack-based iterative approach similar to decode()
    // encode should work in one pass like decode does
    // don't create helper functions
    // store state of nestedness in the main stack to track nested groups
    // Instead of setting key: value, just push tagNum=value to result array
    // Order should be respected, iterate over desired tags instead of supplied values.

    return result.join("|");
  }

  validateObj(fixObj) {
    // Get message type and definition
    const msgType = fixObj?.MsgType;
    const msgDef = this.dict.messages[msgType];
    let iota = 0;
    if (!msgDef) return false;

    // Stack for tracking nested group validation
    const stack = [];

    // Track seen tags to validate order and completeness
    const seenTags = new Set();

    // Helper to validate a single group
    const validateGroup = (obj, groupTags) => {
      const required = groupTags.filter((t) => t.required).map((t) => t.tag);
      const all = groupTags.map((t) => t.tag);

      // Check all required tags are present
      for (const tag of required) {
        // Check if this is a group start tag
        const isGroupStart = Object.entries(this.dict.groups).find(
          ([_, group]) => group.tags[0] === tag
        );

        if (isGroupStart) {
          // For group tags, check if group name exists
          if (!(isGroupStart[0] in obj)) return false;
        } else {
          // For regular tags, check field name
          const fieldName = this.dict.tags[tag].name;
          if (!(fieldName in obj)) return false;
        }
      }

      // Check no extra tags
      for (const field in obj) {
        // Skip if field is a known group name
        if (field in this.dict.groups) continue;

        const tagNum = Object.entries(this.dict.tags).find(
          ([_, info]) => info.name === field
        )?.[0];

        // Check if this tag is a group start tag
        const isGroupStart = Object.values(this.dict.groups).some(
          (group) => group.tags[0] === parseInt(tagNum)
        );
        if (isGroupStart) continue;

        if (!tagNum || !all.includes(parseInt(tagNum))) return false;
      }

      return true;
    };

    // Validate main message
    if (!validateGroup(fixObj, msgDef.tags)) return false;

    // Validate nested groups recursively
    const validateNestedGroups = (obj) => {
      for (const [key, value] of Object.entries(obj)) {
        if (!Array.isArray(value)) continue;

        const groupInfo = this.dict.groups[key];
        if (!groupInfo) return false;

        // Validate each item in group
        for (const item of value) {
          if (
            !validateGroup(
              item,
              groupInfo.tags.slice(1).map((tag) => ({ tag, required: true }))
            )
          ) {
            return false;
          }
          // Recursively validate nested groups
          if (!validateNestedGroups(item)) return false;
        }
      }
      return true;
    };

    return validateNestedGroups(fixObj);
  }

  decode(fixStr) {
    const fixObj = {};

    const pairs = fixStr.split("|");

    // Nested group processing
    const counterStack = []; // Stack of {tagsLeft, tagsTotal, groupsLeft} objects
    const currentPath = [];

    for (const pair of pairs) {
      const [tag, value] = pair.split("=");
      const tagNum = tag.toString();
      const tagInfo = this.dict.tags[tagNum];

      if (!tagInfo) continue;

      // Handle regular fields
      let fieldName = tagInfo.name;
      let fieldValue = value;

      if (tagInfo.type === "NumInGroup") {
        const groupCount = parseInt(value);
        let grName, grTagCount;

        // TODO: improve group finding
        for (const [groupName, groupInfo] of Object.entries(this.dict.groups)) {
          if (!groupInfo.tags.includes(parseInt(tagNum))) continue;
          grName = groupName;
          grTagCount = groupInfo.tags.length - 1; // minus No
        }
        // Generate [{}, {}, ...] placeholder for group items
        console.log("Group itemCount tagPerItem", groupCount, grTagCount);
        const placeholder = Array.from({ length: groupCount }, () => ({}));
        setNestedVal(fixObj, [...currentPath, grName], placeholder);
        counterStack.push({
          tagsLeft: grTagCount,
          tagsTotal: grTagCount,
          groupsLeft: groupCount,
        });
        currentPath.push(grName);
        currentPath.push(0);
      } else {
        // Only process field if we're not in an empty group
        if (
          counterStack.length === 0 ||
          counterStack[counterStack.length - 1].groupsLeft > 0
        ) {
          const path = [...currentPath];

          if (counterStack.length > 0) {
            let lastCounter = counterStack[counterStack.length - 1];
            lastCounter.tagsLeft--;

            while (lastCounter.tagsLeft == 0) {
              lastCounter.groupsLeft--;

              if (lastCounter.groupsLeft > 0) {
                // Reset tags counter for next group iteration
                lastCounter.tagsLeft = lastCounter.tagsTotal;
                currentPath[currentPath.length - 1]++; // Increment group index
              } else {
                // Group is complete
                counterStack.pop();
                currentPath.pop(); // Remove group index
                currentPath.pop(); // Remove group name

                if (counterStack.length === 0) {
                  break; // Exit the while loop if no more groups to process
                }

                lastCounter = counterStack[counterStack.length - 1];
                // lastCounter.tagsLeft--;
              }
            }
          }

          path.push(fieldName);
          setNestedVal(fixObj, path, fieldValue);
          console.log("counter", counterStack);
        }
      }
    }
    console.log(JSON.stringify(fixObj), this.validateObj(fixObj));
    // if (!this.validateObj(fixObj)) return false;
    return fixObj;
  }
}

module.exports = pSymmFIX;
