pSymmVM: only for TRADE phase

constructor: accept PPM storage, custody storage

function processMessage
accepts: session object, input message
returns: new session object, output message array

---

pSymmParty: for INIT, PKXCHG, TRADE (uses VM for TRADE)

constructor: accept pSymmVM instance, our pubkey, IPstorage (pubkey => IP)

state variables:

- sessions map of (pubkey, custody id) => session object
- InputQueue (contains websocket messages, gets passed to pSymmParty.processInput())
- SequencerQueue (internal use, on update, pass to pSymm VM)
- OutputQueue (on update, send to the IPstorage[pubkey])
