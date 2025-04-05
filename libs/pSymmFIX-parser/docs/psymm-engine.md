# pSymm FIX engine architecture

## Sequencer

Keep 2 message queues:

- InputQueue containing {IpAddressFrom, FixMsgStr} (what we receive)
- OutputQueue containing {IpAddressTo, FixMsgStr} (what we send)

This two-queue approach allows easy testing & logging.
To ensure we have no race conditions, a high-load testing of such architecture PoC would be conducted.

### Implementing safe queues

Node.js is concurrent, but single-threaded.

Which means, we can:

- Implement a Queue inheriting EventEmitter with an "update" event when new data.

Subscribe to the queue like this:

```
// async function
while (true) {
    // wait until "update" event
    const data = new Promise(resolve => {
        inputQueue.once("update", resolve);
    });
    // process until we empty input queue
    processNewData();
    // then wait for the next update

    // It is safe because not concurrent.
}
```

This event system differs from the usual `.on()` in a way that we cannot have 2 handlers fired concurrently.
Also, we don't use events for communication, only for signals.
Similarly for OutputQueue.

Then have the following in Sequencer.run method:

```
while (true) {
    // Each run it waits which "update" event happens first - in input or output queue
    await Promise.race([handleInputQueue, handleOutputQueue])
    // handleOutputQueue would send to existing socket or connect to new
}
```

I tried on a mock implementation, this is a viable idea (EventEmitter once + Promise race).
Also I verified we can "rerace" promises - https://stackoverflow.com/a/79028042/7349122

## Communication

- Communicate through WebSocket
- Store an IpAddress -> socket dictionary of active connections

When someone connects:

- on socket message, add to InputQueue {IpAddressFrom, FixMsgStr}
- on OutputQueue.message, send to socket {IpAddressTo, FixMsgStr}
  - Initiates connection to IpAddressTo if no existing
  - We could use Logon msg here, not sure if needed (maybe send party address?) https://fiximate.fixtrading.org/legacy/en/FIX.5.0SP2/body_494965.html
  - If a message is a known onchain message, do an onchain action

## Simple FIX encoder / decoder

To encode between FIX string and a message object, store required data:

- a JSON with all FIX tags https://github.com/pierrechauvin/fix-protocol-dictionary-json
  - Store as Tag: {Name, Type} dictionary
  - Types: https://www.onixs.biz/fix-dictionary/5.0.sp2.ep264/index.html
- a JSON with groups: Tag: {Name, Tags: [Tag]}
  - For example: `40241: {name: "LegStreamGrp", tags: [40241, 40242, 41700, ...]}`
  - 40241 is also a key for tag `40241: {name: "NoLegStreams", type: "NumInGroup"}` (NumInGroup is "int" alias)
  - All members of a group are required
- a JSON with all FIX messages:
  - Store as MsgType: {ShortName, LongName, Tags: [{Tag, isRequired, isGrp}]}
  - if isGrp, it is also isRequired
  - If isGrp, handle next Tags as members of that (repeating) group according to its structure
  - In code, use a stack for handling possible nested groups (common for developing parsers)

In total: `tags.json`, `groups.json`, `messages.json`.
