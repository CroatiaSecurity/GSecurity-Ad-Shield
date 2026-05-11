/**
 * GSecurity Ad Shield — Main-world script.
 * Intercepts JSON.parse, fetch, XHR, and YouTube global objects
 * to strip ad payloads before they reach the page.
 */
(function () {
  if (window.__gsecMainInjected) return;
  window.__gsecMainInjected = true;

  const isYouTube =
    location.hostname.includes("youtube.com") ||
    location.hostname.includes("youtube-nocookie.com");

  const isDiscord =
    location.hostname.includes("discord.com") ||
    location.hostname.includes("discordapp.com");

  /* Discord uses class names and URLs that trigger false positives — skip entirely */
  if (isDiscord) return;

  /* ── Blocked ad/tracking domains ── */
  const blockedDomainFragments = [
    "doubleclick.net",
    "googleadservices.com",
    "googlesyndication.com",
    "adservice.google.com",
    "adnxs.com",
    "taboola.com",
    "outbrain.com",
    "criteo.com",
    "scorecardresearch.com",
    "pubmatic.com",
    "rubiconproject.com",
    "google-analytics.com",
    "googletagmanager.com",
    "googletagservices.com",
    "youtubeads.googleapis.com",
    "pubads.g.doubleclick.net",
    "ads.youtube.com",
    "analytics.youtube.com",
    "video-stats.video.google.com",
    "amazon-adsystem.com",
    "ads-twitter.com",
    "static.ads-twitter.com",
    "advertising.com",
    "adsafeprotected.com",
    "moatads.com",
    "advertising.yahoo.com",
    "adtech.de",
    "adform.net",
    "serving-sys.com",
    "facebook.com/tr",
    "connect.facebook.net",
    "pixel.facebook.com",
    "analytics.twitter.com",
    "pixel.reddit.com",
    "ads.linkedin.com",
    "analytics.tiktok.com",
    "hotjar.com",
    "fullstory.com",
    "segment.io",
    "segment.com",
    "mixpanel.com",
    "amplitude.com",
    "quantserve.com",
    "quantcast.com",
    "chartbeat.com",
    "newrelic.com",
    /* ── Additional domains from d3ward test ── */
    "mouseflow.com",
    "luckyorange.com",
    "freshmarketer.com",
    "stats.wp.com",
    "notify.bugsnag.com",
    "browser.sentry-cdn.com",
    "ads.pinterest.com",
    "events.redditmedia.com",
    "samsungads.com",
    "metrics.apple.com",
    "api.ad.xiaomi.com",
    "unityads.unity3d.com",
    "byteoversea.com",
    "yahooinc.com",
    "appmetrica.yandex.com",
    "yandexadexchange.net"
  ];

  const blockedPatterns = [
    "/api/stats/ads",
    "/api/stats/atr",
    "/pagead/",
    "/ptracking",
    "/ad?",
    "/ads?",
    "/advert",
    "/sponsored",
    "/promotion",
    "/tracking",
    "/analytics",
    "/collect?",
    "/beacon",
    "/pixel",
    "/imp?",
    "/impression",
    "/click?",
    "ad_banner",
    "ad_frame",
    "sponsored_content",
    "promo_banner",
    /* ── Additional URL path patterns ── */
    "/ad_banner",
    "/ad_frame",
    "/ads/banner"
  ];

  const blockedUrlRegex =
    /(\/ads?\/|\/ad[sx]?\b|[?&](ad|ads|adunit|adformat|adtag)=|doubleclick|googlesyndication|googleadservices|taboola|outbrain|tracking|beacon|pixel)/i;

  /* ── PAC-derived regex patterns for comprehensive blocking ── */

  // Catches any hostname containing ad-related words (from BlockAds.pac adDomainRegex)
  const adDomainRegex = /^(?:.*[-_.])?(?:ads?|adv(?:ert(?:s|ising)?)?|banners?|track(?:er|ing|s)?|beacons?|doubleclick|adservice|adnxs|adtech|googleads|gads|adwords|partner|sponsor(?:ed)?|click(?:s|bank|tale|through)?|pop(?:up|under)s?|promo(?:tion)?|market(?:ing|er)?|affiliates?|metrics?|stat(?:s|counter|istics)?|analytics?|pixels?|campaign|traff(?:ic|iq)|monetize|syndicat(?:e|ion)|revenue|yield|impress(?:ion)?s?|conver(?:sion|t)?|audience|target(?:ing)?|behavior|profil(?:e|ing)|telemetry|survey|outbrain|taboola|quantcast|scorecard|omniture|comscore|krux|bluekai|exelate|adform|adroll|rubicon|vungle|inmobi|flurry|mixpanel|heap|amplitude|optimizely|bizible|pardot|hubspot|marketo|eloqua|media(?:math|net)|criteo|appnexus|turn|adbrite|admob|adsonar|adscale|zergnet|revcontent|mgid|nativeads|contentad|displayads|bannerflow|adblade|adcolony|chartbeat|newrelic|pingdom|kissmetrics|tradedesk|bidder|auction|rtb|programmatic|interstitial|overlay|trafficjunky|trafficstars|exoclick|juicyads|realsrv|magsrv)\./i;

  // Catches numbered ad subdomains like ad1., banner2., click3. (from BlockAds.pac adSubdomainRegex)
  const adSubdomainRegex = /^(?:adcreative(?:s)?|imageserv|media(?:mgr)?|stats|switch|track(?:2|er)?|view|ads?\d{0,3}|banners?\d{0,3}|clicks?\d{0,3}|count(?:er)?\d{0,3}|servedby\d{0,3}|toolbar\d{0,3}|pageads\d{0,3}|pops\d{0,3}|promos?\d{0,3})\./i;

  // Catches tracking pixels and Flash ads (from BlockAds.pac adWebBugRegex)
  const adWebBugRegex = /(?:\/(?:1|blank|b|clear|pixel|transp|spacer)\.gif|\.swf)$/i;

  // Extended URL path patterns (from BlockAds.pac adUrlRegex)
  const adUrlPathRegex = /(?:\/(?:adcontent|img\/adv|web-ad|iframead|contentad|ad\/image|video-ad|stats\/event|xtclicks|adscript|bannerad|googlead|adhandler|adimages|adconfig|tracking\/track|tracker\/track|adrequest|nativead|adman|advertisement|adframe|adcontrol|adoverlay|adserver|adsense|google-ads|ad-banner|banner-ad|adplacement|adblockdetect|advertising|admanagement|adprovider|adrotation|adunit|adcall|adlog|adcount|adserve|adsrv|adsys|adtrack|adview|adwidget|adzone|sidebar-ads|footer-ads|top-ads|bottom-ads|ads\.php|ad\.js|ad\.css))/i;

  const shouldBlockUrl = (rawUrl) => {
    if (typeof rawUrl !== "string" || !rawUrl) return false;
    const url = rawUrl.toLowerCase();

    // Quick domain fragment check
    if (blockedDomainFragments.some((d) => url.includes(d))) return true;

    // Quick path pattern check
    if (blockedPatterns.some((p) => url.includes(p))) return true;

    // URL path regex
    if (blockedUrlRegex.test(url)) return true;
    if (adUrlPathRegex.test(url)) return true;

    // Web bug / tracking pixel check
    if (adWebBugRegex.test(url)) return true;

    // Hostname-based regex checks
    try {
      const hostname = new URL(rawUrl).hostname;
      if (adDomainRegex.test(hostname)) return true;
      if (adSubdomainRegex.test(hostname)) return true;
    } catch (_) {}

    return false;
  };

  /* ── YouTube ad-key stripping ── */
  const adKeys = [
    "adPlacements",
    "adSlots",
    "playerAds",
    "adBreakHeartbeatParams",
    "ad3Module",
    "adSafetyReason",
    "adLoggingData",
    "showAdSlots",
    "adBreakParams",
    "adBreakStatus",
    "adVideoId",
    "adLayoutLoggingData",
    "instreamAdPlayerOverlayRenderer",
    "adPlacementConfig",
    "adVideoStitcherConfig"
  ];

  const stripAdKeys = (obj, depth) => {
    if (!obj || typeof obj !== "object" || depth > 12) return obj;
    for (const key of adKeys) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        delete obj[key];
      }
    }
    for (const key of Object.keys(obj)) {
      if (obj[key] && typeof obj[key] === "object") {
        stripAdKeys(obj[key], depth + 1);
      }
    }
    return obj;
  };

  /* ── JSON.parse hook ── */
  const nativeParse = JSON.parse;
  JSON.parse = function (...args) {
    const parsed = nativeParse.apply(this, args);
    try {
      if (parsed && typeof parsed === "object") {
        stripAdKeys(parsed, 0);
      }
    } catch (_) {}
    return parsed;
  };

  /* ── fetch / XHR interception (non-YouTube — YouTube uses JSON stripping) ── */
  if (!isYouTube) {
    const nativeFetch = window.fetch;
    window.fetch = function (...args) {
      const target =
        typeof args[0] === "string" ? args[0] : args[0]?.url || "";
      if (shouldBlockUrl(target)) {
        return Promise.reject(new Error("Blocked by GSecurity Ad Shield"));
      }
      return nativeFetch.apply(this, args);
    };

    const nativeXhrOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url, ...rest) {
      if (shouldBlockUrl(typeof url === "string" ? url : "")) {
        return;
      }
      return nativeXhrOpen.call(this, method, url, ...rest);
    };
  }

  /* ── Guard YouTube global objects ── */
  const defineGuardedGlobal = (prop) => {
    let value = window[prop];
    try {
      Object.defineProperty(window, prop, {
        configurable: true,
        get() {
          return value;
        },
        set(v) {
          if (v && typeof v === "object") stripAdKeys(v, 0);
          value = v;
        }
      });
      if (value) window[prop] = value;
    } catch (_) {}
  };

  if (isYouTube) {
    defineGuardedGlobal("ytInitialPlayerResponse");
    defineGuardedGlobal("ytInitialData");
    defineGuardedGlobal("ytcfg");
  }
})();
