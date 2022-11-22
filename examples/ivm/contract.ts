/* eslint-disable */

import {defaultCacheOptions, LoggerFactory, WarpFactory} from "warp-contracts";
import {IvmPlugin} from "warp-contracts-ivm-plugin";

LoggerFactory.INST.logLevel('debug');
// LoggerFactory.INST.logLevel('none', 'DefaultStateEvaluator');
const logger = LoggerFactory.INST.create('ivm-example');

async function main() {
  const contractTxId = 'QAjM3_MklqXSXr-7z_J7t0UqEAyjBpqQDF9NDzf_JPU';

  const warp = WarpFactory
    .forMainnet({...defaultCacheOptions, inMemory: true});

  const result = await warp
    .contract(contractTxId)
    .setEvaluationOptions({
      allowBigInt: true
    })
    .readState();

  console.log(result.sortKey);
}

main().catch((e) => console.error(e));
