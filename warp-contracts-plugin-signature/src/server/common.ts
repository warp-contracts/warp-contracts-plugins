import Transaction, { Tag } from "arweave/node/lib/transaction";
import { SmartWeaveTags, TagsParser } from 'warp-contracts';
import { stringify } from 'safe-stable-stringify';
import { encodeTxId } from './utils';
import { Interaction } from "./evm/evmSignatureVerification";

export const attachSignature = async (tx: Transaction, signature: string) => {
    tx.signature = signature;
    tx.id = await encodeTxId(tx.signature);
};

export const decodeTxTags = (tx: Transaction): Tag[] => {
    const tagsParser = new TagsParser();
    const decodedTags = tagsParser.decodeTags(tx);
    return decodedTags;
};

export const prepareTransaction = (tx: Transaction, ownerAddress: string) => {
    tx.owner = ownerAddress;

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
