import { QuickJSContext } from 'quickjs-emscripten';
import { LoggerFactory } from 'warp-contracts';
import { PNG } from 'pngjs';

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
      return this.vm.newString(png.toString('hex'));
    });
    const pngHandle = this.vm.newObject();
    this.vm.setProp(pngHandle, 'parse', parseHandle);
    this.vm.setProp(this.vm.global, 'PNG', pngHandle);
    pngHandle.dispose();
    parseHandle.dispose();
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
