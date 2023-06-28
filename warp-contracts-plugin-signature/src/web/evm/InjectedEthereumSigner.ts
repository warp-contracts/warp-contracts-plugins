import { InjectedEthereumSigner as ArbundlesInjectedEthereumSigner } from 'arbundles';
import { Wallet } from 'ethers';

export class InjectedEthereumSigner extends ArbundlesInjectedEthereumSigner {
  async getAddress() {
    return new Wallet(this.publicKey).getAddress();
  }
}
