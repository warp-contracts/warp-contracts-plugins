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
  protected readonly logger = LoggerFactory.INST.create('WarpSubscriptionPlugin');

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

    /**
     * we need to check whether the locally cached state is at the sort key that is the previous sort key
     * for the new interaction from the "input".
     * That's why each new message contains the 'lastSortKey' field.
     *
     * If the local state is cached at 'lastSortKey' - it's safe to use the new interaction to update
     * the local state directly.
     *
     * If the local state is cached add 'earlier' sort key - we need to ask the Warp Gateway for the missing
     * interactions.
     */
    let result: SortKeyCacheResult<EvalStateResult<State>>;
    if (lastStoredKey?.localeCompare(input.lastSortKey) === 0) {
      this.logger.debug('Safe to use new interaction.', input.sortKey);
      result = await this.warp.contract<State>(this.contractTxId).readStateFor([input.interaction]);
    } else {
      this.logger.debug('Unsafe to use new interaction - reading the state via gateway', {
        lastSortKey: input.lastSortKey,
        localCache: lastStoredKey
      });
      result = await this.warp.contract<State>(this.contractTxId).readState();
    }

    this.logger.debug('State updated', {
      sortKey: result.sortKey,
      state: result.cachedValue.state
    });

    return result;
  }
}
