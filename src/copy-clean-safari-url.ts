import { Clipboard, showHUD, showToast, Toast } from "@raycast/api";
import { runAppleScript } from "@raycast/utils";

export default async function Command() {
  const ctx = await getSafariContext();

  if (!ctx.isFrontmost) return;

  if (!isHttpUrl(ctx.url)) {
    await showHUD("No page to copy");
    return;
  }

  const cleaned = clean(ctx.url);
  await Clipboard.copy(cleaned);
  await showToast({ style: Toast.Style.Success, title: "Copied clean URL" });
}

async function getSafariContext(): Promise<{ isFrontmost: boolean; url: string | "" }> {
  try {
    const raw = await runAppleScript<string>(`
      tell application "System Events"
        set safariRunning to exists process "Safari"
        set isFront to false
        if safariRunning then set isFront to ((name of first application process whose frontmost is true) is "Safari")
      end tell
      set theURL to ""
      if safariRunning then
        tell application "Safari"
          if (count of documents) > 0 then set theURL to URL of front document
        end tell
      end if
      return (isFront as string) & "|" & theURL
    `);
    const [frontStr, url = ""] = String(raw || "").split("|");
    return { isFrontmost: frontStr.trim() === "true", url: (url || "").trim() };
  } catch {
    return { isFrontmost: false, url: "" };
  }
}

function isHttpUrl(u?: string | null): u is string {
  return !!u && /^https?:\/\//i.test(u);
}

function clean(input: string): string {
  try {
    const u = new URL(input);
    const host = u.host.toLowerCase();

    normalizeEmptyParams(u);
    stripAmpSuffix(u);
    cleanQueryLikeFragment(u, DROP_EXACT, DROP_PREFIXES);

    const unwrapped = unwrapRedirect(u);
    if (unwrapped) return clean(unwrapped);

    if (isGoogleHost(host) && u.pathname === "/search") {
      canonicalizeGoogleSearch(u);
      return u.toString();
    }

    if (isGoogleHost(host) && (u.pathname.startsWith("/amp/") || u.pathname.startsWith("/amp/s/"))) {
      const target = u.pathname.replace(/^\/amp\/s\//i, "https://").replace(/^\/amp\//i, "http://");
      return target ? clean(target + (u.search || "")) : u.toString();
    }

    if (isYouTubeHost(host)) {
      const yt = canonicalizeYouTubeKeepingMusic(u);
      if (yt) return yt;
    }

    if (isSpotifyHost(host)) {
      const sp = canonicalizeSpotify(u);
      if (sp) return sp;
    }

    if (isSoundCloudHost(host)) {
      const sc = canonicalizeSoundCloud(u);
      if (sc) return sc;
    }

    if (/(^|\.)amazon\.[a-z.]+$/.test(host)) {
      const m = u.pathname.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i);
      if (m) return `https://${host}/dp/${m[1].toUpperCase()}`;
    }

    for (const [k] of [...u.searchParams]) {
      const lk = k.toLowerCase();
      if (DROP_EXACT.has(lk) || DROP_PREFIXES.some((p) => lk.startsWith(p))) u.searchParams.delete(k);
    }

    return u.toString();
  } catch {
    return input;
  }
}

const DROP_EXACT = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "utm_source_platform",
  "utm_reader",
  "utm_brand",
  "utm_social",
  "utm_social-type",
  "gclid",
  "dclid",
  "msclkid",
  "fbclid",
  "ttclid",
  "twclid",
  "yclid",
  "igshid",
  "ref",
  "ref_src",
  "referrer",
  "si",
  "spm",
  "ved",
  "vero_id",
  "zanpid",
  "mkt_tok",
  "aff",
  "affid",
  "aff_source",
  "aff_platform",
  "usp",
  "in",
]);

const DROP_PREFIXES = ["utm_", "mtm_", "pk_", "mc_", "_hs", "oly_", "ga_", "epi_"];

function isGoogleHost(h: string) {
  return /(^|\.)google\.[a-z.]+$/.test(h);
}

function isYouTubeHost(h: string) {
  return /(^|\.)youtube\.com$/.test(h) || /(^|\.)music\.youtube\.com$/.test(h) || /(^|\.)youtu\.be$/.test(h);
}

function isSpotifyHost(h: string) {
  return /(^|\.)spotify\.com$/.test(h) || /(^|\.)spotify\.link$/.test(h);
}

function isSoundCloudHost(h: string) {
  return /(^|\.)soundcloud\.com$/.test(h) || /(^|\.)w\.soundcloud\.com$/.test(h) || /(^|\.)m\.soundcloud\.com$/.test(h);
}

function normalizeEmptyParams(u: URL) {
  for (const [k, v] of [...u.searchParams]) {
    if (v === "") u.searchParams.delete(k);
  }
}

function stripAmpSuffix(u: URL) {
  if (/\/amp\/?$/i.test(u.pathname)) u.pathname = u.pathname.replace(/\/amp\/?$/i, "") || "/";
}

function cleanQueryLikeFragment(u: URL, dropExact: Set<string>, dropPrefixes: string[]) {
  if (!u.hash) return;
  if (isGoogleHost(u.host.toLowerCase()) && u.pathname === "/search") {
    u.hash = "";
    return;
  }
  if (u.hash.startsWith("#?")) {
    const qs = new URLSearchParams(u.hash.slice(2));
    for (const [k] of [...qs]) {
      const lk = k.toLowerCase();
      if (dropExact.has(lk) || dropPrefixes.some((p) => lk.startsWith(p))) qs.delete(k);
    }
    u.hash = qs.toString() ? `#?${qs.toString()}` : "";
  }
}

function unwrapRedirect(u: URL): string | null {
  const host = u.host.toLowerCase();
  if (isGoogleHost(host)) {
    if (u.pathname === "/url") return u.searchParams.get("q") || u.searchParams.get("url");
    if (u.pathname === "/imgres") return u.searchParams.get("imgrefurl") || u.searchParams.get("imgurl");
    if (host === "webcache.googleusercontent.com" && u.pathname === "/search") {
      const q = u.searchParams.get("q");
      if (q && q.startsWith("cache:")) {
        const match = q.match(/^cache:([^+ ]+)/i);
        if (match) return decodeURIComponent(match[1]);
      }
    }
  }
  if (host === "w.soundcloud.com" && u.pathname.startsWith("/player")) {
    return u.searchParams.get("url");
  }
  if (host === "l.facebook.com" || host === "lm.facebook.com" || host === "l.messenger.com" || host === "l.instagram.com") {
    return u.searchParams.get("u");
  }
  if (host === "out.reddit.com") return u.searchParams.get("url");
  if (host === "medium.com" && (u.pathname === "/r/" || u.pathname === "/r")) return u.searchParams.get("url");
  if ((host === "x.com" || host === "twitter.com") && u.pathname === "/i/redirect") return u.searchParams.get("url");
  if (/(^|\.)bing\.com$/.test(host)) {
    if (u.pathname === "/ck/a") return u.searchParams.get("u");
    if (u.pathname === "/images/search") return u.searchParams.get("imgurl") || u.searchParams.get("mediaurl") || u.searchParams.get("rurl");
  }
  if (host === "r.search.yahoo.com") {
    const m = u.pathname.match(/\/RU=([^/]+)\//i);
    if (m) {
      try {
        return decodeURIComponent(m[1]);
      } catch {
        return null;
      }
    }
  }
  return null;
}

function canonicalizeGoogleSearch(u: URL) {
  const keep = new URLSearchParams();
  const q = u.searchParams.get("q");
  if (q) keep.set("q", q);

  const tbm = u.searchParams.get("tbm");
  const udm = u.searchParams.get("udm");
  const mapped = mapUdmToTbm(udm);
  if (tbm) keep.set("tbm", tbm);
  else if (mapped) keep.set("tbm", mapped);

  const tbs = u.searchParams.get("tbs");
  if (tbs) keep.set("tbs", tbs);

  u.search = keep.toString();
  u.hash = "";
}

function mapUdmToTbm(udm: string | null): string | null {
  if (!udm) return null;
  switch (udm) {
    case "2":
      return "isch";
    case "12":
      return "nws";
    case "8":
      return "vid";
    default:
      return null;
  }
}

function canonicalizeYouTubeKeepingMusic(u: URL): string | null {
  const host = u.host.toLowerCase();
  const t = u.searchParams.get("t") || null;

  if (host.includes("music.youtube.com")) {
    let id: string | null = null;
    if (u.pathname.startsWith("/watch")) id = u.searchParams.get("v");
    if (id) return `https://music.youtube.com/watch?v=${encodeURIComponent(id)}${t ? `&t=${encodeURIComponent(t)}` : ""}`;
    return null;
  }

  if (host.includes("youtu.be")) {
    const id = u.pathname.replace(/^\/+/, "").split(/[/?#]/)[0] || "";
    if (id) return `https://youtu.be/${encodeURIComponent(id)}${t ? `?t=${encodeURIComponent(t)}` : ""}`;
    return null;
  }

  if (u.pathname.startsWith("/watch")) {
    const v = u.searchParams.get("v");
    if (v) return `https://youtu.be/${encodeURIComponent(v)}${t ? `?t=${encodeURIComponent(t)}` : ""}`;
  }

  return null;
}

function canonicalizeSpotify(u: URL): string | null {
  const host = u.host.toLowerCase();
  if (host.endsWith("spotify.link")) return null;
  if (!host.endsWith("spotify.com")) return null;

  const targetHost = "open.spotify.com";
  let path = u.pathname.replace(/^\/intl-[a-z-]+(?:-[a-z-]+)?\//i, "/");
  path = path.replace(/^\/embed\//, "/");

  const parts = path.split("/").filter(Boolean);
  if (parts[0] === "user" && parts[2] === "playlist" && parts[3]) {
    return `https://${targetHost}/playlist/${parts[3]}`;
  }

  const types = new Set(["track", "album", "artist", "playlist", "episode", "show"]);
  if (parts.length >= 2 && types.has(parts[0])) {
    const type = parts[0];
    const id = parts[1];
    if (id) return `https://${targetHost}/${type}/${id}`;
  }

  return `https://${targetHost}${path}`;
}

function canonicalizeSoundCloud(u: URL): string | null {
  let host = u.host.toLowerCase();

  if (host === "m.soundcloud.com" || host === "www.soundcloud.com") host = "soundcloud.com";
  if (host !== "soundcloud.com") return null;

  const base = `https://${host}${u.pathname || "/"}`;

  const keep = new URLSearchParams();
  const secret = u.searchParams.get("secret_token");
  if (secret) keep.set("secret_token", secret);
  const s = u.searchParams.get("s");
  if (s && /^s-[A-Za-z0-9]+$/.test(s)) keep.set("s", s);
  const t = u.searchParams.get("t");
  if (t) keep.set("t", t);

  const query = keep.toString();
  return `${base}${query ? `?${query}` : ""}${u.hash || ""}`;
}
