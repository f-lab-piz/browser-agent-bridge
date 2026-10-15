import * as Original from "./original-runtime.mjs";
import { createOriginalAgent } from "./original-client.mjs";
import manifest from "./api.json" with { type: "json" };
import fs from "node:fs/promises";
import os from "node:os";
// 자체 브릿지의 어댑터. OpenAI 계정/앱의 권한 서비스에 연결하지 않는다.
const span = {
  withSpan: async (_n, _a, fn) => fn(),
  withCommandTelemetry: async (_n, _a, fn) => fn(),
  currentCommandAttrs: () => ({}),
  currentPlaywrightOperation: () => undefined,
};
const timing = {
  startLocatorRetry: () => ({ attemptFailed() {}, finish() {} }),
};
export const originalCommands = Object.values(Original.handlers).map(
  (h) => h.type,
);
export async function createBrowserAgent({
  transport,
  sessionId,
  emit = () => {},
}) {
  const contexts = new Map(),
    apis = new Map();
  async function inventory() {
    return transport("listBrowsers", {});
  }
  async function choose(id) {
    const all = await inventory();
    let b = all.find((x) => x.id === id);
    if (
      !b &&
      ["chrome", "extension", undefined].includes(id) &&
      all.length === 1
    )
      b = all[0];
    if (!b)
      throw Error(
        `Browser is not available: ${id}. Choose an ID from agent.browsers.list().`,
      );
    return b;
  }
  function makeApi(info) {
    const listeners = new Map();
    const api = {
      browserId: info.id,
      getCurrentSessionId: () => sessionId,
      matchesCurrentSessionId: (s) => s === sessionId,
      addEventListener(name, fn) {
        let set = listeners.get(name);
        if (!set) listeners.set(name, (set = new Set()));
        set.add(fn);
        return () => set.delete(fn);
      },
      emit(name, data) {
        for (const fn of listeners.get(name) ?? []) fn(data);
      },
      addCloseListener: () => () => {},
      getInfo: async () => info,
      executeCdpWithCachedExpression: (p) =>
        transport("native", {
          browserId: info.id,
          method: "executeCdp",
          args: [p],
        }),
      close: async () => {},
    };
    return new Proxy(api, {
      get(o, k) {
        if (k in o) return o[k];
        if (k === "then") return undefined;
        return async (...args) =>
          transport("native", { browserId: info.id, method: k, args });
      },
    });
  }
  async function context(id) {
    const info = await choose(id);
    if (contexts.has(info.id)) return contexts.get(info.id);
    const api = makeApi(info);
    apis.set(info.id, api);
    const ctx = {
      api,
      browserId: info.id,
      clientInfo: info,
      isIabBackend: false,
      environment: "standalone",
      performanceSpan: span,
      commandTiming: timing,
      getCurrentSessionId: () => sessionId,
      followSessionTab: async () => false,
      filesystem: {
        tmpDir: os.tmpdir(),
        mkdir: fs.mkdir,
        rm: fs.rm,
        readFile: (p) => fs.readFile(p, "utf8"),
        readBytes: fs.readFile,
        writeFile: fs.writeFile,
      },
      runtime: {
        env: {},
        platform: process.platform,
        fetch: globalThis.fetch,
        emitContentItem: emit,
        log() {},
        setResponseMeta() {},
        requestMeta: {},
      },
      tabLifecycle: {
        recordCreated() {},
        recordAcquired() {},
        needsReclaim: () => false,
        takeEvents: () => [],
      },
      preferences: { isWebMcpEnabled: async () => true },
      siteInstructions: { peek: () => undefined },
      supportsTabCapability: async (id) =>
        (info.capabilities?.tab ?? []).some((c) => c.id === id),
      history: (p) => api.getUserHistory(p),
      nameSession: (n) => api.nameSession(n),
      executeUnhandledCommand: (p) => api.executeUnhandledCommand(p),
    };
    // 외부 MCP 요청과 실제 Chrome 대상은 브로커의 토큰/탭 lease 및 이 정책을 모두 통과한다.
    async function ensure(command) {
      return transport("authorize", { browserId: info.id, command });
    }
    ctx.security = {
      ensureCommandAllowed: ensure,
      ensureDownloadAllowed: (tab, url) =>
        ensure({ type: "download", params: { tab_id: String(tab), url } }),
      ensureFileUploadAllowed: (tab) =>
        ensure({ type: "upload", params: { tab_id: String(tab) } }),
      ensurePageAssetFallbackFetchAllowed: (tab, url) =>
        ensure({ type: "asset_fetch", params: { tab_id: String(tab), url } }),
      runCommand: async (cmd, fn) => {
        await ensure(cmd);
        return fn();
      },
      runNavigation: async (tab, url, fn) => {
        await ensure({
          type: "navigate_tab_url",
          params: { tab_id: String(tab), url },
        });
        return fn();
      },
    };
    for (const name of [
      "ensureDownloadSourcePolicyAllowed",
      "ensureFullCdpAllowed",
      "ensurePageAssetDownloadAllowed",
      "ensureRawCdpUrlAllowed",
      "ensureUrlOriginAllowed",
    ])
      ctx.security[name] = async (...args) =>
        ensure({
          type: name,
          params: {
            url: args.find((x) => typeof x === "string" && /^https?:/.test(x)),
          },
        });
    ctx.cdp = new Original.Cdp(api, process.platform, span);
    ctx.ui = new Original.UI(api);
    ctx.cua = new Original.Cua(
      ctx.cdp,
      ctx.ui,
      "synthesizeScrollGesture",
      false,
    );
    ctx.tabs = new Original.Tabs(api);
    ctx.browserUser = new Original.BrowserUser(api);
    ctx.clipboard = new Original.Clipboard();
    ctx.dev = new Original.Dev(ctx.cdp);
    ctx.playwright = new Original.Playwright(
      ctx.cdp,
      ctx.cua,
      span,
      timing,
      false,
      {},
    );
    for (const method of [
      "ensurePlaywrightInjectedInTarget",
      "evaluateSingleSelectorWithTarget",
    ]) {
      const original = ctx.playwright[method];
      if (original)
        ctx.playwright[method] = async function (...args) {
          try {
            return await original.apply(this, args);
          } catch (error) {
            if (!this._reportedError) {
              emit({
                type: "text",
                text: "Browser adapter diagnostic: " + error.message,
              });
              this._reportedError = true;
            }
            throw error;
          }
        };
    }
    ctx.documentResponses = new Original.Responses(ctx.cdp);
    ctx.downloads = new Original.Downloads(
      api,
      ctx.documentResponses,
      ctx.security,
      "extension",
    );
    ctx.pageAssets = new Original.PageAssets(
      ctx.cdp,
      ctx.security,
      ctx.runtime,
      ctx.filesystem,
      info,
    );
    ctx.ax = new Original.AXController(
      ctx.cdp,
      () => sessionId,
      new Original.AXActions(ctx),
      { getTab: (i) => ctx.tabs.get(i), observeNavigations: true },
    );
    contexts.set(info.id, ctx);
    return ctx;
  }
  async function execute(cmd) {
    const { type, ...params } = cmd;
    if (type === "list_browsers") return inventory();
    if (
      ["get_browser", "get_default_browser", "get_browser_for_url"].includes(
        type,
      )
    )
      return choose(params.id);
    if (type === "get_documentation")
      return transport("documentation", { name: params.name });
    if (type === "get_browser_documentation")
      return Original.renderApiDocumentation(manifest, "extension");
    const ctx = await context(params.browser_id);
    await ctx.security.ensureCommandAllowed({ type, params });
    if (type === "tab_ax_get_state" || type === "tab_ax_action")
      await Original.initializeCore(
        new URL("./browser-accessibility.wasm.br", import.meta.url),
        { env: {} },
      );
    const handler = Object.values(Original.handlers).find(
      (h) => h.type === type,
    );
    if (handler) return handler(params, ctx, Promise.resolve());
    return ctx.api.executeUnhandledCommand({ type, ...params });
  }
  function decorateTab(tab) {
    return Object.assign(tab, {
      async getAXState(options = {}) {
        const value = await tab.ax.get("state", {
          disableDiffing: options.disableDiffing,
        });
        if (options.emit !== false) emit({ type: "text", text: value });
        return value;
      },
      async getScreenshot(options = {}) {
        const value = await tab.ax.get("screenshot");
        if (options.emit !== false)
          emit({
            type: "image",
            data: Buffer.from(value).toString("base64"),
            mimeType: "image/png",
          });
        return value;
      },
      async getAXStateAndScreenshot(options = {}) {
        const value = await tab.ax.get("both", {
          disableDiffing: options.disableDiffing,
        });
        if (options.emit !== false) {
          emit({ type: "text", text: value.state });
          if (value.screenshot)
            emit({
              type: "image",
              data: Buffer.from(value.screenshot).toString("base64"),
              mimeType: "image/png",
            });
        }
        return value;
      },
      click: (...a) => tab.ax.click(...a),
      drag: (...a) => tab.ax.drag(...a),
      scroll: (...a) => tab.ax.scroll(...a),
      typeText: (...a) => tab.ax.typeText(...a),
      paste: (...a) => tab.ax.paste(...a),
      pressKey: (...a) => tab.ax.pressKey(...a),
      setValue: (...a) => tab.ax.setValue(...a),
      selectText: (...a) => tab.ax.selectText(...a),
      performSecondaryAction: (...a) => tab.ax.performSecondaryAction(...a),
    });
  }
  const agent = createOriginalAgent({
    apiManifest: manifest,
    disabledMemberIds: new Set(),
    decorateTab,
    displayBridge: {
      displayImage: (img) => emit({ type: "image", ...img }),
      displayValue: (v) =>
        emit({
          type: "text",
          text: typeof v === "string" ? v : JSON.stringify(v),
        }),
    },
    executeAgentCommand: execute,
  });
  const cua = {
    async listBrowsers() {
      return agent.browsers.list();
    },
    async getBrowser(ref = {}) {
      if (typeof ref === "string") ref = { id: ref };
      let selected;
      if (ref.url) {
        const matches = [];
        for (const info of await inventory()) {
          const b = await agent.browsers.get(info.id);
          if ((await b.tabs.list()).some((t) => t.url === ref.url))
            matches.push(info);
        }
        if (matches.length !== 1)
          throw Error(
            `Expected one browser containing URL; found ${matches.length}. Specify browser ID.`,
          );
        selected = matches[0];
      } else selected = await choose(ref.id);
      return agent.browsers.get(selected.id);
    },
    async listTabs({ browser } = {}) {
      const infos = browser ? [await choose(browser)] : await inventory();
      return (
        await Promise.all(
          infos.map(async (info) => {
            const b = await agent.browsers.get(info.id);
            return (await b.tabs.list()).map((t) => ({
              ...t,
              browserId: info.id,
            }));
          }),
        )
      ).flat();
    },
    async getTab(ref, { browser } = {}) {
      if (ref?.mention)
        throw Error(
          "Codex tab mention URLs are app-specific. Use a tab ID or URL.",
        );
      const b = await this.getBrowser(
        typeof ref === "object" && ref.url && !browser
          ? { url: ref.url }
          : { id: browser },
      );
      let id = ref;
      if (typeof ref === "object") {
        const matches = (await b.tabs.list()).filter((t) => t.url === ref.url);
        if (matches.length !== 1)
          throw Error("Expected exactly one tab for URL. Use its tab ID.");
        id = matches[0].id;
      }
      const tab = await b.tabs.get(String(id));
      await tab.getAXState();
      return tab;
    },
    async createBrowserTab(browser, url, options = {}) {
      const b = await this.getBrowser({ id: browser });
      const tab = await b.tabs.new();
      if (url) await tab.goto(url);
      if (options.visible)
        await (await b.capabilities.get("visibility")).set(true);
      await tab.getAXState();
      return tab;
    },
    async getState() {
      const browsers = await this.listBrowsers();
      return {
        apps: [],
        browsers: await Promise.all(
          browsers.map(async (b) => ({
            ...b,
            tabs: await this.listTabs({ browser: b.id }),
          })),
        ),
      };
    },
  };
  return {
    agent,
    cua,
    onEvent(browserId, name, data) {
      apis.get(browserId)?.emit(name, data);
    },
    async dispose() {
      for (const ctx of contexts.values()) {
        await ctx.clipboard.dispose();
        ctx.ax.dispose();
        await ctx.cdp.detachAllTabs();
      }
      contexts.clear();
    },
  };
}
