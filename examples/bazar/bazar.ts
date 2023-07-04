/* eslint-disable */
import Arweave from 'arweave';
import { defaultCacheOptions, LoggerFactory, WarpFactory } from 'warp-contracts';
import fs from 'fs';
import { JWKInterface } from 'arweave/node/lib/wallet';
import { SqliteContractCache } from 'warp-contracts-sqlite';
import { LmdbCache } from 'warp-contracts-lmdb';
import { EvaluationProgressPlugin } from 'warp-contracts-evaluation-progress-plugin';
import { NlpExtension } from 'warp-contracts-plugin-nlp';
import { EthersExtension } from 'warp-contracts-plugin-ethers';
import { VM2Plugin } from 'warp-contracts-plugin-vm2';
import { VRFPlugin } from 'warp-contracts-plugin-vrf';
//@ts-ignore
import { EvmSignatureVerificationServerPlugin } from 'warp-contracts-plugin-signature/server';
import { EventEmitter } from 'node:events';
import { rimraf } from 'rimraf';

const eventEmitter = new EventEmitter();
eventEmitter.on('progress-notification', (data) => {
  console.log('test');
});

async function main() {
  let wallet: JWKInterface = readJSON('./.secrets/jwk.json');
  LoggerFactory.INST.logLevel('info');
  //LoggerFactory.INST.logLevel('debug', 'ExecutionContext');
  const logger = LoggerFactory.INST.create('deploy');

  try {
    await rimraf('cache');

    const warp = WarpFactory.forMainnet()
      .useStateCache(
        new SqliteContractCache(
          {
            ...defaultCacheOptions,
            dbLocation: `./cache/warp/sqlite/state`,
          },
          {
            maxEntriesPerContract: 5,
          }
        )
      )
      .useContractCache(
        new LmdbCache(
          {
            ...defaultCacheOptions,
            dbLocation: `./cache/warp/lmdb/contract`,
          },
          {
            minEntriesPerContract: 1,
            maxEntriesPerContract: 5,
          }
        ),
        new LmdbCache(
          {
            ...defaultCacheOptions,
            dbLocation: `./cache/warp/lmdb/source`,
          },
          {
            minEntriesPerContract: 1,
            maxEntriesPerContract: 5,
          }
        )
      )
      .useKVStorageFactory(
        (contractTxId) =>
          new LmdbCache(
            {
              ...defaultCacheOptions,
              dbLocation: `./cache/warp/kv/lmdb/${contractTxId}`,
            },
            {
              minEntriesPerContract: 3,
              maxEntriesPerContract: 10,
            }
          )
      )
      .use(new EvaluationProgressPlugin(eventEmitter, 500))
      .use(new NlpExtension())
      .use(new EvmSignatureVerificationServerPlugin())
      .use(new EthersExtension())
      .use(new VM2Plugin())
      .use(new VRFPlugin());

    // 1YRdniqVjlD2EVb99numIvQvqsXNxViWmiof8_wiXQM
    // FYJOKdtNKl18QgblxgLEZUfJMFUv6tZTQqGTtY-D6jQ
    // XVO04wSSqoyrPN5ut4jtFjKc_c41k6nUhpilohRDilM
    const contract = warp
      .contract('XVO04wSSqoyrPN5ut4jtFjKc_c41k6nUhpilohRDilM')
      .setEvaluationOptions({
        maxCallDepth: 5,
        maxInteractionEvaluationTimeSeconds: 10,
        allowBigInt: true,
        unsafeClient: 'skip',
        internalWrites: true,
        // useKVStorage: true,
      })
      .connect(wallet);

    const { cachedValue } = await contract.readState();

    console.dir(cachedValue);
    fs.writeFileSync('validity.json', JSON.stringify(cachedValue.validity));
  } catch (e) {
    throw e;
  }
}

export function readJSON(path: string): JWKInterface {
  const content = fs.readFileSync(path, 'utf-8');
  try {
    return JSON.parse(content);
  } catch (e) {
    throw new Error(`File "${path}" does not contain a valid JSON`);
  }
}

main().catch((e) => console.error(e));
function getFailures(...args: any): Promise<number> {
  throw new Error('Function not implemented.');
}
