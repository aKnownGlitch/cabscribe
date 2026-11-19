const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const { runInNewContext } = require("node:vm");

function loadDesktop() {
  const handlers = new Map();
  const writes = [];
  const messages = [];
  const contents = {
    mainFrame: {},
    setWindowOpenHandler() {},
    on() {},
    send: (channel, payload) => messages.push({ channel, ...payload }),
  };
  const event = { sender: contents, senderFrame: contents.mainFrame };
  let bridge;
  let port;
  class MockPort extends EventEmitter {
    static async list() { return [{ path: "test-port" }]; }
    constructor() {
      super();
      port = this;
    }
    open(done) { this.isOpen = true; done(); }
    write(command, done) { writes.push(command); done(); }
    drain(done) { done(this.drainError); }
  }
  const electron = {
    app: { whenReady: () => ({ then: (ready) => ready() }), on() {} },
    BrowserWindow: class {
      webContents = contents;
      on() {}
      async loadFile() {}
    },
    ipcMain: { handle: (channel, handler) => handlers.set(channel, handler) },
    contextBridge: { exposeInMainWorld: (_name, value) => { bridge = value; } },
    ipcRenderer: {
      invoke: (channel, ...args) => handlers.get(channel)(event, ...args),
    },
  };
  for (const file of ["main.cjs", "preload.cjs"]) {
    const filename = path.resolve(__dirname, "../src", file);
    runInNewContext(readFileSync(filename, "utf8"), {
      __dirname: path.dirname(filename),
      require: (id) => {
        if (id === "electron") return electron;
        if (id === "serialport") return { SerialPort: MockPort };
        return require(id);
      },
    }, { filename });
  }
  return { bridge, handlers, event, writes, messages, getPort: () => port };
}

test("desktop status IPC writes and drains only the fixed query", async () => {
  const { bridge, writes, messages, getPort } = loadDesktop();
  await assert.rejects(bridge.requestStationStatus(), /Connect to a command station/);
  const connection = await bridge.connect("test-port");
  assert.equal(connection.capabilities.stationStatus, true);
  await bridge.requestStationStatus();
  assert.deepEqual(writes, ["<s>"]);
  assert.deepEqual(messages, [{
    channel: "cabscribe:serial:message",
    direction: "outgoing",
    message: "<s>",
  }]);

  getPort().drainError = new Error("Device removed");
  await assert.rejects(bridge.requestStationStatus(), /transmission failed: Device removed/);
  assert.equal(messages.length, 1);
});

test("desktop status IPC rejects unexpected arguments and non-app frames without writing", async () => {
  const { bridge, handlers, event, writes } = loadDesktop();
  await bridge.connect("test-port");
  const handle = handlers.get("cabscribe:dcc:station-status");
  await assert.rejects(handle(event, "unexpected"), /does not accept arguments/);
  await assert.rejects(handle({ ...event, senderFrame: {} }), /app window/);
  assert.deepEqual(writes, []);
});

test("desktop track list uses a fixed read-only request and rejects arguments", async () => {
  const { bridge, handlers, event, writes } = loadDesktop();
  assert.equal((await bridge.connect("test-port")).capabilities.trackList, true);
  await assert.rejects(handlers.get("cabscribe:dcc:track-list")(event, "A"), /does not accept arguments/);
  await bridge.requestTrackList();
  assert.deepEqual(writes, ["<=>"]);
});
