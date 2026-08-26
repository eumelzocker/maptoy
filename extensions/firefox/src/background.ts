import { PostHistory } from "./dedupe.js";
import { acceptsResponseStatus, ResponseBodyCollector } from "./response.js";
import { resolveConfiguredRequest, type ConfiguredRequest } from "./request.js";
import { DEFAULT_CONFIG, loadConfig } from "./storage.js";
import type { ExtensionConfig, RuleConfig } from "./types.js";

const LOG_PREFIX = "[maptoy-ff-ext]";

interface PendingRequest {
  targetUrl: string;
  rule: RuleConfig;
  collector: ResponseBodyCollector;
  contentType: string;
  postHistory: PostHistory;
  statusCode?: number;
}

const pendingRequests = new Map<string, PendingRequest>();

let currentConfig: ExtensionConfig = { ...DEFAULT_CONFIG };

async function reloadConfig(): Promise<ExtensionConfig> {
  try {
    currentConfig = await loadConfig();
  } catch (error) {
    console.error(LOG_PREFIX, "loading configuration failed", error);
  }
  return currentConfig;
}

function log(...args: unknown[]): void {
  if (currentConfig.logging) console.log(LOG_PREFIX, ...args);
}

// The blocking request listener awaits both promises. This keeps the request that
// wakes a fresh MV3 background context pending until its rules and session history
// are available, while still registering the listener synchronously below.
let configReady = reloadConfig();
const postHistoryReady = PostHistory.load(browser.storage.session).catch(
  (error) => {
    console.error(LOG_PREFIX, "loading session POST history failed", error);
    return new PostHistory([], browser.storage.session);
  },
);

browser.storage.onChanged.addListener((_changes, area) => {
  if (area === "local") configReady = reloadConfig();
});

// No default_popup is set in manifest.json, so clicking the toolbar button fires this.
browser.action.onClicked.addListener(() => {
  void browser.runtime.openOptionsPage();
});

browser.webRequest.onHeadersReceived.addListener(
  (details) => {
    const pending = pendingRequests.get(details.requestId);
    if (pending === undefined) return {};

    const header = details.responseHeaders?.find(
      (candidate) => candidate.name.toLowerCase() === "content-type",
    );
    pending.contentType = header?.value ?? "application/octet-stream";
    pending.statusCode = details.statusCode;
    return {};
  },
  { urls: ["<all_urls>"] },
  ["blocking", "responseHeaders"],
);

browser.webRequest.onBeforeRequest.addListener(
  async (details) => {
    let configuredRequest: ConfiguredRequest | undefined;
    let postHistory: PostHistory;
    try {
      [configuredRequest, postHistory] = await Promise.all([
        resolveConfiguredRequest(configReady, details.url),
        postHistoryReady,
      ]);
    } catch (error) {
      console.error(
        LOG_PREFIX,
        "rule evaluation failed for",
        details.url,
        error,
      );
      return {};
    }
    if (configuredRequest === undefined) return {};

    const { maximumBytes, rule, targetUrl } = configuredRequest;

    if (!postHistory.tryStart(targetUrl)) {
      log("skip (already posted or in flight)", targetUrl);
      return {};
    }

    let filter: browser.webRequest.StreamFilter;
    try {
      filter = browser.webRequest.filterResponseData(details.requestId);
    } catch (error) {
      postHistory.release(targetUrl);
      console.error(
        LOG_PREFIX,
        "creating stream filter failed for",
        details.url,
        error,
      );
      return {};
    }

    const pending: PendingRequest = {
      targetUrl,
      rule,
      collector: new ResponseBodyCollector(maximumBytes),
      contentType: "application/octet-stream",
      postHistory,
    };
    pendingRequests.set(details.requestId, pending);

    filter.ondata = (event) => {
      pending.collector.add(event.data);
      filter.write(event.data);
    };

    filter.onstop = () => {
      filter.close();
      pendingRequests.delete(details.requestId);
      void finishRequest(pending, details.url);
    };

    filter.onerror = () => {
      pendingRequests.delete(details.requestId);
      pending.postHistory.release(targetUrl);
      console.error(
        LOG_PREFIX,
        "stream filter error for",
        details.url,
        filter.error,
      );
    };

    return {};
  },
  { urls: ["<all_urls>"] },
  ["blocking"],
);

browser.webRequest.onErrorOccurred.addListener(
  (details) => {
    const pending = pendingRequests.get(details.requestId);
    if (pending === undefined) return;
    pendingRequests.delete(details.requestId);
    pending.postHistory.release(pending.targetUrl);
  },
  { urls: ["<all_urls>"] },
);

async function finishRequest(
  pending: PendingRequest,
  sourceUrl: string,
): Promise<void> {
  if (pending.collector.tooLarge) {
    pending.postHistory.release(pending.targetUrl);
    console.error(
      LOG_PREFIX,
      "source response exceeds maxResponseBytes",
      pending.collector.receivedBytes,
      sourceUrl,
    );
    return;
  }

  try {
    if (!acceptsResponseStatus(pending.statusCode, pending.rule)) {
      pending.postHistory.release(pending.targetUrl);
      log("skip source response status", pending.statusCode, sourceUrl);
      return;
    }
  } catch (error) {
    pending.postHistory.release(pending.targetUrl);
    console.error(LOG_PREFIX, "invalid response status configuration", error);
    return;
  }

  const body = pending.collector.body();
  if (body === undefined) {
    pending.postHistory.release(pending.targetUrl);
    return;
  }
  await forward(
    pending.postHistory,
    pending.targetUrl,
    body,
    pending.contentType,
  );
}

async function forward(
  postHistory: PostHistory,
  targetUrl: string,
  body: ArrayBuffer,
  contentType: string,
): Promise<void> {
  log("POST", targetUrl);
  try {
    const response = await fetch(targetUrl, {
      method: "POST",
      headers: { "Content-Type": contentType },
      body,
    });
    if (!response.ok) {
      postHistory.release(targetUrl);
      console.error(LOG_PREFIX, "POST rejected", targetUrl, response.status);
      return;
    }
    try {
      await postHistory.complete(targetUrl);
    } catch (error) {
      console.error(
        LOG_PREFIX,
        "persisting session POST history failed",
        error,
      );
    }
    log("POST ok", targetUrl, response.status);
  } catch (error) {
    postHistory.release(targetUrl);
    console.error(LOG_PREFIX, "POST to", targetUrl, "failed", error);
  }
}
