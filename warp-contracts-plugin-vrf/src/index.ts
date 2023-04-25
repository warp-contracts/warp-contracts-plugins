import { bufToBn, VrfData, VrfPluginFunctions, WarpPlugin, WarpPluginType } from 'warp-contracts';
import elliptic from 'elliptic';
import Arweave from 'arweave';
import { Evaluate, ProofHoHash } from '@idena/vrf-js';

const EC = new elliptic.ec('secp256k1');
const key = EC.genKeyPair();
const pubKeyS = key.getPublic(true, 'hex');

export class VRFPlugin implements WarpPlugin<unknown, VrfPluginFunctions> {
  type(): WarpPluginType {
    return 'vrf';
  }

  process(): VrfPluginFunctions {
    return {
      generateMockVrf(sortKey: string): VrfData {
        const data = Arweave.utils.stringToBuffer(sortKey);
        const [index, proof] = Evaluate(key.getPrivate().toArray(), data);
        return {
          index: Arweave.utils.bufferTob64Url(index),
          proof: Arweave.utils.bufferTob64Url(proof),
          bigint: bufToBn(index).toString(),
          pubkey: pubKeyS
        };
      },
      verify(vrf: VrfData, sortKey: string): boolean {
        const keys = EC.keyFromPublic(vrf.pubkey, 'hex');

        let hash;
        try {
          // ProofHoHash throws its own 'invalid vrf' exception
          hash = ProofHoHash(
            keys.getPublic(),
            Arweave.utils.stringToBuffer(sortKey),
            Arweave.utils.b64UrlToBuffer(vrf.proof)
          );
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (e: any) {
          return false;
        }

        return Arweave.utils.bufferTob64Url(hash) == vrf.index;
      }
    };
  }
}
