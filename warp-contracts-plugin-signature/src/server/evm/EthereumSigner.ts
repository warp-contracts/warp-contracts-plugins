import { EthereumSigner as ArbundlesEthereumSigner } from 'arbundles';
import { Wallet } from '@ethersproject/wallet';

export class EthereumSigner extends ArbundlesEthereumSigner {
  async getAddress() {
    return new Wallet(this._key).getAddress();
  }
}
