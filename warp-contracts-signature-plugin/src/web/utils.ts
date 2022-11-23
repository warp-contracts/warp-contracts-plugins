import { bufferTob64Url } from 'arweave/web/lib/utils';

const fromHexString = (hexString: string): Uint8Array =>
  Uint8Array.from(hexString.match(/.{1,2}/g).map((byte) => parseInt(byte, 16)));

export const encodeTxId = async function (signature: string): Promise<string> {
  const hash = await crypto.subtle.digest('sha-256', fromHexString(signature));
  return bufferTob64Url(new Uint8Array(hash));
};
