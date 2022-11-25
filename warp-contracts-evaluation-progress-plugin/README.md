# Warp Contracts Evaluation Progress Plugin

This plugin allows to listen for contract evaluation progress events.  
Compatible only with node.js env.  
Requires Warp Contracts SDK ver. min. `1.2.27`.

## Installation

`yarn add warp-contracts-nlp-plugin`

```js
const emitter = new EventEmitter()

const manager = new SmartWeave.extensions
  .NlpManager({languages: ['en'], forceNER: true, nlu: { log: true }});
```
## Installation
`yarn add warp-contracts-nlp-plugin`

```ts
import {NlpExtension} from "warp-contracts-nlp-plugin";
import {WarpFactory} from "warp-contracts";

const warp = WarpFactory.forMainnet()
  .use(new NlpExtension())
```

Requires `warp-contract` SDK ver. min. `1.2.18`.
