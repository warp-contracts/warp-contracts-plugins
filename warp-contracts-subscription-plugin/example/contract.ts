/* eslint-disable */

import {LoggerFactory, WarpFactory} from "warp-contracts";
import {InteractionMessage, StateUpdatePlugin, WarpSubscriptionPlugin} from "../src/index";

LoggerFactory.INST.logLevel('none');
LoggerFactory.INST.logLevel('info', 'subscription-example');
LoggerFactory.INST.logLevel('debug', 'WarpSubscriptionPlugin');
const logger = LoggerFactory.INST.create('subscription-example');

class CustomSubscriptionPlugin extends WarpSubscriptionPlugin<void> {
  async process(input: InteractionMessage): Promise<void> {
    logger.info('From custom plugin', input);
    // process the new message;
  }
}

async function main() {
  const contractTxId = 'Ws9hhYckc-zSnVmbBep6q_kZD5zmzYzDmgMC50nMiuE';
  const warp = WarpFactory.forMainnet();
  warp.use(new StateUpdatePlugin(contractTxId, warp));
  warp.use(new CustomSubscriptionPlugin(contractTxId, warp));
  let wallet = await warp.generateWallet();

  const contract = warp
    .contract(contractTxId)
    .connect(wallet.jwk);

  await contract.writeInteraction({
    function: 'vrf'
  }, {vrf: true});

}

main().catch((e) => console.error(e));
