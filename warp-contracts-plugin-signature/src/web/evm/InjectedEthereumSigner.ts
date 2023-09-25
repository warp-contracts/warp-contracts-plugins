import { InjectedEthereumSigner as ArbundlesInjectedEthereumSigner } from 'arbundles';
import { utils } from 'ethers';

export class InjectedEthereumSigner extends ArbundlesInjectedEthereumSigner {
  async getAddress() {
    return utils.computeAddress(this.publicKey);
  }
}
