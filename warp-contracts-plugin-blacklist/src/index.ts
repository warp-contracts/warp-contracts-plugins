import { WarpPlugin, WarpPluginType } from 'warp-contracts';

export class ContractBlacklistPlugin implements WarpPlugin<string, Promise<boolean>> {
  constructor(private blacklistFunction: (input: string) => Promise<boolean>) {}

  async process(input: string): Promise<boolean> {
    return await this.blacklistFunction(input);
  }

  type(): WarpPluginType {
    return 'contract-blacklist';
  }
}

export async function getDreBlacklistFunction(
  getFailures: (...args: any) => Promise<number>,
  nodeDb: any,
  maxFailures: number
) {
  return async (input: string) => {
    try {
      const failures = await getFailures(nodeDb, input);
      return Number.isInteger(failures) && failures > maxFailures - 1;
    } catch (e) {
      throw new Error(`Unable to check blacklist for contract: ${input}: ${JSON.stringify(e)}`);
    }
  };
}
