import { Signer } from 'arbundles/src/signing';
import { SignatureConfig, SIG_CONFIG } from 'arbundles/src/constants';
import Arweave from 'arweave';
import base64url from 'base64url';

export class InjectedArweaveSigner implements Signer {
  private signer: any;
  public publicKey: Buffer;
  readonly ownerLength: number = SIG_CONFIG[SignatureConfig.ARWEAVE].pubLength;
  readonly signatureLength: number = SIG_CONFIG[SignatureConfig.ARWEAVE].sigLength;
  readonly signatureType: SignatureConfig = SignatureConfig.ARWEAVE;

  constructor(windowArweaveWallet: any) {
    this.signer = windowArweaveWallet;
  }

  async setPublicKey(): Promise<void> {
    const arOwner = await this.signer.getActivePublicKey();
    this.publicKey = base64url.toBuffer(arOwner);
  }

  async sign(message: Uint8Array): Promise<Uint8Array> {
    if (!this.publicKey) {
      await this.setPublicKey();
    }

    const algorithm = {
      name: 'RSA-PSS',
      saltLength: 0
    };

    const signature = await this.signer.signature(message, algorithm);
    const buf = new Uint8Array(Object.values(signature));
    return buf;
  }

  static async verify(pk: string, message: Uint8Array, signature: Uint8Array): Promise<boolean> {
    return await Arweave.crypto.verify(pk, message, signature);
  }
}
