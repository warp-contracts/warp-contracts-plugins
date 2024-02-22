/* eslint-disable */
import Arweave from 'arweave';
import fs from 'fs';
import path from 'path';
import { JWKInterface } from 'arweave/node/lib/wallet';
import {
  DeployPlugin,
  ArweaveSigner,
  EthereumSigner,
} from 'warp-contracts-plugin-deploy';
import {
  defaultCacheOptions,
  LoggerFactory,
  WarpFactory,
} from 'warp-contracts';

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
    const warp = WarpFactory.forMainnet({
      ...defaultCacheOptions,
      inMemory: true,
    }).use(new DeployPlugin());

    const jsContractSrc = fs.readFileSync(
      path.join(__dirname, '../data/ao.js'),
      'utf8'
    );
    const wasmContractSrc = fs.readFileSync(
      path.join(__dirname, '../data/rust/rust-pst_bg.wasm')
    );
    const walletAddress = await warp.arweave.wallets.jwkToAddress(wallet);
    const initialState = {
      name: 'test',
      ticker: 'test ticker',
      logo: 'test',
    };

    // case 1 - full deploy, js contract
    const { contractTxId, srcTxId } = await warp.deploy({
      wallet: new ArweaveSigner(wallet),
      initState: JSON.stringify(initialState),
      src: jsContractSrc,
    });
    console.log(contractTxId, srcTxId);

    // // case 2 - create source
    // const dataItem = await warp.createSource({ src: jsContractSrc }, new ArweaveSigner(wallet));
    // console.log('srcTxDataItem:', dataItem);

    // // case 3 - save source
    // const srcTxId = await warp.saveSource(dataItem);
    // console.log(srcTxId)

    // // case 4 - deployFromSourceTx
    // const { contractTxId, srcTxId } = await warp.deployFromSourceTx({
    //   wallet: new ArweaveSigner(wallet),
    //   initState: JSON.stringify(initialState),
    //   srcTxId: 'QVtWnRyJgKw9WNAtZLyKOTDmlqssglRDZU4HDT9j-2Y',
    // });
    // console.log('srcTxId:', srcTxId);
    // console.log('contractTxId', contractTxId);

    // // case 5 - deploy Wasm contract
    // const { contractTxId, srcTxId } = await warp.deploy({
    //   wallet: new ArweaveSigner(wallet),
    //   initState: JSON.stringify(initialState),
    //   src: wasmContractSrc,
    //   wasmSrcCodeDir: path.join(__dirname, '../data/rust/src'),
    //   wasmGlueCode: path.join(__dirname, '../data/rust/rust-pst.js'),
    // });
    // console.log(contractTxId, srcTxId);

    // // case 6 - deploy from source, wasm contract
    // const { contractTxId, srcTxId } = await warp.deployFromSourceTx({
    //   wallet: new ArweaveSigner(wallet),
    //   initState: JSON.stringify(initialState),
    //   srcTxId: '5wXT-A0iugP9pWEyw-iTbB0plZ_AbmvlNKyBfGS3AUY',
    // });
    // console.log(contractTxId, srcTxId);

    // // case 7 - write interaction js
    // // @ts-ignore
    // const { originalTxId } = await warp
    //   .contract('1n4w-CArHCoq1wSrFQotIxqslh_-UCuo4vNSwmcLHl0')
    //   .connect(wallet)
    //   .writeInteraction({ function: 'transfer', target: 'uhE-QeYS8i4pmUtnxQyHD7dzXFNaJ9oMK-IM-QPNY6M', qty: 10 });
    // console.log(originalTxId);

    // // case 8 - full deploy, js contract - arweave
    // const { contractTxId, srcTxId } = await warp.deploy(
    //   {
    //     wallet,
    //     initState: JSON.stringify(initialState),
    //     src: jsContractSrc,
    //   },
    //   true
    // );
    // console.log(contractTxId, srcTxId);
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
