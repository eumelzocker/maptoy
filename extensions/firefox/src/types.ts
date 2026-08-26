export interface RuleConfig {
  id: string;
  /** Defaults to true when omitted. */
  enabled?: boolean;
  /** Regex source with named groups, e.g. "(?<mapname>[^/]+)". */
  match: string;
  /** Template string with `${groupName}` placeholders. */
  target: string;
  /** Per named group: raw matched value -> mapped value. Groups without an entry here are passed through as-is. */
  lookups?: Record<string, Record<string, string>>;
  /** Overrides the global response size limit. Null disables the limit for this rule. */
  maxResponseBytes?: number | null;
  /** Source response codes to forward. Defaults to every 2xx status. */
  responseStatusCodes?: number[];
}

export interface ExtensionConfig {
  /** Defaults to true when omitted. */
  enabled?: boolean;
  /** Logs each POST attempt/result/skip to the console. Defaults to false when omitted. */
  logging?: boolean;
  /** Maximum buffered source response size. Null disables the limit. Defaults to 10 MiB. */
  maxResponseBytes?: number | null;
  rules: RuleConfig[];
}
