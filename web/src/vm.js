import { RubyVM } from "@ruby/wasm-wasi";
import {
  PreopenDirectory,
  File,
  WASI,
  OpenFile,
  ConsoleStdout,
} from "@bjorn3/browser_wasi_shim";

import appURL from "./ruby-warrior-web.wasm?url";

export const gameDir = new PreopenDirectory("/game", {});

export default async function initVM() {
  console.log("Loading Wasm app...");
  const module = await WebAssembly.compileStreaming(fetch(appURL));
  console.log("Wasm app loaded");

  const output = [];
  output.flush = function() {
    return this.splice(0, this.length).join("\n");
  };

  const setStdout = function(val) {
    console.log(val);
    output.push(val);
  };

  const setStderr = function(val) {
    console.warn(val);
    output.push(`[warn] ${val}`);
  };

  const fds = [
    new OpenFile(new File([])),
    ConsoleStdout.lineBuffered(setStdout),
    ConsoleStdout.lineBuffered(setStderr),
    gameDir,
  ];
  const wasi = new WASI([], [], fds, { debug: false });
  const vm = new RubyVM();
  const imports = {
    wasi_snapshot_preview1: wasi.wasiImport,
  };
  vm.addToImports(imports);

  const instance = await WebAssembly.instantiate(module, imports);
  await vm.setInstance(instance);

  console.log("Initializing Wasm app...");
  wasi.initialize(instance);
  vm.initialize();
  vm.$output = output;

  vm.eval(`
    require "/bundle/setup"
    require "js"
    require "/app/lib/ruby_warrior"

    class StdinStub
      attr_reader :input
      def initialize(input) = @input = input

      def gets
        input.shift || ""
      end
    end

    module Kernel
      def sleep(val)
        JS.global[:$sleeper].do_sleep(val).await
      end
    end

    class ExternalStdout
      def print(val)
        JS.global[:$stdout].print(val)
      end

      def puts(val)
        JS.global[:$stdout].puts(val)
      end
    end

    class ExternalStderr
      def reset()
        JS.global[:$stderr].reset()
      end

      def print(val)
        JS.global[:$stderr].print(val)
      end

      def puts(val)
        JS.global[:$stderr].puts(val)
      end
    end
  `);

  console.log("Wasm app initialized");

  return vm;
}
