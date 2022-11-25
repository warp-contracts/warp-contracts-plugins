# Warp Contracts Evaluation Progress Plugin

This plugin allows to listen for contract evaluation progress events.  
Compatible only with node.js env.  
Requires Warp Contracts SDK ver. min. `1.2.27`.

## Installation

`yarn add warp-contracts-evaluation-progress-plugin`

```js
const eventEmitter = new EventEmitter();
eventEmitter.on('progress-notification', (message) => {
  console.log('From listener', message);
});

// will notify every 500 evaluated interactions
module.exports = WarpFactory.forMainnet()
  .use(new EvaluationProgressPlugin(eventEmitter, 500));
```
