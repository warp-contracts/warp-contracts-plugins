import Transaction, { Tag } from 'arweave/web/lib/transaction';
import { encodeTxId } from '../utils';
import { stringify } from 'safe-stable-stringify';
import { SmartWeaveTags, TagsParser } from 'warp-contracts/web';
import { Interaction } from './evmSignatureVerification';

export const prepareEvmTransaction = (tx: Transaction, ownerAddress: string) => {
  tx.owner = ownerAddress;

  attachEvmTags(tx);

  const decodedTags = decodeTxTags(tx);

  const isContractOrSource = decodedTags.some(
    (tag: Tag) =>
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

  return stringify(txToSign);
};

export const attachSignature = async (tx: Transaction, signature: string) => {
  tx.signature = signature;
  tx.id = await encodeTxId(tx.signature);
};

export const decodeTxTags = (tx: Transaction): Tag[] => {
  const tagsParser = new TagsParser();
  const decodedTags = tagsParser.decodeTags(tx);
  return decodedTags;
};

const attachEvmTags = (tx: Transaction) => {
  tx.addTag('Signature-Type', 'ethereum');
  tx.addTag('Nonce', Date.now().toString());
};
