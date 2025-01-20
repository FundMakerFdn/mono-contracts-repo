function setNestedVal(obj, path, value) {
  // console.debug("set", path, "=", value);
  let i;
  for (i = 0; i < path.length - 1; i++) obj = obj[path[i]];

  obj[path[i]] = value;
}

class FixValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "FixValidationError";
  }
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

    // Preprocess header/trailer tags
    this.headerReq = (this.dict.header || []).map((tag) => ({
      tag,
      required: true,
    }));
    this.trailerReq = (this.dict.trailer || []).map((tag) => ({
      tag,
      required: true,
    }));
  }

  #calculateChecksum(msg) {
    return (
      msg.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0) % 256
    );
  }

  #encodeSection(stack, result, obj) {
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
        const groupInfo = this.dict.groups[tagNum];
        const groupName = groupInfo?.name;
        const groupData = obj[groupName] || [];

        const isRequired = tagInfo.required;
        if (isRequired || groupData.length > 0) {
          result.push(`${tagNum}=${groupData.length}`);

          if (groupData.length > 0) {
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
  }

  encode(fixObj) {
    if (!this.validateObjThrow(fixObj)) return false;

    // Split encoding into header, body, and trailer parts
    const header = [];
    const body = [];
    const trailer = [];

    // Process body first to calculate length
    const bodyStack = [
      { obj: fixObj, tags: this.dict.messages[fixObj.MsgType].body },
    ];
    this.#encodeSection(bodyStack, body, fixObj);

    // Handle BodyLength if it's null
    if (fixObj.BodyLength === null) {
      // 2 separators: header | body | trailer
      fixObj.BodyLength = (body.join(this.fieldSep).length + 2).toString();
    }

    // Handle CheckSum if it's null
    if (fixObj.CheckSum === null) {
      // First encode everything except trailer
      const msgWithoutChecksum = [...header, ...body].join(this.fieldSep);
      const sum = this.#calculateChecksum(msgWithoutChecksum);
      fixObj.CheckSum = sum.toString().padStart(3, "0");
    }

    // Process final header and trailer with all fields
    const headerStack = [{ obj: fixObj, tags: this.headerReq }];
    const trailerStack = [{ obj: fixObj, tags: this.trailerReq }];

    this.#encodeSection(headerStack, header, fixObj);
    this.#encodeSection(trailerStack, trailer, fixObj);

    // Combine all parts
    return [...header, ...body, ...trailer].join(this.fieldSep);
  }

  validateObj(fixObj) {
    try {
      validateObjThrow(fixObj);
      return true;
    } catch (e) {
      // FixValidationError
      return false;
    }
  }
  validateObjThrow(fixObj) {
    // Validate header fields
    for (const tagInfo of this.headerReq) {
      const tagDef = this.dict.tags[tagInfo.tag];
      if (tagInfo.required && !(tagDef.name in fixObj)) {
        throw new FixValidationError(
          `Missing required header field: ${tagDef.name}`
        );
      }
    }

    // Validate message type and get message definition
    if (!("MsgType" in fixObj)) {
      throw new FixValidationError("Missing required field: MsgType");
    }
    const msgDef = this.dict.messages[fixObj.MsgType];
    if (!msgDef) {
      throw new FixValidationError(`Invalid message type: ${fixObj.MsgType}`);
    }

    // Validate trailer fields
    for (const tagInfo of this.trailerReq) {
      const tagDef = this.dict.tags[tagInfo.tag];
      if (tagInfo.required && !(tagDef.name in fixObj)) {
        throw new FixValidationError(
          `Missing required trailer field: ${tagDef.name}`
        );
      }
    }

    // Validate message body fields and groups
    const validateGroup = (obj, groupTags, path = "") => {
      // Check for extra fields
      const allowedFields = new Set([
        ...this.headerReq.map((t) => this.dict.tags[t.tag].name),
        ...this.trailerReq.map((t) => this.dict.tags[t.tag].name),
        ...groupTags.map((t) => {
          const tag = typeof t === "object" ? t.tag : t;
          const tagDef = this.dict.tags[tag];
          if (tagDef.type === "NumInGroup") {
            return this.dict.groups[tag].name;
          }
          return tagDef.name;
        }),
      ]);

      for (const field in obj) {
        if (!allowedFields.has(field)) {
          throw new FixValidationError(`Unknown field ${path}${field}`);
        }
      }

      // Validate each tag/group
      for (const tagInfo of groupTags) {
        const tag = typeof tagInfo === "object" ? tagInfo.tag : tagInfo;
        const required = tagInfo.required || false;
        const tagDef = this.dict.tags[tag];

        if (tagDef.type === "NumInGroup") {
          const groupInfo = this.dict.groups[tag];
          const groupName = groupInfo.name;
          const groupData = obj[groupName];

          if (required && (!groupData || groupData.length === 0)) {
            throw new FixValidationError(
              `Missing required group: ${path}${groupName}`
            );
          }

          if (groupData && groupData.length > 0) {
            const groupTags = groupInfo.tags
              .slice(1)
              .map((t) => ({ tag: t, required: true }));
            for (let i = 0; i < groupData.length; i++) {
              validateGroup(
                groupData[i],
                groupTags,
                `${path}${groupName}[${i}].`
              );
            }
          }
        } else {
          const fieldName = tagDef.name;
          if (required && !(fieldName in obj)) {
            throw new FixValidationError(
              `Missing required field: ${path}${fieldName}`
            );
          }
        }
      }
    };

    // Start validation with message body
    validateGroup(fixObj, msgDef.body);
    return true;
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
        // console.log("Group itemCount tagPerItem", groupCount, grTagCount);
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
          // console.log("counter", counterStack);
        }
      }
    }
    if (!this.validateObjThrow(fixObj)) return false;
    return fixObj;
  }
}

module.exports = pSymmFIX;
