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
    /* ── Cosmetic filter: common ad-box class names ── */
    ".adsbox",
    ".adbox",
    ".ad-box",
    ".adbox-wrapper",
    ".banner_ads",
    ".textads",
    ".adSocial",
    ".ADBox",
    ".AdBox",

    /* ── Core Google / programmatic ad selectors ── */
    "ins.adsbygoogle",
    'iframe[src*="doubleclick"]',
    'iframe[src*="googlesyndication"]',
    'iframe[src*="googletagmanager"]',
    'iframe[id^="google_ads"]',
    'iframe[id^="aswift"]',
    '[id^="google_ads"]',
    '[class^="ad-slot"]',
    '[class^="ad-banner"]',
    '[class^="ad-container"]',
    '[class^="ad-wrapper"]',
    '[data-adunit]',
    '[data-ad-slot]',
    '[data-google-query-id]',
    ".sponsored-content",
    ".promoted",
    ".ad-banner",
    ".ad-container",
    ".ad-wrapper",
    ".native-ad",
    ".ad-unit",
    'div[id^="taboola"]',
    'div[id^="outbrain"]',
    'div[class^="taboola"]',
    'div[class^="outbrain"]',
    ".video-ad-overlay",
    ".preroll-ad",
    ".midroll-ad",

    /* ── Additional class-based ad selectors ── */
    '[class^="ad-placement"]',
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
    'iframe[src*="doubleclick"][width]',
    'iframe[src*="googlesyndication"][width]',

    /* ── Third-party ad network widgets ── */
    'div[id^="zergnet"]',
    'div[id^="revcontent"]',
    'div[id^="mgid"]',
    'div[class^="mgid"]',
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
        (s) => `${s}:not([data-gsec-bait]) { display: none !important; visibility: hidden !important; height: 0 !important; overflow: hidden !important; }`
      ).join("\n");
      (document.head || document.documentElement).appendChild(style);
    } catch (_) {}
  };

  const scrubGenericAds = () => {
    for (const sel of GENERIC_AD_SELECTORS) {
      document.querySelectorAll(sel).forEach((el) => {
        if (!el || !el.parentElement) return;
        /* Skip our own bait element used for anti-adblock countermeasures */
        if (el.getAttribute("data-gsec-bait")) return;
        /* Hide instead of remove to avoid breaking page scripts that reference these elements */
        if (!el.getAttribute("data-gsec-hidden")) {
          el.setAttribute("data-gsec-hidden", "1");
          el.style.cssText = "display:none!important;height:0!important;max-height:0!important;overflow:hidden!important;visibility:hidden!important;padding:0!important;margin:0!important;border:0!important;";
        }
      });
    }
  };

  injectAdHidingCSS();
  injectMainWorld();

  /* ── Anti-adblock countermeasures ── */
  const defeatAntiAdblock = () => {
    // Create a fake ad element that anti-adblock scripts look for
    // If it's hidden/removed, they know an adblocker is active
    const bait = document.createElement("div");
    bait.className = "adsbox ad-placement pub_300x250";
    bait.setAttribute("data-ad", "true");
    bait.setAttribute("data-gsec-bait", "1");
    bait.style.cssText = "position:absolute!important;left:-9999px!important;top:-9999px!important;width:1px!important;height:1px!important;opacity:0.01!important;pointer-events:none!important;";
    bait.innerHTML = "&nbsp;";
    (document.body || document.documentElement).appendChild(bait);

    // Prevent anti-adblock overlays from blocking page content
    const antiAdblockSelectors = [
      '[class*="adblock-notice"]',
      '[class*="adblock-overlay"]',
      '[class*="adblock-modal"]',
      '[class*="adblock-warning"]',
      '[class*="adb-overlay"]',
      '[id*="adblock-notice"]',
      '[id*="adblock-overlay"]',
      '[id*="adblock_modal"]',
      ".fc-ab-root",
      ".tp-modal",
      ".tp-backdrop",
      "#tp-container"
    ];
    for (const sel of antiAdblockSelectors) {
      document.querySelectorAll(sel).forEach((el) => el.remove());
    }

    // Restore body scroll if anti-adblock locked it
    if (document.body) {
      const bodyStyle = getComputedStyle(document.body);
      if (bodyStyle.overflow === "hidden" || bodyStyle.position === "fixed") {
        // Only restore if there's an anti-adblock overlay present
        const hasOverlay = document.querySelector('[class*="adblock"], [class*="adb-"], .fc-ab-root, .tp-modal');
        if (hasOverlay) {
          document.body.style.overflow = "";
          document.body.style.position = "";
        }
      }
    }
  };

  scrubGenericAds();

  if (document.body) {
    defeatAntiAdblock();
  } else {
    document.addEventListener("DOMContentLoaded", defeatAntiAdblock);
  }

  setInterval(scrubGenericAds, 1500);

  const observer = new MutationObserver(scrubGenericAds);
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
