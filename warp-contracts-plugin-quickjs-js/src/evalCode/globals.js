const globals = `
class ProcessError extends Error {
  constructor(message) {
    super(message);
    this.name = "ProcessError";
  }
}

let ao = {
  output: "",
  _module: "",
  _version: "0.0.3",
  _ref: 0,
  authorities: [],
  env: {},
  id: "",
  init: function(env) {
    if (this.id == '') {
      this.id = env.process.id;
    }
  
    if (this._module == '') {
      for (const tag of env.process.tags) {
        if (tag.name == 'Module') {
          this._module = tag.value;
        }
      }
    }
  
    if (this.authorities.length < 1) {
      for (const tag of env.process.tags) {
        if (tag.name == 'Authority') {
          this.authorities.push(tag.value);
        }
      }
    }
  
    this.outbox = {
      Messages: [],
      Spawns: [],
      Output: ''
    }
    
    this.env = env;
  },
  isTrusted: function (msg) {
    if (this.authorities == 0) {
      return true;
    }
    for (const authority of authorities) {
      if (msg.From == authority) {
        return true;
      }
      if (msg.From == authority) {
        return true;
      }
    }
    return false;
  },
  outbox: {
      Messages: [],
      Spawns: [],
      Output: ''
  },
  result: function (result) {
    this.outbox.Output = result; 
  },
  send: function __send(msg) {
    this._ref = this._ref + 1;
  
    const message = {
      target: msg.target,
      data: msg.data,
      // what's happening here?
      anchor: '%032d' + ao._ref,
      tags: [
        { name: 'Data-Protocol', value: 'ao' },
        { name: 'Variant', value: 'ao.TN.1' },
        { name: 'Type', value: 'Message' },
        { name: 'From-Process', value: ao.id },
        { name: 'From-Module', value: ao._module },
        { name: 'Ref_', value: ao._ref.toString() }
      ]
    };
  
    for (const key in msg) {
      if (!['target', 'data', 'anchor', 'tags'].includes(key)) {
        message.tags.push({ name: key, value: msg[key] });
      }
    }
  
    if (msg.tags) {
      if (Array.isArray(msg.tags)) {
        msg.tags.forEach((t) => {
          message.tags.push(t);
        });
      } else {
        for (const key in msg.tags) {
          message.tags.push({ name: key, value: msg.tags[key] });
        }
      }
    }
  
    this.outbox.Messages.push(message);
  },
  spawn: function(module, msg) {
    if (typeof module != 'string') {
      throw new Error('Module source is required');
    }
  
    ao._ref = ao_.ref + 1;
  
    const spawn = {
      data: msg.Data || 'NODATA',
      anchor: '%032d' + ao._ref,
      tags: [
        {name: "Data-Protocol", value: "ao"},
        {name: "Variant", value: "ao.TN.1"},
        {name: "Type", value: "Process"},
        {name: "From-Process", value: ao.id},
        {name: "From-Module", value: ao._module},
        {name: "Module", value: module},
        {name: "Ref_", value: tostring(ao._ref)}
      ]
    }
  
      for (const key in msg) {
        if (!['target', 'data', 'anchor', 'tags'].includes(key)) {
          spawn.tags.push({ name: key, value: msg[key] });
        }
      }
  
      if (msg.tags) {
        if (Array.isArray(msg.tags)) {
          msg.tags.forEach((t) => {
            spawn.tags.push(t);
          });
        } else {
          for (const key in msg.tags) {
            spawn.tags.push({ name: key, value: msg.tags[key] });
          }
        }
      }
  
      this.outbox.Spawns.push(spawn);
  },
  log: function(txt) {
    if (typeof ao.outbox.Output == 'string') {
      this.outbox.Output = [ao.outbox.Output];
    }

    this.outbox.Output.push(txt);
  },
  clearOutbox: function() {
    this.outbox = {
      Messages: [],
      Spawns: [],
      Output: ''
    }
  }
}

let currentState = {};

BigInt.prototype.toJSON = function () {
  return this.toString();
};

// to be called by SDK when evaluating for already cached state - same as WASM handlers
function __initState(newState) {
  currentState = newState;
}

// to be called by SDK after evaluating a message - same as WASM handlers
function __currentState() {
  return JSON.stringify(currentState);
}

function __getOutbox() {
  return JSON.stringify(ao.outbox);
}
`;

module.exports = { globals };
