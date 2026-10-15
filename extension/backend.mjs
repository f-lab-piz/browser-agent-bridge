// Chrome API 실행 계층. Node 브릿지의 원본 SDK가 호출하는 Native API 어댑터.
export function createChromeBackend(chrome, emit = () => {}) {
  const attached = new Set();
  const owned = new Map(),
    marks = new Map(),
    viewports = new Map();
  let sessionName = "",
    visible = true;
  const info = (t) => ({
    id: t.id,
    providerTabId: String(t.id),
    title: t.title,
    url: t.url,
    active: t.active,
    sessionControlled: owned.has(t.id),
  });
  const debuggee = (t) =>
    t.sessionId
      ? { tabId: t.tabId, sessionId: t.sessionId }
      : t.targetId
        ? { targetId: t.targetId }
        : { tabId: t.tabId };
  const call = (target, method, params = {}) =>
    chrome.debugger.sendCommand(debuggee(target), method, params);
  function download(d, status) {
    emit("onDownloadChange", {
      id: String(d.id),
      filename: d.filename ?? "",
      url: d.finalUrl ?? d.url,
      status,
    });
  }
  chrome.debugger.onEvent.addListener((source, method, params) =>
    emit("onCDPEvent", { source, method, params }),
  );
  chrome.debugger.onDetach.addListener((source, reason) => {
    attached.delete(source.tabId);
    emit("onCDPDetach", { ...source, reason });
  });
  chrome.downloads?.onCreated.addListener((d) => download(d, "started"));
  chrome.downloads?.onChanged.addListener(async (d) => {
    const [x] = await chrome.downloads.search({ id: d.id });
    if (x)
      download(
        x,
        x.state === "complete"
          ? "complete"
          : x.state === "interrupted"
            ? "interrupted"
            : "in_progress",
      );
  });
  const methods = {
    async attach(tabId) {
      if (this?.sessionId) owned.set(tabId, this.sessionId);
      if (attached.has(tabId)) return;
      await chrome.debugger.attach({ tabId }, "1.3");
      attached.add(tabId);
    },
    async detach(tabId) {
      await chrome.debugger.detach({ tabId });
      attached.delete(tabId);
    },
    async attachTarget(tabId, targetId) {
      await chrome.debugger.attach({ targetId }, "1.3");
    },
    async detachTarget(tabId, targetId) {
      await chrome.debugger.detach({ targetId });
    },
    async executeCdp(p) {
      if (p.method === "Target.getTargets")
        return {
          targetInfos: (await chrome.debugger.getTargets()).map((t) => ({
            ...t,
            targetId: t.id,
          })),
        };
      if (p.method === "Target.getTargetInfo") {
        const targets = await chrome.debugger.getTargets();
        const t = targets.find((t) =>
          p.commandParams?.targetId
            ? t.id === p.commandParams.targetId
            : t.tabId === p.target.tabId,
        );
        if (!t) throw Error("Target unavailable");
        return { targetInfo: { ...t, targetId: t.id } };
      }
      if (
        p.method === "Page.close" &&
        !p.target.sessionId &&
        !p.target.targetId
      ) {
        await chrome.tabs.remove(p.target.tabId);
        owned.delete(p.target.tabId);
        return {};
      }
      if (p.method === "Target.closeTarget") {
        const t = (await chrome.debugger.getTargets()).find(
          (t) => t.id === p.commandParams.targetId,
        );
        if (t?.tabId) {
          await chrome.tabs.remove(t.tabId);
          owned.delete(t.tabId);
          return { success: true };
        }
      }
      try {
        return await call(p.target, p.method, p.commandParams ?? {});
      } catch (error) {
        throw Error(`CDP ${p.method}: ${error.message ?? error}`);
      }
    },
    async getTabs() {
      return (await chrome.tabs.query({})).map(info);
    },
    async getUserTabs() {
      return (await chrome.tabs.query({})).map(info);
    },
    async getCommittedTabUrl(id) {
      return (await chrome.tabs.get(id)).url;
    },
    async createTab(windowId) {
      const t = await chrome.tabs.create({
        url: "about:blank",
        active: false,
        ...(windowId ? { windowId } : {}),
      });
      owned.set(t.id, this.sessionId);
      const viewport = viewports.get(this.sessionId);
      if (viewport) {
        await methods.attach(t.id);
        await call(
          { tabId: t.id },
          "Emulation.setDeviceMetricsOverride",
          viewport,
        );
      }
      return info(t);
    },
    async closeTab(id) {
      await chrome.tabs.remove(id);
      owned.delete(id);
      marks.delete(id);
    },
    async markTab(id, status) {
      marks.set(id, status);
    },
    async claimUserTab(id) {
      const t = await chrome.tabs.get(id);
      owned.set(id, this.sessionId);
      return info(t);
    },
    async getUserHistory(options = {}) {
      const { queries, query, from: dateFrom, to: dateTo, limit } = options;
      const terms = queries ?? [query ?? ""];
      const rows = (
        await Promise.all(
          terms.map((text) =>
            chrome.history.search({
              text,
              startTime: dateFrom ? Date.parse(dateFrom) : 0,
              endTime: dateTo ? Date.parse(dateTo) : Date.now(),
              maxResults: limit ?? 100,
            }),
          ),
        )
      ).flat();
      return [...new Map(rows.map((r) => [r.url, r])).values()]
        .sort((a, b) => b.lastVisitTime - a.lastVisitTime)
        .slice(0, limit ?? 100)
        .map((r) => ({
          url: r.url,
          title: r.title,
          dateVisited: new Date(r.lastVisitTime).toISOString(),
        }));
    },
    async nameSession(name) {
      sessionName = name;
    },
    async allowDownload() {},
    async moveMouse() {},
    async getInfo() {
      return {
        name: "Browser Agent Chrome",
        type: "extension",
        family: "chrome",
      };
    },
    async executeTabRead() {
      throw Error(
        "Tab context PDF export is not connected to a desktop library; use AX/DOM/screenshot.",
      );
    },
    async executeUnhandledCommand(command) {
      switch (command.type) {
        case "browser_visibility_get":
        case "browser_get_visibility":
        case "get_browser_visibility":
          return { visible };
        case "browser_visibility_set":
        case "browser_set_visibility":
        case "set_browser_visibility": {
          visible = command.visible;
          for (const t of (await chrome.tabs.query({})).filter((t) =>
            owned.has(t.id),
          ))
            await chrome.windows.update(t.windowId, {
              state: visible ? "normal" : "minimized",
              focused: visible,
            });
          return {};
        }
        case "browser_viewport_set":
        case "browser_set_viewport":
        case "set_browser_viewport": {
          const viewport = {
            width: command.width,
            height: command.height,
            deviceScaleFactor: command.device_scale_factor ?? 1,
            mobile: command.is_mobile ?? false,
          };
          viewports.set(this.sessionId, viewport);
          for (const [tabId, owner] of owned)
            if (owner === this.sessionId) {
              await methods.attach(tabId);
              await call(
                { tabId },
                "Emulation.setDeviceMetricsOverride",
                viewport,
              );
            }
          return {};
        }
        case "browser_viewport_reset":
        case "browser_reset_viewport":
        case "reset_browser_viewport": {
          viewports.delete(this.sessionId);
          for (const [tabId, owner] of owned)
            if (owner === this.sessionId)
              await call({ tabId }, "Emulation.clearDeviceMetricsOverride");
          return {};
        }
        default:
          throw Error(`Native command not mapped: ${command.type}`);
      }
    },
  };
  return {
    async invoke(method, args, context = {}) {
      if (!Object.hasOwn(methods, method))
        throw Error(`Native API not mapped: ${method}`);
      return methods[method].apply(context, args);
    },
    methods,
  };
}
