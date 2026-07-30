/**
 * GSecurity Ad Shield — YouTube content script (safe mode).
 * Hide/remove only known ad renderers. Do not thrash the feed or sidebar.
 */
(function () {
  if (window.__gsecYtInjected) return;
  window.__gsecYtInjected = true;

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

  /* CSS only — no layout-shell targeting */
  const injectCollapseCss = () => {
    if (document.getElementById("gsec-yt-css")) return;
    const style = document.createElement("style");
    style.id = "gsec-yt-css";
    style.textContent = `
      ytd-display-ad-renderer,
      ytd-ad-slot-renderer,
      ytd-promoted-video-renderer,
      ytd-promoted-sparkles-web-renderer,
      ytd-promoted-sparkles-text-search-renderer,
      ytd-banner-promo-renderer,
      ytd-statement-banner-renderer,
      ytd-in-feed-ad-layout-renderer,
      ytd-masthead-ad-renderer,
      ytd-primetime-promo-renderer,
      ytd-compact-promoted-video-renderer,
      ytd-action-companion-ad-renderer,
      ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-ads"],
      ytd-search-pyv-renderer,
      ytd-movie-offer-module-renderer,
      ytd-mealbar-promo-renderer,
      ytd-enforcement-message-view-model,
      #masthead-ad,
      #player-ads,
      .video-ads,
      .ytp-ad-module,
      .ytp-ad-overlay-container,
      .ytp-ad-player-overlay,
      .ytp-ad-action-interstitial,
      .ytp-ad-image-overlay,
      .ytp-ad-text-overlay,
      .ytp-ad-skip-ad-slot {
        display: none !important;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  };

  const AD_SELECTORS = [
    "#player-ads",
    "#masthead-ad",
    "ytd-display-ad-renderer",
    "ytd-ad-slot-renderer",
    "ytd-promoted-video-renderer",
    "ytd-promoted-sparkles-web-renderer",
    "ytd-promoted-sparkles-text-search-renderer",
    "ytd-banner-promo-renderer",
    "ytd-in-feed-ad-layout-renderer",
    "ytd-masthead-ad-renderer",
    "ytd-compact-promoted-video-renderer",
    "ytd-search-pyv-renderer",
    "ytd-mealbar-promo-renderer",
    "ytd-enforcement-message-view-model"
  ];

  const SKIP_SELECTORS = [
    ".ytp-ad-skip-button",
    ".ytp-skip-ad-button",
    ".ytp-ad-skip-button-modern",
    "button.ytp-ad-skip-button-modern",
    "button.ytp-ad-skip-button",
    ".ytp-ad-overlay-close-button"
  ];

  const scrub = () => {
    try {
      for (const sel of AD_SELECTORS) {
        document.querySelectorAll(sel).forEach((el) => {
          try { el.remove(); } catch (_) {}
        });
      }
      for (const sel of SKIP_SELECTORS) {
        document.querySelectorAll(sel).forEach((btn) => {
          try { if (btn.click) btn.click(); } catch (_) {}
        });
      }
      // Only touch video when player is clearly in ad mode
      const player = document.querySelector(".html5-video-player.ad-showing");
      if (player) {
        const video = player.querySelector("video");
        if (video && Number.isFinite(video.duration) && video.duration > 0 && video.duration <= 90) {
          try {
            video.currentTime = Math.max(0, video.duration - 0.05);
            video.muted = true;
            video.playbackRate = 16;
            video.play().catch(() => {});
          } catch (_) {}
        }
      }
    } catch (_) {}
  };

  injectMainWorld();
  injectCollapseCss();
  scrub();
  // Slow, periodic only — no MutationObserver (was freezing scroll/sidebar).
  setInterval(scrub, 2000);
})();
