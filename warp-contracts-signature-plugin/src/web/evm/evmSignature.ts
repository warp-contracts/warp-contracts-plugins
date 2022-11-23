import { MetaMaskInpageProvider } from '@metamask/providers';
import Transaction from 'arweave/web/lib/transaction';
import { encodeTxId } from '../utils';
import MetaMaskOnboarding from '@metamask/onboarding';
import { stringify } from 'safe-stable-stringify';
import { utils } from 'ethers';
import { SmartWeaveTags, TagsParser } from 'warp-contracts';
import { Interaction } from './evmSignatureVerification';
declare global {
  interface Window {
    ethereum?: MetaMaskInpageProvider;
  }
}

export const evmSignature = async (tx: Transaction): Promise<void> => {
  const tagsParser = new TagsParser();
  if (!MetaMaskOnboarding.isMetaMaskInstalled()) {
    throw new Error('Account could not be loaded. Metamask not detected');
  }
  const accounts = await window.ethereum.request({
    method: 'eth_requestAccounts'
  });

  tx.owner = utils.getAddress(accounts[0]);
  tx.addTag('Signature-Type', 'ethereum');
  tx.addTag('Nonce', Date.now().toString());

  const decodedTags = tagsParser.decodeTags(tx);

  const isContractOrSource = decodedTags.some(
    (tag) =>
      tag.name === SmartWeaveTags.APP_NAME &&
      (tag.value === 'SmartWeaveContract' || tag.value === 'SmartWeaveContractSource')
  );

  let txToSign: Interaction | Transaction;

  if (isContractOrSource) {
    txToSign = tx;
  } else {
    txToSign = {
      owner: { address: tx.owner },
      recipient: tx.target,
      tags: tx.tags,
      fee: {
        winston: tx.reward
      },
      quantity: {
        winston: tx.quantity
      }
    };
  }

  tx.signature = await window.ethereum.request<string>({
    method: 'personal_sign',
    params: [accounts[0], stringify(txToSign)]
  });

  tx.id = await encodeTxId(tx.signature);
};
