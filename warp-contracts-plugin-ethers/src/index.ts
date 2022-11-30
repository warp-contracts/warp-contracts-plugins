import { WarpPlugin, WarpPluginType } from 'warp-contracts';
import { ethers } from 'ethers';

export class EthersExtension implements WarpPlugin<any, void> {
  process(input: any): void {
    input.ethers = {};
    input.ethers.utils = ethers.utils;
  }

  type(): WarpPluginType {
    return 'smartweave-extension-ethers';
  }
}
