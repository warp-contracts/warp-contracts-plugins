import { WarpPlugin, WarpPluginType, GQLNodeInterface } from 'warp-contracts/web';
import { ethers } from 'ethers';
import { stringify } from 'safe-stable-stringify';
import Transaction, { Tag } from 'arweave/web/lib/transaction';
import { stringToB64Url } from 'arweave/web/lib/utils';
import { encodeTxId } from '../utils';

export interface Interaction {
  owner: { address: string };
  recipient: string;
  tags: { name: string; value: string }[];
  fee: {
    winston: string;
  };
  quantity: {
    winston: string;
  };
}

export class EvmSignatureVerificationWebPlugin implements WarpPlugin<GQLNodeInterface | Transaction, Promise<boolean>> {
  async process(input: GQLNodeInterface | Transaction): Promise<boolean> {
    let encodedTags: Tag[] = [];

    for (const tag of input.tags) {
      try {
        encodedTags.push(new Tag(stringToB64Url(tag.name), stringToB64Url(tag.value)));
      } catch (e) {
        throw new Error(`Unable to encode tag ${tag.name}. Error message: ${e.message}.`);
      }
    }

    let inputToVerify: Interaction | Transaction;
    const isTransaction = this.isTransactionType(input);
    if (isTransaction) {
      inputToVerify = input;
    } else {
      inputToVerify = {
        owner: { address: input.owner.address },
        recipient: input.recipient,
        tags: encodedTags,
        fee: {
          winston: input.fee.winston
        },
        quantity: {
          winston: input.quantity.winston
        }
      };
    }

    if (!input.signature) {
      throw new Error(`Unable to verify message due to lack of transaction signature.`);
    }

    try {
      const recoveredAddress: string = ethers.utils.verifyMessage(stringify(inputToVerify), input.signature);
      const verifiedId = await encodeTxId(input.signature);
      const address = isTransaction ? input.owner : input.owner.address;
      return verifiedId === input.id && recoveredAddress.toLowerCase() === address.toLowerCase();
    } catch (e) {
      throw new Error(`Unable to verify message. Error message: ${e.message}.`);
    }
  }

  type(): WarpPluginType {
    return 'evm-signature-verification';
  }

  private isTransactionType(input: GQLNodeInterface | Transaction): input is Transaction {
    return (input as Transaction) !== undefined;
  }
}
