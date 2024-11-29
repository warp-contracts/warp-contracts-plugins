import { QuickJSContext } from 'quickjs-emscripten';
import { LoggerFactory } from 'warp-contracts';
import { PNG } from 'pngjs';
import seedrandom from 'seedrandom';
import { SignedDataPackage } from '@redstone-finance/protocol';

export class QuickJsEvaluator {
  private readonly logger = LoggerFactory.INST.create('QuickJsEvaluator');

  constructor(private vm: QuickJSContext) {}

  evalLogging() {
    const logHandle = this.vm.newFunction('log', (...args) => {
      const nativeArgs = args.map(this.vm.dump);
      console.log(...nativeArgs);
    });
    const consoleHandle = this.vm.newObject();
    this.vm.setProp(consoleHandle, 'log', logHandle);
    this.vm.setProp(this.vm.global, 'console', consoleHandle);
    consoleHandle.dispose();
    logHandle.dispose();
  }

  evalPngJS() {
    const parseHandle = this.vm.newFunction('parse', (arg) => {
      const png = PNG.sync.write(this.vm.dump(arg));
      // vm.newArrayBuffer doesn't work as expected, so we return string
      // https://github.com/justjake/quickjs-emscripten/issues/167
      return this.vm.newString(png.toString('base64'));
    });
    const pngHandle = this.vm.newObject();
    this.vm.setProp(pngHandle, 'parse', parseHandle);
    this.vm.setProp(this.vm.global, 'PNG', pngHandle);
    pngHandle.dispose();
    parseHandle.dispose();
  }

  evalSeedRandom() {
    const randomHandle = this.vm.newFunction('random', (...args) => {
      const nativeArgs = args.map(this.vm.dump);
      const message = nativeArgs[0];
      const uniqueValue = nativeArgs.length > 1 ? '' + nativeArgs[1] : '';
      const rng = seedrandom(message.Signature + uniqueValue);
      return this.vm.newNumber(rng());
    });
    const warpHandle = this.vm.newObject();
    this.vm.setProp(warpHandle, 'random', randomHandle);
    this.vm.setProp(this.vm.global, 'Warp', warpHandle);
    warpHandle.dispose();
    randomHandle.dispose();
  }

  evalReadFile() {
    const fakeFileSystem = new Map([['example.txt', 'Example file content']]);

    // Function that simulates reading data asynchronously
    const readFileHandle = this.vm.newFunction('readFile', (pathHandle) => {
      const path = this.vm.getString(pathHandle);
      const promise = this.vm.newPromise();
      setTimeout(() => {
        const content = fakeFileSystem.get(path);
        promise.resolve(this.vm.newString(content || ''));
      }, 100);
      // IMPORTANT: Once you resolve an async action inside QuickJS,
      // call runtime.executePendingJobs() to run any code that was
      // waiting on the promise or callback.
      promise.settled.then(this.vm.runtime.executePendingJobs);
      return promise.handle;
    });
    this.vm.setProp(this.vm.global, 'readFile', readFileHandle);
    readFileHandle.dispose();
  }

  evalExternal() {
    const self = this;
    self.logger.info('Inside eval external');
    const readExternalHandle = this.vm.newFunction('readExternal', () => {
      self.logger.info('Inside read external handle');
      const promise = this.vm.newPromise(this.readRes);
      promise.settled.then(this.vm.runtime.executePendingJobs);
      return promise.handle;
    });
    const externalHandle = this.vm.newObject();
    this.vm.setProp(externalHandle, 'readExternal', readExternalHandle);
    this.vm.setProp(this.vm.global, 'External', externalHandle);
    externalHandle.dispose();
    readExternalHandle.dispose();
  }

  async readRes() {
    const { dryrun } = await import('@permaweb/aoconnect');
    const readRes = await dryrun({
      process: 'iWM-odlyQHopPECpyz465p7ED8lm5d3hyyWtijKhie4',
      tags: [{ name: 'Action', value: 'Read-Hollow' }],
      data: '1234'
    });
    return JSON.parse(readRes.Messages[0].Data);
  }

  evalRedStone() {
    const recoverSignerAddressHandle = this.vm.newFunction('recoverSignerAddress', (...args) => {
      const nativeArgs = args.map(this.vm.dump);
      const pricePackage = nativeArgs[0];
      const pricePackageObj = JSON.parse(pricePackage);
      const signedDataPackage = SignedDataPackage.fromObj(pricePackageObj);
      const recoveredSignerAddress = signedDataPackage.recoverSignerAddress();
      const result = JSON.stringify({
        a: recoveredSignerAddress,
        t: pricePackageObj.timestampMilliseconds,
        v: pricePackageObj.dataPoints[0].value
      });
      return this.vm.newString(result);
    });
    const redstoneHandle = this.vm.newObject();
    this.vm.setProp(redstoneHandle, 'recoverSignerAddress', recoverSignerAddressHandle);
    this.vm.setProp(this.vm.global, 'RedStone', redstoneHandle);
    redstoneHandle.dispose();
    recoverSignerAddressHandle.dispose();
  }

  evalGlobalsCode(globalsCode: string) {
    const globalsResult = this.vm.evalCode(globalsCode);
    if (globalsResult.error) {
      globalsResult.error.dispose();
      this.logger.error(`Globals eval failed: ${this.vm.dump(globalsResult.error)}`);
      throw new Error(`Globals eval failed: ${this.vm.dump(globalsResult.error)}`);
    } else {
      globalsResult.value.dispose();
    }
  }

  evalHandleFnCode(handleFn: (contractSrc: string) => string, contractSrc: string) {
    const handleFnResult = this.vm.evalCode(handleFn(contractSrc));
    if (handleFnResult.error) {
      handleFnResult.error.dispose();
      this.logger.debug(`HandleFn eval failed: ${this.vm.dump(handleFnResult.error)}`);
      throw new Error(`HandleFn eval failed:${this.vm.dump(handleFnResult.error)}`);
    } else {
      handleFnResult.value.dispose();
    }
  }
}
