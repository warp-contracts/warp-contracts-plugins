/* eslint-disable */

import {defaultCacheOptions, LoggerFactory, WarpFactory} from "warp-contracts";
import {IvmPlugin} from "warp-contracts-ivm-plugin";

LoggerFactory.INST.logLevel('info');
const logger = LoggerFactory.INST.create('ivm-example');

async function main() {
  const contractTxId = '9aetS5_kSsCdDI14y9e1TlL9CF6xjI2sLeZOnMHgwPc';

  const warp = WarpFactory
    .forMainnet({...defaultCacheOptions, inMemory: true})
    .use(new IvmPlugin({}));

  const result = await warp
    .contract(contractTxId)
    .setEvaluationOptions({
      allowBigInt: true
    })
    .readState();

  console.log(result.sortKey);
}

main().catch((e) => console.error(e));
