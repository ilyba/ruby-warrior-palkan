# Ruby Warrior Web

This a web version of Ruby Warrior leveraging the original source code via [ruby.wasm](https://github.com/ruby/ruby.wasm).

## Instructions

- Install Rust toolchain:

  ```sh
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
  ```

- Install [wasi-vfs](https://github.com/kateinoigakukun/wasi-vfs)

- Prepare the Wasm module:

  ```sh
  # Install deps
  bundle install

  # build a WASI-compatible Ruby module
  bundle exec rbwasm build -o ruby-web.wasm

  # Add project files to the Wasm module
  wasi-vfs pack ruby-web.wasm --dir ./src::/app --dir ../bin::/app/bin --dir ../lib::/app/lib --dir ../templates::/app/templates --dir ../towers::/app/towers -o src/ruby-warrior-web.wasm
  ```

- Prepare and run the web app:

  ```sh
  yarn install

  yarn dev
  ```

Now you can access the game at [localhost:5173](http://localhost:5173/).
