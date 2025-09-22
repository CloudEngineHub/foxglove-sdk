// ../../node_modules/@foxglove/embed/dist/esm/FoxgloveViewer.js
var TypedEventTarget = EventTarget;
var DEFAULT_SERVER = "https://embed.foxglove.dev/";
var SUPPORTED_CONNECTION_DATA_SOURCE_FILE_TYPES = [".bag", ".mcap"];
var FoxgloveViewer = class extends TypedEventTarget {
  /** The iframe element that contains the Foxglove app. */
  #iframe;
  /** The URL where the Foxglove app is hosted. */
  #server;
  #orgSlug;
  /** Whether the frame is ready to receive commands. */
  #isReady = false;
  /** Latest commands that have been queued to be executed when the frame is ready. */
  #latestCommands = {
    dataSource: void 0,
    layout: void 0,
    extension: []
  };
  /** Whether the frame has been destroyed. */
  #isDestroyed = false;
  constructor(options) {
    super();
    const { parent, src, orgSlug, initialDataSource, initialLayout, initialExtensions, colorScheme = "auto" } = options;
    this.#orgSlug = orgSlug;
    const srcUrl = src ?? DEFAULT_SERVER;
    try {
      this.#server = new URL(srcUrl);
    } catch {
      throw new Error(`[FoxgloveViewer] Invalid server URL: ${srcUrl}`);
    }
    window.addEventListener("message", this.#handleMessage);
    if (initialDataSource) {
      this.setDataSource(initialDataSource);
    }
    if (initialLayout != void 0) {
      this.setLayoutData(initialLayout);
    }
    if (initialExtensions) {
      this.installExtensions(initialExtensions);
    }
    this.#iframe = document.createElement("iframe");
    this.#iframe.src = srcUrl;
    this.#iframe.title = "Foxglove";
    this.#iframe.allow = "cross-origin-isolated";
    this.#iframe.style.width = "100%";
    this.#iframe.style.height = "100%";
    this.#iframe.style.border = "none";
    this.setColorScheme(colorScheme);
    parent.appendChild(this.#iframe);
  }
  /** Set the data source of the Foxglove app. */
  setDataSource(dataSource) {
    if (dataSource.type === "live") {
      const error = this.#validateLiveSourceUrl(dataSource.protocol, dataSource.url);
      if (error) {
        throw new Error(`[FoxgloveViewer] Error setting data source: ${error}`);
      }
    }
    this.#queueCommand({
      type: "set-data-source",
      payload: dataSource
    });
  }
  /**
   * Set the layout of the embedded viewer. The layout data should be a JSON file that was exported
   * from the Foxglove app.
   */
  setLayoutData(layout) {
    this.#queueCommand({
      type: "set-layout",
      payload: layout
    });
  }
  /**
   * Install a collection of extensions in the Foxglove app.
   * `extensions` is an array of `.foxe` file handles and/or URLs to a `.foxe` files.
   *
   * This method is not supported by all Foxglove versions and plans, so it may result in an `error` event.
   */
  installExtensions(extensions) {
    const invalidExtension = extensions.find((ext) => this.#validateExtension(ext));
    if (invalidExtension != void 0) {
      throw new Error(`[FoxgloveViewer] Error installing extension: ${this.#validateExtension(invalidExtension)}`);
    }
    this.#queueCommand({
      type: "install-extension",
      payload: extensions
    });
  }
  /** Whether the frame is ready to receive commands. */
  isReady() {
    return this.#isReady;
  }
  /** Destroy the frame. This will remove the iframe from the DOM and stop listening for messages. */
  destroy() {
    this.#isDestroyed = true;
    this.#iframe.remove();
    window.removeEventListener("message", this.#handleMessage);
  }
  /** Whether the frame has been destroyed. */
  isDestroyed() {
    return this.#isDestroyed;
  }
  /**
   * Change the color scheme used by the frame. When set to "auto", the system color scheme is used.
   */
  setColorScheme(colorScheme) {
    this.#iframe.style.colorScheme = colorScheme === "auto" ? "normal" : colorScheme;
  }
  /**
   * Queue a command to be executed when the frame is ready.
   *
   * Commands that are not `IframeHandshakeAckCommand` will be queued and executed when the frame is ready.
   * `IframeHandshakeAckCommand` commands will be posted as a response to the `HandshakeRequest` event.
   */
  #queueCommand(command) {
    if (command.type === "install-extension") {
      this.#latestCommands.extension.push(command);
    } else if (command.type === "set-data-source") {
      this.#latestCommands.dataSource = command;
    } else {
      this.#latestCommands.layout = command;
    }
    if (this.#isReady) {
      this.#postCommand(command);
    }
  }
  /** Post a command message to the Foxglove app. */
  #postCommand(message) {
    if (this.#isDestroyed) {
      console.warn("[FoxgloveViewer] Unable to post command. Frame has been destroyed.");
      return;
    }
    assert(this.#iframe.contentWindow, "Invariant: iframe should be loaded.");
    this.#iframe.contentWindow.postMessage(message, this.#server.href);
  }
  /** Validate a URL for a connection data source. */
  #validateLiveSourceUrl(protocol, value) {
    switch (protocol) {
      case "foxglove-websocket":
      case "rosbridge-websocket":
        if (!value.startsWith("ws://") && !value.startsWith("wss://")) {
          return "Invalid URL. The URL must start with ws:// or wss://.";
        }
        return void 0;
      case "remote-file":
        try {
          const extension = value.split(".").pop();
          if (!extension || extension.length === 0) {
            return "Invalid URL. The URL must end with a filename and extension.";
          }
          if (!SUPPORTED_CONNECTION_DATA_SOURCE_FILE_TYPES.includes(`.${extension}`)) {
            const supportedExtensions = new Intl.ListFormat("en-US", { style: "long" }).format(SUPPORTED_CONNECTION_DATA_SOURCE_FILE_TYPES);
            return `Invalid URL. Only ${supportedExtensions} files are supported.`;
          }
          return void 0;
        } catch (e) {
          return "Invalid URL.";
        }
    }
  }
  /** Validate an extension. */
  #validateExtension(extensionData) {
    if (typeof extensionData === "string") {
      const extension = extensionData.split(".").pop();
      if (!extension || extension.length === 0) {
        return "Invalid URL. The URL must end with a filename and extension.";
      }
      if (extension !== "foxe") {
        return "Invalid extension. The extension must be a .foxe file.";
      }
    } else {
      const extension = extensionData.name.split(".").pop();
      if (!extension || extension.length === 0 || extension !== "foxe") {
        return "Invalid extension. The extension must be a .foxe file.";
      }
    }
    return void 0;
  }
  /** Handle a message from the Foxglove app. */
  #handleMessage = (message) => {
    const originUrl = new URL(message.origin);
    if (message.source !== this.#iframe.contentWindow || originUrl.href !== this.#server.href) {
      return;
    }
    if (this.#isDestroyed) {
      console.warn("[FoxgloveViewer] Unable to handle message. Frame has been destroyed.");
      return;
    }
    switch (message.data.type) {
      case "foxglove-origin-request":
        this.#postCommand({ type: "origin-ack" });
        break;
      case "foxglove-handshake-request": {
        this.#isReady = true;
        this.#postCommand({
          type: "handshake-ack",
          payload: {
            orgSlug: this.#orgSlug,
            initialDataSource: this.#latestCommands.dataSource?.payload,
            initialLayout: this.#latestCommands.layout?.payload,
            initialExtensions: this.#latestCommands.extension.flatMap((command) => command.payload)
          }
        });
        break;
      }
      case "foxglove-handshake-complete": {
        this.dispatchEvent(new Event("ready"));
        break;
      }
      case "foxglove-error": {
        this.dispatchEvent(new CustomEvent("error", {
          detail: message.data.payload
        }));
        break;
      }
      default: {
        console.warn("[FoxgloveViewer] Unhandled message type:", message.data);
        break;
      }
    }
  };
};
function assert(condition, message = "no additional info provided") {
  if (!condition) {
    throw new Error("Assertion Error: " + message);
  }
}

// ts/widget.ts
function render({ model, el }) {
  function getDataSource() {
    const data = model.get("data");
    return data != void 0 ? {
      type: "file",
      file: new File([data.buffer], "data.mcap")
    } : void 0;
  }
  function getLayout() {
    const layout = model.get("layout");
    return JSON.stringify(layout) !== "{}" ? layout : void 0;
  }
  const parent = document.createElement("div");
  const viewer = new FoxgloveViewer({
    parent,
    src: model.get("src"),
    orgSlug: model.get("orgSlug") === "" ? void 0 : model.get("orgSlug"),
    initialDataSource: getDataSource(),
    initialLayout: getLayout()
  });
  parent.style.width = model.get("width");
  parent.style.height = model.get("height");
  model.on("change:width", () => {
    parent.style.width = model.get("width");
  });
  model.on("change:height", () => {
    parent.style.height = model.get("height");
  });
  model.on("change:data", () => {
    const dataSource = getDataSource();
    if (dataSource != void 0) {
      viewer.setDataSource(dataSource);
    }
  });
  model.on("change:layout", () => {
    const layout = getLayout();
    if (layout != void 0) {
      viewer.setLayoutData(layout);
    }
  });
  el.appendChild(parent);
}
var widget_default = { render };
export {
  widget_default as default
};
