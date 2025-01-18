class pSymmFIX {
  constructor(version) {
    this.version = version;
    this.dict = {
      // TODO: import json
      tags: {},
      groups: {},
      messages: {},
    };
  }

  encode(fixObj) {
    let fixStr = "";
    // validate obj
    // encode
    return fixStr;
  }

  isNumInGroup(tag) {
    return this.dict.tags[tag]?.type === 'NumInGroup';
  }

  getGroupByCounter(tag) {
    return Object.values(this.dict.groups).find(group => group.tags[0] === tag);
  }

  isLastInGroup(tag, currentPath) {
    if (!currentPath.length) return false;
    const currentGroup = this.dict.groups[currentPath[currentPath.length - 1]];
    return currentGroup?.tags[currentGroup.tags.length - 1] === tag;
  }

  decode(fixStr) {
    // Split into tag-value pairs
    const pairs = fixStr.split('|').map(pair => {
      const [tag, value] = pair.split('=');
      return { tag: parseInt(tag), value };
    });

    // Initialize context tracking
    let fixObj = {};
    let currentPath = [];
    let groupCounters = {};
    let currentTarget = fixObj;
    let parentStack = [fixObj];

    for (const {tag, value} of pairs) {
      // Handle NumInGroup fields (start of group)
      if (this.isNumInGroup(tag)) {
        const group = this.getGroupByCounter(tag);
        if (!group) continue;

        const groupName = group.name;
        const count = parseInt(value);
        
        // Initialize group tracking
        groupCounters[groupName] = count;
        currentPath.push(groupName);
        
        // Create array for group items
        currentTarget[groupName] = [];
        if (count > 0) {
          // Create first group item
          const newGroupItem = {};
          currentTarget[groupName].push(newGroupItem);
          parentStack.push(currentTarget);
          currentTarget = newGroupItem;
        }
        continue;
      }

      // Add field to current target
      currentTarget[this.dict.tags[tag]?.name || tag] = value;

      // Check if we're at end of a group
      if (this.isLastInGroup(tag, currentPath)) {
        const currentGroup = currentPath[currentPath.length - 1];
        groupCounters[currentGroup]--;

        if (groupCounters[currentGroup] > 0) {
          // More items in this group - create new item
          const newGroupItem = {};
          parentStack[parentStack.length - 1][currentGroup].push(newGroupItem);
          currentTarget = newGroupItem;
        } else {
          // Group is complete
          currentPath.pop();
          delete groupCounters[currentGroup];
          currentTarget = parentStack.pop();
        }
      }
    }

    return fixObj;
  }
}

module.exports = pSymmFIX;
