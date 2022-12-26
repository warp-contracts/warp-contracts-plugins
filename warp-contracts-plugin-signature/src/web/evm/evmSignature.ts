import MetaMaskOnboarding from '@metamask/onboarding';
import { MetaMaskInpageProvider } from '@metamask/providers';
import Transaction from 'arweave/web/lib/transaction';
import { utils } from 'ethers';
import { prepareTransaction, attachSignature } from '../common';

declare global {
  interface Window {
    ethereum?: MetaMaskInpageProvider;
  }
}

export const attachEvmTags = (tx: Transaction) => {
  tx.addTag('Signature-Type', 'ethereum');
  tx.addTag('Nonce', Date.now().toString());
};

export const evmSignature = async (tx: Transaction) => {
  const signer = await getMetaMaskAccount();

  const signerAddress = utils.getAddress(signer);

  attachEvmTags(tx);
  const toSign = prepareTransaction(tx, signerAddress);

  const signature = await signWithMetaMask(signerAddress, toSign);

  await attachSignature(tx, signature);
};

async function signWithMetaMask(owner: string, txToSign: string): Promise<string> {
  return await window.ethereum.request<string>({
    method: 'personal_sign',
    params: [owner, txToSign]
  });
}

async function getMetaMaskAccount(): Promise<string> {
  if (!MetaMaskOnboarding.isMetaMaskInstalled()) {
    throw new Error('Account could not be loaded. Metamask not detected');
  }

  const accounts = await window.ethereum.request({
    method: 'eth_requestAccounts'
  });

  return accounts[0];
}
