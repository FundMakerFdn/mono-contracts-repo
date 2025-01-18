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
    let fixStr = "";
    // TODO
    return fixStr;
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
        if (counterStack.length === 0 || counterStack[counterStack.length - 1].groupsLeft > 0) {
          const path = [...currentPath];

          if (counterStack.length > 0) {
            let lastCounter = counterStack[counterStack.length - 1];
            lastCounter.tagsLeft--;

            while (lastCounter.tagsLeft === 0) {
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
                lastCounter.tagsLeft--;
                
                if (lastCounter.tagsLeft < 0) {
                  break; // Exit if we've processed all tags
                }
              }
            }
          }

          path.push(fieldName);
          setNestedVal(fixObj, path, fieldValue);
        }
      }
    }
    return fixObj;
  }
}

module.exports = pSymmFIX;
