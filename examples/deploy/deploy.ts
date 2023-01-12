/* eslint-disable */
import Arweave from 'arweave';
import fs from 'fs';
import path from 'path';
import { JWKInterface } from 'arweave/node/lib/wallet';
import { DeployPlugin } from 'warp-contracts-plugin-deploy';
import { defaultCacheOptions, LoggerFactory, WarpFactory } from 'warp-contracts';
import { ArweaveSigner } from 'arbundles/src/signing';

async function main() {
  let wallet: JWKInterface = readJSON('.secrets/jwk.json');
  LoggerFactory.INST.logLevel('error');
  //LoggerFactory.INST.logLevel('debug', 'ExecutionContext');
  const logger = LoggerFactory.INST.create('deploy');

  const arweave = Arweave.init({
    host: 'arweave.net',
    port: 443,
    protocol: 'https',
  });

  try {
    const warp = WarpFactory.forMainnet({ ...defaultCacheOptions, inMemory: true }).use(new DeployPlugin());

    const jsContractSrc = fs.readFileSync(path.join(__dirname, '../data/token-pst.js'), 'utf8');
    const initialState = fs.readFileSync(path.join(__dirname, '../data/token-pst.json'), 'utf8');

    // case 1 - full deploy, js contract
    // const { contractTxId, srcTxId } = await warp.deploy({
    //   wallet,
    //   initState: initialState,
    //   src: jsContractSrc,
    // });

    //@ts-ignore
    // const dataItem = await warp.createSourceTx({ src: jsContractSrc }, new ArweaveSigner(wallet));
    // console.log('srcTxDataItem:', dataItem);
    // // console.log(dataItem.id);
    // await warp.saveSourceTx(dataItem);
    const { contractTxId, srcTxId } = await warp.deploy({
      //@ts-ignore
      wallet: new ArweaveSigner(wallet),
      initState: initialState,
      src: jsContractSrc,
    });
    console.log('srcTxId:', srcTxId);
    console.log('contractTxId', contractTxId);
    // case 2 - deploy from source, js contract
    /*const {contractTxId} = await warp.createContract.deployFromSourceTx({
      wallet,
      initState: initialState,
      srcTxId: "Hj0S0iK5rG8yVf_5u-usb9vRZg1ZFkylQLXu6rcDt-0",
    });*/

    // case 3 - full deploy, wasm contract
    /*const {contractTxId} = await warp.createContract.deploy({
      wallet,
      initState: initialState,
      src: wasmContractSrc,
      wasmSrcCodeDir: path.join(__dirname, 'data/rust/src'),
      wasmGlueCode: path.join(__dirname, 'data/rust/rust-pst.js')
    });*/

    // case 4 - deploy from source, wasm contract
    /*const {contractTxId} = await warp.createContract.deployFromSourceTx({
      wallet,
      initState: initialState,
      srcTxId: "5wXT-A0iugP9pWEyw-iTbB0plZ_AbmvlNKyBfGS3AUY",
    });*/

    // const contract = warp
    //   .contract<any>(contractTxId)
    //   .setEvaluationOptions({ internalWrites: false, unsafeClient: 'throw', allowBigInt: true })
    //   .connect(wallet);

    // await Promise.all([
    //   contract.writeInteraction<any>({
    //     function: 'transfer',
    //     target: 'M-mpNeJbg9h7mZ-uHaNsa5jwFFRAq0PsTkNWXJ-ojwI',
    //     qty: 100,
    //   }),
    //   contract.writeInteraction<any>({
    //     function: 'transfer',
    //     target: 'M-mpNeJbg9h7mZ-uHaNsa5jwFFRAq0PsTkNWXJ-ojwI',
    //     qty: 100,
    //   }),
    //   contract.writeInteraction<any>({
    //     function: 'transfer',
    //     target: 'M-mpNeJbg9h7mZ-uHaNsa5jwFFRAq0PsTkNWXJ-ojwI',
    //     qty: 100,
    //   }),
    // ]);

    // const { cachedValue } = await contract.readState();

    // logger.info('Result');
    // console.dir(cachedValue.state);
  } catch (e) {
    //logger.error(e)
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
