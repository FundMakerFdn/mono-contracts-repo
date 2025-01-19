function setNestedVal(obj, path, value) {
  console.debug("set", path, "=", value);
  let i;
  for (i = 0; i < path.length - 1; i++) obj = obj[path[i]];

  obj[path[i]] = value;
}

class pSymmFIX {
  #dicts = {
    MockFIX: "#data/mock-fix.json",
    pSymmFIX: "#data/psymm-fix.json",
  };
  constructor(version, fieldSep = "|") {
    this.version = version;
    this.fieldSep = fieldSep;
    this.dict = require(this.#dicts[version]);

    // Prefetch groupName => tagNum dict (for validateObj)
    this.groupNameToNum = Object.entries(this.dict.groups).reduce(
      (acc, [tag, info]) => {
        acc[info.name] = tag;
        return acc;
      },
      {}
    );

    // Prefetch tagName => tagNum dict (for validateObj)
    this.tagNameToNum = Object.entries(this.dict.tags).reduce(
      (acc, [tag, info]) => {
        acc[info.name] = tag;
        return acc;
      },
      {}
    );
  }

  encode(fixObj) {
    if (!this.validateObj(fixObj)) return false;

    const result = [];
    const stack = [
      { obj: fixObj, tags: this.dict.messages[fixObj.MsgType].tags },
    ];

    while (stack.length > 0) {
      const current = stack[stack.length - 1];
      const { obj, tags } = current;

      if (!current.tagIndex) current.tagIndex = 0;

      if (current.tagIndex >= tags.length) {
        stack.pop();
        continue;
      }

      const tagInfo = tags[current.tagIndex++];
      const tagNum = tagInfo.tag;
      const tagDef = this.dict.tags[tagNum];

      if (tagDef.type === "NumInGroup") {
        // Find corresponding group info
        const groupInfo = this.dict.groups[tagNum];
        const groupName = groupInfo?.name;
        const groupData = obj[groupName] || [];

        // Only include group if it's required or has content
        const isRequired = tagInfo.required;
        if (isRequired || groupData.length > 0) {
          // Add group count
          result.push(`${tagNum}=${groupData.length}`);

          if (groupData.length > 0) {
            // Push group items to stack
            const groupTags = groupInfo.tags
              .slice(1)
              .map((tag) => ({ tag, required: true }));
            for (let i = groupData.length - 1; i >= 0; i--) {
              stack.push({
                obj: groupData[i],
                tags: groupTags,
                tagIndex: 0,
              });
            }
          }
        }
      } else {
        const fieldName = tagDef.name;
        if (fieldName in obj) {
          result.push(`${tagNum}=${obj[fieldName]}`);
        }
      }
    }

    return result.join(this.fieldSep);
  }

  validateObj(fixObj) {
    // Check BeginString matches version
    if (fixObj?.BeginString !== this.version) return false;

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
        const groupInfo = this.dict.groups[tag];
        if (groupInfo) {
          // For group tags, check if group name exists
          if (!(groupInfo.name in obj)) return false;
        } else {
          // For regular tags, check field name
          const fieldName = this.dict.tags[tag].name;
          if (!(fieldName in obj)) return false;
        }
      }

      // Check no extra tags
      for (const field in obj) {
        // Skip if field is a known group name
        if (field in this.groupNameToNum) continue;

        const tagNum = this.tagNameToNum[field];

        // Check if this tag is a group start tag
        const isGroupStart = tagNum in this.dict.groups;
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

        const groupTag = this.groupNameToNum[key];
        if (!groupTag) return false;
        const groupInfo = this.dict.groups[groupTag];

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

    const pairs = fixStr.split(this.fieldSep);

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

        const groupInfo = this.dict.groups[tagNum];
        if (groupInfo) {
          grName = groupInfo.name;
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
                lastCounter.tagsLeft--;
              }
            }
          }

          path.push(fieldName);
          setNestedVal(fixObj, path, fieldValue);
          console.log("counter", counterStack);
        }
      }
    }
    if (!this.validateObj(fixObj)) return false;
    return fixObj;
  }
}

module.exports = pSymmFIX;
