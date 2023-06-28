import Arweave from 'arweave';
import base64url from 'base64url';
import { Signer, SIG_CONFIG, SignatureConfig, Tag, DataItem } from 'arbundles';
import { Buffer } from 'buffer';

export class InjectedArweaveSigner implements Signer {
  public signer: any;
  public publicKey: Buffer;
  readonly ownerLength: number = SIG_CONFIG[SignatureConfig.ARWEAVE].pubLength;
  readonly signatureLength: number = SIG_CONFIG[SignatureConfig.ARWEAVE].sigLength;
  readonly signatureType: SignatureConfig = SignatureConfig.ARWEAVE;

  constructor(windowArweaveWallet: any) {
    this.signer = windowArweaveWallet;
    if (!window.Buffer) {
      window.Buffer = Buffer;
    }
  }

  async setPublicKey(): Promise<void> {
    let arOwner;
    if (this.signer.getPublicKey) {
      arOwner = await this.signer.getPublicKey();
    } else {
      arOwner = await this.signer.getActivePublicKey();
    }
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

  async signDataItem(data: string | Buffer, tags: Tag[]): Promise<DataItem> {
    if (!this.publicKey) {
      console.log('test3');
      await this.setPublicKey();
    }

    console.log(data);
    console.log(tags);

    console.log('signer', this.signer);
    const bufData = await this.signer.signDataItem({
      data,
      tags
    });

    console.log('bufData', bufData);

    const buf = Buffer.from(bufData);

    console.log(buf);

    const dataI = new DataItem(buf);
    console.log(dataI);
    return dataI;
  }

  static async verify(pk: string, message: Uint8Array, signature: Uint8Array): Promise<boolean> {
    return await Arweave.crypto.verify(pk, message, signature);
  }
}
