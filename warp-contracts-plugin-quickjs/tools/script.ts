/* eslint-disable */

import { defaultCacheOptions, LoggerFactory, WarpFactory } from 'warp-contracts';
import { QuickJsPlugin } from '../src/index';
import fs from 'fs';

LoggerFactory.INST.logLevel('debug');
// LoggerFactory.INST.logLevel('none', 'DefaultStateEvaluator');
const logger = LoggerFactory.INST.create('ivm-example');

async function main() {
  const contractTxId = 'jliaItK34geaPuyOYVqh8fsRgXIXWwa9iLJszGXKOHE';
  const wallet = JSON.parse(fs.readFileSync('./.secrets/jwk.json', 'utf-8'));

  const warp = WarpFactory.forMainnet({
    ...defaultCacheOptions,
    inMemory: true
  }).use(new QuickJsPlugin({}));

  const contract = warp.contract(contractTxId).connect(wallet);

  // await contract.writeInteraction({
  //   function: 'transfer',
  //   recipient: 'test target',
  //   quantity: '10',
  //   cast: false
  // });

  // const test = await contract.viewState({
  //   function: 'info'
  // });

  // console.log(test);

  const result = await contract
    .setEvaluationOptions({
      allowBigInt: true,
      internalWrites: true
    })
    .readState();

  console.log(result.cachedValue.state);
}

main().catch((e) => console.error(e));
