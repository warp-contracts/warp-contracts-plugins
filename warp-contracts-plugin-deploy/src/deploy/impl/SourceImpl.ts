/* eslint-disable */
import metering from 'redstone-wasm-metering';
import fs, { PathOrFileDescriptor } from 'fs';
import { Buffer } from 'redstone-isomorphic';
import Transaction from 'arweave/node/lib/transaction';
import {
  LoggerFactory,
  Signature,
  SmartWeaveTags,
  Warp,
  WARP_GW_URL,
  Go,
  matchMutClosureDtor,
  ContractType,
  ArWallet,
  CustomSignature,
  TagsParser,
  Source,
  SourceData,
  Signer,
  DataItem
} from 'warp-contracts';
import { createData } from 'arbundles';
import { isDataItem, isSigner } from '../../deploy/utils';

const wasmTypeMapping: Map<number, string> = new Map([
  [1, 'assemblyscript'],
  [2, 'rust'],
  [3, 'go']
  /*[4, 'swift'],
  [5, 'c']*/
]);

export class SourceImpl implements Source {
  private readonly logger = LoggerFactory.INST.create('Source');
  private signature: Signature;

  constructor(private readonly warp: Warp) {}

  async createSourceTx(
    sourceData: SourceData,
    wallet: ArWallet | CustomSignature | Signer,
    disableBundling: boolean = false
  ): Promise<DataItem | Transaction> {
    this.logger.debug('Creating new contract source');

    const { src, wasmSrcCodeDir, wasmGlueCode } = sourceData;

    if (this.warp.environment == 'local') {
      disableBundling = true;
    }

    const effectiveUseBundler =
      disableBundling == undefined ? this.warp.definitionLoader.type() == 'warp' : !disableBundling;

    //TODO: check these errors -.-
    if (!effectiveUseBundler && isSigner(wallet)) {
      throw new Error('Only ArWallet | CustomSignature wallet type are allowed when bundling is disabled.');
    }

    if (effectiveUseBundler && !isSigner(wallet)) {
      throw new Error('Only Signer wallet type is allowed when bundling is enabled.');
    }

    const contractType: ContractType = src instanceof Buffer ? 'wasm' : 'js';
    let srcTx, srcDataItem;
    let wasmLang = null;
    let wasmVersion = null;
    const metadata = {};

    const data: Buffer[] = [];

    if (contractType == 'wasm') {
      const meteredWasmBinary = metering.meterWASM(src, {
        meterType: 'i32'
      });
      data.push(meteredWasmBinary);

      const wasmModule = await WebAssembly.compile(src as Buffer);
      const moduleImports = WebAssembly.Module.imports(wasmModule);
      let lang: number;

      if (this.isGoModule(moduleImports)) {
        const go = new Go(null);
        const module = new WebAssembly.Instance(wasmModule, go.importObject);
        // DO NOT await here!
        go.run(module);
        lang = go.exports.lang();
        wasmVersion = go.exports.version();
      } else {
        // @ts-ignore
        const module: WebAssembly.Instance = await WebAssembly.instantiate(src, dummyImports(moduleImports));
        // @ts-ignore
        if (!module.instance.exports.lang) {
          throw new Error(`No info about source type in wasm binary. Did you forget to export "lang" function?`);
        }
        // @ts-ignore
        lang = module.instance.exports.lang();
        // @ts-ignore
        wasmVersion = module.instance.exports.version();
        if (!wasmTypeMapping.has(lang)) {
          throw new Error(`Unknown wasm source type ${lang}`);
        }
      }

      wasmLang = wasmTypeMapping.get(lang);
      if (wasmSrcCodeDir == null) {
        throw new Error('No path to original wasm contract source code');
      }

      const zippedSourceCode = await this.zipContents(wasmSrcCodeDir);
      data.push(zippedSourceCode);

      if (wasmLang == 'rust') {
        if (!wasmGlueCode) {
          throw new Error('No path to generated wasm-bindgen js code');
        }
        const wasmBindgenSrc = fs.readFileSync(wasmGlueCode, 'utf-8');
        const dtor = matchMutClosureDtor(wasmBindgenSrc);
        metadata['dtor'] = parseInt(dtor);
        data.push(Buffer.from(wasmBindgenSrc));
      }
    }

    const allData = contractType == 'wasm' ? this.joinBuffers(data) : src;

    const srcTags = [
      { name: SmartWeaveTags.APP_NAME, value: 'SmartWeaveContractSource' },
      { name: SmartWeaveTags.APP_VERSION, value: '0.3.0' },
      { name: SmartWeaveTags.SDK, value: 'Warp' },
      { name: SmartWeaveTags.NONCE, value: Date.now().toString() },
      {
        name: SmartWeaveTags.CONTENT_TYPE,
        value: contractType == 'js' ? 'application/javascript' : 'application/wasm'
      }
    ];

    const srcWasmTags = [
      { name: SmartWeaveTags.WASM_LANG, value: wasmLang },
      { name: SmartWeaveTags.WASM_LANG_VERSION, value: wasmVersion },
      { name: SmartWeaveTags.WASM_META, value: JSON.stringify(metadata) }
    ];

    if (disableBundling) {
      this.signature = new Signature(this.warp, wallet as ArWallet | CustomSignature);
      if (!isSigner(wallet) && this.signature.type !== 'arweave') {
        throw new Error(`Unable to use signing function of type: ${this.signature.type}.`);
      }
      const signer = this.signature.signer;
      srcTx = await this.warp.arweave.createTransaction({ data: allData });
      srcTags.forEach((t) => srcTx.addTag(t.name, t.value));

      if (contractType == 'wasm') {
        srcWasmTags.forEach((t) => srcTx.addTag(t.name, t.value));
      }

      if (this.warp.environment === 'testnet') {
        srcTx.addTag(SmartWeaveTags.WARP_TESTNET, '1.0.0');
      }

      await signer(srcTx);

      this.logger.debug('Posting transaction with source');

      return srcTx;
    } else {
      const srcDataItemTags = [...srcTags];
      if (contractType == 'wasm') {
        srcWasmTags.forEach((t) => srcDataItemTags.push({ name: t.name, value: t.value }));
      }

      if (this.warp.environment === 'testnet') {
        srcDataItemTags.push({ name: SmartWeaveTags.WARP_TESTNET, value: '1.0.0' });
      }

      srcDataItem = createData(allData, wallet as Signer, { tags: srcTags });
      await srcDataItem.sign(wallet as Signer);
      this.logger.debug('Posting transaction with source');

      return srcDataItem;
    }
  }

  async saveSourceTx(srcTx: DataItem | Transaction, disableBundling?: boolean): Promise<string> {
    this.logger.debug('Saving contract source', srcTx.id);

    if (this.warp.environment == 'local') {
      disableBundling = true;
    }

    const effectiveUseBundler =
      disableBundling == undefined ? this.warp.definitionLoader.type() == 'warp' : !disableBundling;

    if (isDataItem(srcTx) && !effectiveUseBundler) {
      throw new Error(`Unable to save data item when bundling is disabled.`);
    }

    // TODO: check the signature type
    if (!isDataItem(srcTx)) {
      const tagsParser = new TagsParser();
      const signatureTag = tagsParser.getTag(srcTx, SmartWeaveTags.SIGNATURE_TYPE);
      if (signatureTag && signatureTag != 'arweave' && !effectiveUseBundler) {
        throw new Error(`Unable to save source with signature type: ${signatureTag} when bundling is disabled.`);
      }
    }

    let responseOk: boolean;
    let response: { status: number; statusText: string; data: any };

    if (effectiveUseBundler) {
      const result = await this.postSource(srcTx.getRaw());
      this.logger.debug(result);
      responseOk = true;
    } else {
      response = await this.warp.arweave.transactions.post(srcTx);
      responseOk = response.status === 200 || response.status === 208;
    }

    if (responseOk) {
      return srcTx.id;
    } else {
      throw new Error(
        `Unable to write Contract Source. Arweave responded with status ${response.status}: ${response.statusText}`
      );
    }
  }

  private isGoModule(moduleImports: WebAssembly.ModuleImportDescriptor[]) {
    return moduleImports.some((moduleImport) => {
      return moduleImport.module == 'env' && moduleImport.name.startsWith('syscall/js');
    });
  }

  private joinBuffers(buffers: Buffer[]): Buffer {
    const length = buffers.length;
    const result = [];
    result.push(Buffer.from(length.toString()));
    result.push(Buffer.from('|'));
    buffers.forEach((b) => {
      result.push(Buffer.from(b.length.toString()));
      result.push(Buffer.from('|'));
    });
    result.push(...buffers);
    return result.reduce((prev, b) => Buffer.concat([prev, b]));
  }

  private async zipContents(source: PathOrFileDescriptor): Promise<Buffer> {
    const archiver = require('archiver'),
      streamBuffers = require('stream-buffers');
    const outputStreamBuffer = new streamBuffers.WritableStreamBuffer({
      initialSize: 1000 * 1024, // start at 1000 kilobytes.
      incrementAmount: 1000 * 1024 // grow by 1000 kilobytes each time buffer overflows.
    });
    const archive = archiver('zip', {
      zlib: { level: 9 } // Sets the compression level.
    });
    archive.on('error', function (err: any) {
      throw err;
    });
    archive.pipe(outputStreamBuffer);
    archive.directory(source.toString(), source.toString());
    await archive.finalize();
    outputStreamBuffer.end();

    return outputStreamBuffer.getContents();
  }

  private async postSource(srcDataItem: Buffer): Promise<any> {
    const response = await fetch(`${WARP_GW_URL}/gateway/v2/sources/deploy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        Accept: 'application/json'
      },
      body: srcDataItem
    });

    if (response.ok) {
      return response.json();
    } else {
      throw new Error(
        `Error while posting contract source. Sequencer responded with status ${response.status} ${response.statusText}`
      );
    }
  }
}

function dummyImports(moduleImports: WebAssembly.ModuleImportDescriptor[]) {
  const imports = {};

  moduleImports.forEach((moduleImport) => {
    if (!Object.prototype.hasOwnProperty.call(imports, moduleImport.module)) {
      imports[moduleImport.module] = {};
    }
    imports[moduleImport.module][moduleImport.name] = function () {};
  });

  return imports;
}
