import { bufferTob64Url } from 'arweave/node/lib/utils';
import crypto from 'crypto';

const fromHexString = (hexString: string): Uint8Array =>
  Uint8Array.from(hexString.match(/.{1,2}/g).map((byte) => parseInt(byte, 16)));

export const encodeTxId = async function (signature: string): Promise<string> {
  const hash = crypto.createHash('sha256').update(fromHexString(signature)).digest();
  return bufferTob64Url(hash);
};
