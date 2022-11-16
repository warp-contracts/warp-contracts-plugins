import { WarpPlugin, WarpPluginType } from 'warp-contracts';
import { NlpManager } from 'node-nlp';

class NlpExtension implements WarpPlugin<any, void> {
  process(input: any): void {
    input.NlpManager = NlpManager;
  }

  type(): WarpPluginType {
    return 'smartweave-extension';
  }
}
