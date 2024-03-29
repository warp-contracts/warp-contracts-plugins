import { InjectedEthereumSigner as ArbundlesInjectedEthereumSigner } from 'arbundles';
import { computeAddress } from '@ethersproject/transactions';

export class InjectedEthereumSigner extends ArbundlesInjectedEthereumSigner {
  async getAddress() {
    return computeAddress(this.publicKey);
  }
}
