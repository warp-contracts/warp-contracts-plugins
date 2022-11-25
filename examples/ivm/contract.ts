/* eslint-disable */

import {defaultCacheOptions, LoggerFactory, WarpFactory} from "warp-contracts";
import {IvmPlugin} from "warp-contracts-ivm-plugin";

LoggerFactory.INST.logLevel('debug');
// LoggerFactory.INST.logLevel('none', 'DefaultStateEvaluator');
const logger = LoggerFactory.INST.create('ivm-example');

async function main() {
  const contractTxId = 'mS6mBLQ4HmWAqiVs4Nhs3DEpjk3PZCrR6yUOosTSKa8';

  const warp = WarpFactory
    .forMainnet({...defaultCacheOptions, inMemory: true})
    .use(new IvmPlugin({}));

  const result = await warp
    .contract(contractTxId)
    .setEvaluationOptions({
      allowBigInt: true,
      internalWrites: true,
    })
    .readState();

  console.log(result.cachedValue.validity);
}

main().catch((e) => console.error(e));
