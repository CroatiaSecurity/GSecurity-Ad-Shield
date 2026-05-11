/**
 * GSecurity Ad Shield — Generic ad removal for all other sites.
 * Runs at document_idle on sites not covered by the YouTube or site-specific scripts.
 */
(function () {
  if (window.__gsecGenericInjected) return;
  window.__gsecGenericInjected = true;

  const whitelist = [
    "apple.com",
    "citibank.com",
    "ebay.com",
    "yahoo.com",
    "aliexpress.com",
    "wolt.com",
    "woltapp.com",
    "discord.com",
    "discordapp.com"
  ];

  const isWhitelistedHost = (h) => {
    const host = String(h || "").toLowerCase();
    return whitelist.some((d) => host === d || host.endsWith(`.${d}`));
  };

  if (isWhitelistedHost(location.hostname)) return;

  /* ── Inject main-world.js for fetch/XHR interception ── */
  const injectMainWorld = () => {
    try {
      const src = chrome.runtime.getURL("main-world.js");
      const s = document.createElement("script");
      s.src = src;
      s.async = false;
      (document.head || document.documentElement).appendChild(s);
      s.remove();
    } catch (_) {}
  };

  const GENERIC_AD_SELECTORS = [
    /* ── Core Google / programmatic ad selectors ── */
    "ins.adsbygoogle",
    'iframe[src*="doubleclick"]',
    'iframe[src*="googlesyndication"]',
    'iframe[src*="googletagmanager"]',
    'iframe[id*="google_ads"]',
    'iframe[id*="aswift"]',
    '[id*="google_ads"]',
    '[class*="ad-slot"]',
    '[class*="advert"]',
    '[class*="ad-banner"]',
    '[class*="ad-container"]',
    '[class*="ad-wrapper"]',
    '[class*="sponsor"]',
    '[data-ad]',
    '[data-adunit]',
    '[data-ad-slot]',
    ".sponsored-content",
    ".promoted",
    ".ad-banner",
    ".ad-container",
    ".ad-wrapper",
    ".native-ad",
    ".ad-unit",
    'div[id*="taboola"]',
    'div[id*="outbrain"]',
    'div[class*="taboola"]',
    'div[class*="outbrain"]',
    ".video-ad-overlay",
    ".preroll-ad",
    ".midroll-ad",

    /* ── Additional class-based ad selectors ── */
    '[class*="ad-placement"]',
    '[class*="ad_"]',
    '[data-google-query-id]',
    ".ad-zone",
    ".ad-area",
    ".ad-block",
    ".ad-box",
    ".ad-frame",
    ".ad-leaderboard",
    ".ad-sidebar",
    ".ad-skyscraper",
    ".ad-rectangle",
    ".ad-interstitial",
    ".ad-overlay",
    ".ad-popup",
    ".ad-modal",

    /* ── iframe / embed ad selectors ── */
    'iframe[src*="ad"][width]',
    "iframe[data-ad]",

    /* ── Third-party ad network widgets ── */
    'div[id*="zergnet"]',
    'div[id*="revcontent"]',
    'div[id*="mgid"]',
    'div[class*="mgid"]',
    'a[href*="doubleclick.net"]',
    'a[href*="googleadservices"]',

    /* ── ARIA-labelled ads ── */
    'div[aria-label="Advertisement"]',
    'div[aria-label="advertisement"]',

    /* ── DuckDuckGo ad selectors ── */
    ".result--ad",
    ".is-ad",
    '[data-testid="ad"]',
    ".badge--ad",
    ".header-aside",

    /* ── Google search ad selectors ── */
    "#tads",
    "#tadsb",
    "#bottomads",
    ".commercial-unit-desktop-top",
    "div[data-text-ad]",

    /* ── Bing search ad selectors ── */
    ".b_ad",
    ".b_adSlug",
    "li.b_ad"
  ];

  /* ── CSS injection — hide ad elements before DOM scrubber runs ── */
  const injectAdHidingCSS = () => {
    try {
      const style = document.createElement("style");
      style.id = "gsec-ad-hide";
      style.textContent = GENERIC_AD_SELECTORS.map(
        (s) => `${s} { display: none !important; visibility: hidden !important; height: 0 !important; overflow: hidden !important; }`
      ).join("\n");
      (document.head || document.documentElement).appendChild(style);
    } catch (_) {}
  };

  const scrubGenericAds = () => {
    for (const sel of GENERIC_AD_SELECTORS) {
      document.querySelectorAll(sel).forEach((el) => {
        if (el && el.parentElement) el.remove();
      });
    }
  };

  injectAdHidingCSS();
  injectMainWorld();
  scrubGenericAds();

  setInterval(scrubGenericAds, 1500);

  const observer = new MutationObserver(scrubGenericAds);
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
