import { initPubSub, subscribe } from 'warp-contracts-pubsub';
import { WarpPlugin, WarpPluginType } from 'warp-contracts/lib/types/core/WarpPlugin';
import { EvalStateResult, GQLNodeInterface, LoggerFactory, SortKeyCacheResult, Warp } from 'warp-contracts';

const isNode = new Function('try {return this===global;}catch(e){return false;}');
if (isNode) {
  global.WebSocket = require('ws');
}

initPubSub();

export interface InteractionMessage {
  contractTxId: string;
  sortKey: string;
  lastSortKey: string;
  interaction: GQLNodeInterface;
}

export abstract class WarpSubscriptionPlugin<R> implements WarpPlugin<InteractionMessage, Promise<R>> {
  protected readonly logger = LoggerFactory.INST.create(WarpSubscriptionPlugin.name);

  constructor(protected readonly contractTxId: string, protected readonly warp: Warp) {
    subscribe(
      `interactions/${contractTxId}`,
      async ({ data }) => {
        const message = JSON.parse(data);
        this.logger.debug('New message received', message);
        await this.process(message);
      },
      console.error
    )
      .then(() => {
        this.logger.debug('Subscribed to interactions for', this.contractTxId);
      })
      .catch((e) => {
        this.logger.error('Error while subscribing', e);
      });
  }

  abstract process(input: InteractionMessage): Promise<R>;

  type(): WarpPluginType {
    return 'subscription';
  }
}

export class StateUpdatePlugin<State> extends WarpSubscriptionPlugin<SortKeyCacheResult<EvalStateResult<State>>> {
  async process(input: InteractionMessage): Promise<SortKeyCacheResult<EvalStateResult<State>>> {
    const lastStoredKey = (await this.warp.stateEvaluator.latestAvailableState(this.contractTxId))?.sortKey;
    if (lastStoredKey?.localeCompare(input.lastSortKey) === 0) {
      this.logger.debug('Safe to use new interaction.', input.sortKey);
      return await this.warp.contract<State>(this.contractTxId).readStateFor([input.interaction]);
    } else {
      this.logger.debug('Unsafe to use new interaction.', {
        lastSortKey: input.lastSortKey,
        localCache: lastStoredKey
      });
      return await this.warp.contract<State>(this.contractTxId).readState();
    }
  }
}
