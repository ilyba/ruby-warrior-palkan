class OutputPrinter {
  RESET_PHRASES =
    /(- turn \d+ -|Success! You have found the stairs|CONGRATULATIONS!|Sorry, you failed level)/;

  IGNORE_PHRASES = /(\[yn\]|See the updated README)/;

  constructor(el) {
    this.el = el;
  }

  print(val) {
    console.log(val);

    if (this.IGNORE_PHRASES.test(val)) return;

    if (this.RESET_PHRASES.test(val)) {
      this.el.innerText = "";
    }
    this.el.innerText += val;
  }

  puts(val) {
    this.print(val + "\n");
  }
}

class Sleeper {
  do_sleep(val) {
    if (this.terminating) return Promise.reject("Terminated");

    if (this.pausePromise) return this.pausePromise;

    return new Promise((resolve) => {
      setTimeout(resolve, val * 1000);
    });
  }

  terminate() {
    this.terminating = true;
  }

  pause() {
    if (this.pausePromise) return this.pausePromise;

    let resumer;

    this.pausePromise = new Promise((resolve) => {
      resumer = resolve;
    });

    this.resumer = resumer;

    return this.pausePromise;
  }

  resume() {
    if (!this.pausePromise) return;

    const resumer = this.resumer;

    delete this.pausePromise;
    delete this.resumer;

    resumer();
  }
}

class Game {
  constructor(vm, name, skillLevel) {
    this.vm = vm;
    this.name = name;
    this.skillLevel = skillLevel;
    this.paused = false;
  }

  async start() {
    const loaded = await this.load();

    if (loaded) return;

    await this.vm.evalAsync(`
      RubyWarrior::Runner.new(%w[-d /game], StdinStub.new(%w[y ${this.skillLevel} ${this.name}]), STDOUT).run
    `);

    const output = this.vm.$output.flush();

    // find the path to the game directory from the output
    const match = output.match(/See the (.+)\/README for instructions/);
    if (!match) {
      throw new Error("Failed to find game directory path");
    }

    this.gameDir = `/game/${match[1]}`;
  }

  get readme() {
    return this.vm.eval(`File.read("${this.gameDir}/README")`).toString();
  }

  get playerrb() {
    return this.vm.eval(`File.read("${this.gameDir}/player.rb")`).toString();
  }

  get profile() {
    return this.vm.eval(`File.read("${this.gameDir}/.profile")`).toString();
  }

  async play(input, output) {
    window.$stdout = new OutputPrinter(output);
    window.$sleeper = this.sleeper = new Sleeper();

    let res = await this.vm.evalAsync(`
      File.write("${this.gameDir}/player.rb", <<~'SRC'
${input}
      SRC
      )
      RubyWarrior::Runner.new(%w[-d ${this.gameDir}], StdinStub.new(%w[y y]), ExternalStdout.new).run
    `);

    this.save();

    return res;
  }

  pauseResume() {
    if (!this.sleeper) return;

    if (this.paused) {
      this.paused = false;
      this.sleeper.resume();
    } else {
      this.paused = true;
      this.sleeper.pause();
    }
  }

  interrupt() {
    this.sleeper.terminate();
  }

  async load() {
    const entry = localStorage.getItem(this.cacheKey);

    if (!entry) return false;

    const { gameDir, profile, playerrb, readme } = JSON.parse(entry);

    this.gameDir = gameDir;

    await this.vm.evalAsync(`
FileUtils.mkdir_p("${this.gameDir}")
File.write("${this.gameDir}/.profile", <<~'SRC'
${profile}
SRC
)
File.write("${this.gameDir}/player.rb", <<~'SRC'
${playerrb}
SRC
)
File.write("${this.gameDir}/README", <<~'SRC'
${readme}
SRC
)
`);

    return true;
  }

  save() {
    const entry = {
      gameDir: this.gameDir,
      profile: this.profile,
      playerrb: this.playerrb,
      readme: this.readme,
    };

    localStorage.setItem(this.cacheKey, JSON.stringify(entry));
  }

  get cacheKey() {
    return `rw-${this.encodedName}-${this.skillLevel}`;
  }

  get encodedName() {
    return this.name.replace(/\s/, "-");
  }
}

export const start = async (vm, name, skillLevel) => {
  const game = new Game(vm, name, skillLevel);
  await game.start();
  return game;
};
