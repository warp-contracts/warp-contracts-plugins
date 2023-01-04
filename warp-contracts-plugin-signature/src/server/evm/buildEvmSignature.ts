import Transaction from 'arweave/node/lib/transaction';
import { Signer } from 'ethers';
import { attachSignature, prepareTransaction } from '../common';

export const attachEvmTags = (tx: Transaction) => {
  tx.addTag('Signature-Type', 'ethereum');
  tx.addTag('Nonce', Date.now().toString());
};

export const buildEvmSignature = (signer: Signer) => async (tx: Transaction) => {
  const signerAddress = await signer.getAddress();

  attachEvmTags(tx);
  const toSign = prepareTransaction(tx, signerAddress);

  const signature = await signer.signMessage(toSign);

  await attachSignature(tx, signature);
};
