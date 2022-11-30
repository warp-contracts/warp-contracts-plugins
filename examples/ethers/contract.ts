/* eslint-disable */
import { defaultCacheOptions, LoggerFactory, WarpFactory } from 'warp-contracts';
import fs from 'fs';
import path from 'path';
import { EthersExtension } from 'warp-contracts-plugin-ethers';

async function main() {
  let wallet = readJSON('./.secrets/jwk.json');
  LoggerFactory.INST.logLevel('debug');
  const logger = LoggerFactory.INST.create('ethers');

  try {
    const warp = WarpFactory.forMainnet({ ...defaultCacheOptions, inMemory: true }).use(new EthersExtension());

    const jsContractSrc = fs.readFileSync(path.join(__dirname, '../data/ethers-contract.js'), 'utf8');

    const { contractTxId } = await warp.createContract.deploy({
      wallet,
      initState: JSON.stringify({ count: 0 }),
      src: jsContractSrc,
    });

    console.log(contractTxId);

    const contract = warp.contract<any>(contractTxId).connect(wallet);

    await contract.writeInteraction<any>({
      function: 'ethers',
      signature:
        '0xddd0a7290af9526056b4e35a077b9a11b513aa0028ec6c9880948544508f3c63' +
        '265e99e47ad31bb2cab9646c504576b3abc6939a1710afc08cbf3034d73214b8' +
        '1c',
      message: 'hello world',
      signingAddress: '0x14791697260E4c9A71f18484C9f997B308e59325',
    });

    const { cachedValue } = await contract.readState();

    logger.info('Result');
    console.dir(cachedValue.state);
  } catch (e) {
    logger.error(e);
  }
}

export function readJSON(path: string) {
  const content = fs.readFileSync(path, 'utf-8');
  try {
    return JSON.parse(content);
  } catch (e) {
    throw new Error(`File "${path}" does not contain a valid JSON`);
  }
}

main().catch((e) => console.error(e));
