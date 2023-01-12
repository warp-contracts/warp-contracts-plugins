/* eslint-disable */
import { SourceImpl } from './SourceImpl';
import { Buffer } from 'warp-isomorphic';
import {
  ArWallet,
  BundlrNodeType,
  BUNDLR_NODES,
  ContractData,
  ContractDeploy,
  CreateContract,
  CustomSignature,
  DataItem,
  FromSrcTxContractData,
  LoggerFactory,
  Signature,
  Signer,
  SmartWeaveTags,
  SourceData,
  Transaction,
  Warp,
  WarpFetchWrapper,
  WARP_GW_URL
} from 'warp-contracts';
import { createData } from 'arbundles';
import { isSigner } from '../../deploy/utils';

export class CreateContractImpl implements CreateContract {
  private readonly logger = LoggerFactory.INST.create('DefaultCreateContract');
  private readonly source: SourceImpl;

  private signature: Signature;
  private readonly warpFetchWrapper: WarpFetchWrapper;

  constructor(private readonly warp: Warp) {
    this.deployFromSourceTx = this.deployFromSourceTx.bind(this);
    this.source = new SourceImpl(this.warp);
    this.warpFetchWrapper = new WarpFetchWrapper(this.warp);
  }

  async deploy(contractData: ContractData, disableBundling?: boolean): Promise<ContractDeploy> {
    const { wallet, initState, tags, transfer, data, evaluationManifest } = contractData;

    let srcTx: Transaction | DataItem;

    const effectiveUseBundler =
      disableBundling == undefined ? this.warp.definitionLoader.type() == 'warp' : !disableBundling;

    srcTx = await this.source.createSource(contractData, wallet, !effectiveUseBundler);

    if (!effectiveUseBundler) {
      await this.source.saveSource(srcTx, true);
    }

    this.logger.debug('Creating new contract');

    return await this.deployFromSourceTx(
      {
        srcTxId: srcTx.id,
        wallet,
        initState,
        tags,
        transfer,
        data,
        evaluationManifest
      },
      !effectiveUseBundler,
      srcTx
    );
  }

  async deployFromSourceTx(
    contractData: FromSrcTxContractData,
    disableBundling?: boolean,
    srcTx: Transaction | DataItem = null
  ): Promise<ContractDeploy> {
    this.logger.debug('Creating new contract from src tx');
    const { wallet, srcTxId, initState, data } = contractData;

    let contract;
    let responseOk: boolean;
    let response: { status: number; statusText: string; data: any };

    const effectiveUseBundler =
      disableBundling == undefined ? this.warp.definitionLoader.type() == 'warp' : !disableBundling;

    if (!effectiveUseBundler && isSigner(wallet)) {
      throw new Error('Only ArWallet | CustomSignature wallet type are allowed when bundling is disabled.');
    }

    if (effectiveUseBundler && !isSigner(wallet)) {
      throw new Error('Only Signer wallet type is allowed when bundling is enabled.');
    }

    const contractTags = {
      contract: [
        { name: SmartWeaveTags.APP_NAME, value: 'SmartWeaveContract' },
        { name: SmartWeaveTags.APP_VERSION, value: '0.3.0' },
        { name: SmartWeaveTags.CONTRACT_SRC_TX_ID, value: srcTxId },
        { name: SmartWeaveTags.SDK, value: 'Warp' },
        { name: SmartWeaveTags.NONCE, value: Date.now().toString() }
      ],
      contractData: [
        { name: SmartWeaveTags.CONTENT_TYPE, value: data && data['Content-Type'] },
        { name: SmartWeaveTags.INIT_STATE, value: initState }
      ],
      contractNonData: [{ name: SmartWeaveTags.CONTENT_TYPE, value: 'application/json' }],
      contractTestnet: [{ name: SmartWeaveTags.WARP_TESTNET, value: '1.0.0' }],
      contractEvaluationManifest: [
        { name: SmartWeaveTags.MANIFEST, value: JSON.stringify(contractData.evaluationManifest) }
      ]
    };

    if (!effectiveUseBundler) {
      ({ contract, responseOk } = await this.deployContractArweave(effectiveUseBundler, contractData, contractTags));
    } else {
      ({ contract, responseOk } = await this.deployContractBundlr(contractData, contractTags, srcTx));
    }

    if (responseOk) {
      return { contractTxId: contract.id, srcTxId };
    } else {
      throw new Error(
        `Unable to write Contract. Arweave responded with status ${response.status}: ${response.statusText}`
      );
    }
  }

  async deployBundled(rawDataItem: Buffer): Promise<ContractDeploy> {
    const response = await fetch(`${WARP_GW_URL}/gateway/contracts/deploy-bundled`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        Accept: 'application/json'
      },
      body: rawDataItem
    });
    if (response.ok) {
      return response.json();
    } else {
      if (typeof response.json === 'function') {
        response.json().then((responseError) => {
          if (responseError.message) {
            this.logger.error(responseError.message);
          }
        });
      }
      throw new Error(
        `Error while deploying data item. Warp Gateway responded with status ${response.status} ${response.statusText}`
      );
    }
  }

  async register(id: string, bundlrNode: BundlrNodeType): Promise<ContractDeploy> {
    const response = await fetch(`${WARP_GW_URL}/gateway/contracts/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({ id, bundlrNode })
    });
    if (response.ok) {
      return response.json();
    } else {
      if (typeof response.json === 'function') {
        response.json().then((responseError) => {
          if (responseError.message) {
            this.logger.error(responseError.message);
          }
        });
      }
      throw new Error(
        `Error while registering data item. Warp Gateway responded with status ${response.status} ${response.statusText}`
      );
    }
  }

  async createSource(
    sourceData: SourceData,
    wallet: ArWallet | CustomSignature | Signer,
    disableBundling: boolean = false
  ): Promise<Transaction | DataItem> {
    return this.source.createSource(sourceData, wallet, disableBundling);
  }

  async saveSource(srcTx: Transaction | DataItem, disableBundling?: boolean): Promise<string> {
    return this.source.saveSource(srcTx, disableBundling);
  }

  private async postContract(contract: Buffer, src: Buffer = null): Promise<any> {
    let body: any = {
      contract
    };
    if (src) {
      body = {
        ...body,
        src
      };
    }

    const response = await this.warpFetchWrapper.fetch(`${WARP_GW_URL}/gateway/v2/contracts/deploy`, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: {
        'Accept-Encoding': 'gzip, deflate, br',
        'Content-Type': 'application/json',
        Accept: 'application/json'
      }
    });

    if (response.ok) {
      return response.json();
    } else {
      throw new Error(
        `Error while posting contract. Sequencer responded with status ${response.status} ${response.statusText}`
      );
    }
  }

  private async deployContractArweave(
    effectiveUseBundler: boolean,
    contractData: FromSrcTxContractData,
    contractTags: any
  ): Promise<{ contract: Transaction; responseOk: boolean }> {
    const { wallet, initState, transfer, data, tags } = contractData;

    this.signature = new Signature(this.warp, wallet);
    !isSigner(wallet) && this.signature.checkNonArweaveSigningAvailability(effectiveUseBundler);
    const signer = this.signature.signer;
    !isSigner(wallet) && this.signature.checkNonArweaveSigningAvailability(effectiveUseBundler);

    let contract = await this.warp.arweave.createTransaction({ data: data?.body || initState });

    if (+transfer?.winstonQty > 0 && transfer.target.length) {
      this.logger.debug('Creating additional transaction with AR transfer', transfer);
      contract = await this.warp.arweave.createTransaction({
        data: data?.body || initState,
        target: transfer.target,
        quantity: transfer.winstonQty
      });
    }

    if (tags?.length) {
      for (const tag of tags) {
        contract.addTag(tag.name.toString(), tag.value.toString());
      }
    }
    contractTags.contract.forEach((t) => contract.addTag(t.name, t.value));
    if (data) {
      contractTags.contractData.forEach((t) => contract.addTag(t.name, t.value));
    } else {
      contractTags.contractNonData.forEach((t) => contract.addTag(t.name, t.value));
    }

    if (this.warp.environment === 'testnet') {
      contractTags.contractTestnet.forEach((t) => contract.addTag(t.name, t.value));
    }

    if (contractData.evaluationManifest) {
      contractTags.contractEvaluationManifest.forEach((t) => contract.addTag(t.name, t.value));
    }

    await signer(contract);

    const response = await this.warp.arweave.transactions.post(contract);
    return { contract, responseOk: response.status === 200 || response.status === 208 };
  }

  private async deployContractBundlr(
    contractData: FromSrcTxContractData,
    contractTags: any,
    src: Transaction | DataItem = null
  ): Promise<{ contract: DataItem; responseOk: boolean }> {
    const { wallet, initState, data, tags } = contractData;

    const contractDataItemTags: { name: string; value: string }[] = [...contractTags.contract];
    if (tags?.length) {
      for (const tag of tags) {
        contractDataItemTags.push({ name: tag.name.toString(), value: tag.value.toString() });
      }
    }
    if (data) {
      contractTags.contractData.forEach((t) => contractDataItemTags.push({ name: t.name, value: t.value }));
    } else {
      contractTags.contractNonData.forEach((t) => contractDataItemTags.push({ name: t.name, value: t.value }));
    }

    if (this.warp.environment === 'testnet') {
      contractTags.contractTestnet.forEach((t) => contractDataItemTags.push({ name: t.name, value: t.value }));
    }

    if (contractData.evaluationManifest) {
      contractTags.contractEvaluationManifest.forEach((t) =>
        contractDataItemTags.push({ name: t.name, value: t.value })
      );
    }

    const contract = createData(data?.body || initState, wallet, { tags: contractDataItemTags });
    await contract.sign(wallet);

    await this.postContract(contract.getRaw(), src?.getRaw());
    return { contract, responseOk: true };
  }

  isBundlrNodeType(value: string): value is BundlrNodeType {
    return BUNDLR_NODES.includes(value as BundlrNodeType);
  }
}
