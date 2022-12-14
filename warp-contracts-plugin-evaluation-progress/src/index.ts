import { LoggerFactory, WarpPlugin, WarpPluginType } from 'warp-contracts';
import EventEmitter from 'events';

export type EvaluationProgressPluginInput = {
  contractTxId: string;
  currentInteraction: number;
  allInteractions: number;
  lastInteractionProcessingTime: number;
};

export class EvaluationProgressPlugin implements WarpPlugin<EvaluationProgressPluginInput, void> {
  private logger = LoggerFactory.INST.create('EvaluationProgressPlugin');

  constructor(readonly emitter: EventEmitter, readonly notificationFreq = 100) {}

  process(input: EvaluationProgressPluginInput): void {
    const { contractTxId, currentInteraction, allInteractions, lastInteractionProcessingTime } = input;

    if ((currentInteraction + 1) % this.notificationFreq == 0) {
      const message = `[${contractTxId}]: ${currentInteraction}/${allInteractions} [${lastInteractionProcessingTime}]`;
      this.logger.debug(message);
      this.emitter.emit('progress-notification', { contractTxId, message });
    }
  }

  type(): WarpPluginType {
    return 'evaluation-progress';
  }
}
