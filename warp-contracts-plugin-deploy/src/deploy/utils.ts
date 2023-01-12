import { Signer } from 'arbundles/src/signing';
import { ArWallet, CustomSignature, DataItem } from 'warp-contracts';
import Transaction from 'arweave/node/lib/transaction';

export function isSigner(signature: ArWallet | CustomSignature | Signer): signature is Signer {
  return (signature as Signer).signatureLength !== undefined;
}

export function isDataItem(item: Transaction | DataItem): item is DataItem {
  return (item as DataItem).signatureLength !== undefined;
}
