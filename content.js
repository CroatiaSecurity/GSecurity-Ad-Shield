<<<<<<< HEAD
/**
 * GSecurity Ad Shield — YouTube content script.
 * Runs on youtube.com AND youtube-nocookie.com (embedded players on Discord, etc.)
 * with all_frames: true so it fires inside iframes too.
 */
(function () {
  if (window.__gsecYtInjected) return;
  window.__gsecYtInjected = true;

  /* ── Inject main-world script for JSON.parse / ytInitialData hooks ── */
  const injectMainWorld = () => {
    try {
      const src = chrome.runtime.getURL("main-world.js");
      const s = document.createElement("script");
      s.src = src;
      s.async = false;
      (document.head || document.documentElement).appendChild(s);
      s.remove();
    } catch (_) {
      // Extension context may be invalid in some embed scenarios.
    }
  };

  /* ── CSS: collapse known ad renderers ── */
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
      #masthead-ad,
      #player-ads,
      .video-ads,
      .ytp-ad-module,
      .ytp-ad-overlay-container,
      .ytp-ad-player-overlay,
      .ytp-ad-action-interstitial,
      .ytp-ad-image-overlay,
      .ytp-ad-text-overlay,
      .ytp-ad-skip-ad-slot,
      .ad-showing .ytp-ad-module,
      tp-yt-paper-dialog:has(#dismiss-button),
      ytd-popup-container:has(a[href*="/premium"]),
      ytd-mealbar-promo-renderer,
      ytd-enforcement-message-view-model {
        display: none !important;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  };

  /* ── DOM scrubbing ── */
  const AD_SELECTORS = [
    ".video-ads",
    ".ytp-ad-module",
    ".ytp-ad-overlay-container",
    ".ytp-ad-player-overlay",
    ".ytp-ad-action-interstitial",
    ".ytp-ad-image-overlay",
    ".ytp-ad-text-overlay",
    "#player-ads",
    "#masthead-ad",
    "ytd-display-ad-renderer",
    "ytd-ad-slot-renderer",
    "ytd-promoted-video-renderer",
    "ytd-promoted-sparkles-web-renderer",
    "ytd-promoted-sparkles-text-search-renderer",
    "ytd-banner-promo-renderer",
    "ytd-statement-banner-renderer",
    "ytd-in-feed-ad-layout-renderer",
    "ytd-masthead-ad-renderer",
    "ytd-primetime-promo-renderer",
    "ytd-compact-promoted-video-renderer",
    "ytd-action-companion-ad-renderer",
    "ytd-mealbar-promo-renderer",
    "ytd-enforcement-message-view-model",
    'ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-ads"]',
    // Feed items wrapping ads
    "ytd-rich-item-renderer:has(ytd-ad-slot-renderer)",
    "ytd-rich-item-renderer:has(ytd-display-ad-renderer)",
    "ytd-rich-item-renderer:has(ytd-promoted-video-renderer)",
    "ytd-rich-item-renderer:has(ytd-promoted-sparkles-web-renderer)",
    "ytd-rich-section-renderer:has(ytd-ad-slot-renderer)",
    // Search result ads
    "ytd-search-pyv-renderer",
    "ytd-movie-offer-module-renderer"
  ];

  const SKIP_BTN_SELECTORS = [
    ".ytp-ad-skip-button",
    ".ytp-skip-ad-button",
    ".ytp-ad-skip-button-modern",
    ".ytp-skip-ad-button__text",
    'button[class*="skip"]',
    ".ytp-ad-overlay-close-button"
  ];

  const scrubYouTubeAds = () => {
    // 1. Remove ad DOM elements
    for (const sel of AD_SELECTORS) {
      document.querySelectorAll(sel).forEach((el) => el.remove());
    }

    // 2. Click any skip buttons
    for (const sel of SKIP_BTN_SELECTORS) {
      document.querySelectorAll(sel).forEach((btn) => {
        if (btn.click) btn.click();
      });
    }

    // 3. Fast-forward video ads that are currently playing
    const player = document.querySelector(".html5-video-player");
    const video = document.querySelector("video");
    if (player && player.classList.contains("ad-showing") && video) {
      if (Number.isFinite(video.duration) && video.duration > 0) {
        video.currentTime = Math.max(0, video.duration - 0.1);
      }
      video.muted = true;
      video.playbackRate = 16;
      video.play().catch(() => {});
      player.classList.remove("ad-showing");
    }

    // 4. Remove residual empty feed shells (ad placeholders)
    document.querySelectorAll("ytd-rich-item-renderer").forEach((el) => {
      const hasAdMarker = !!el.querySelector(
        "ytd-ad-slot-renderer, ytd-display-ad-renderer, ytd-promoted-video-renderer, ytd-promoted-sparkles-web-renderer"
      );
      if (hasAdMarker) {
        el.remove();
        return;
      }
      const hasTitle = !!el.querySelector(
        "a#video-title-link, a#video-title[href], #video-title.ytd-rich-grid-media"
      );
      const hasThumbImage = !!el.querySelector(
        "ytd-thumbnail img[src], ytd-thumbnail yt-image img[src], img.yt-core-image[src]"
      );
      if (!hasTitle && !hasThumbImage) {
        const compactText = (el.textContent || "").replace(/\s+/g, "");
        if (compactText.length === 0) el.remove();
      }
      // Remove thumbnail shells with no real content
      const hasThumbnailShell = !!el.querySelector("ytd-thumbnail, a#thumbnail");
      if (hasThumbnailShell && !hasThumbImage) {
        const hasDuration = !!el.querySelector(
          "#text.ytd-thumbnail-overlay-time-status-renderer"
        );
        const hasMenu = !!el.querySelector("ytd-menu-renderer");
        if (!hasDuration && !hasTitle && !hasMenu) el.remove();
      }
    });

    // 5. Dismiss "ad blockers are not allowed" popups
    document.querySelectorAll("tp-yt-paper-dialog").forEach((dialog) => {
      const text = (dialog.textContent || "").toLowerCase();
      if (text.includes("ad blocker") || text.includes("allow ads")) {
        const dismiss = dialog.querySelector("#dismiss-button, .dismiss-button, button");
        if (dismiss && dismiss.click) dismiss.click();
        dialog.remove();
      }
    });
  };

  /* ── Bootstrap ── */
  injectMainWorld();
  injectCollapseCss();
  scrubYouTubeAds();

  setInterval(scrubYouTubeAds, 250);

  const observer = new MutationObserver(scrubYouTubeAds);
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
=======
/**
 * GSecurity Ad Shield — YouTube content script.
 * Runs on youtube.com AND youtube-nocookie.com (embedded players on Discord, etc.)
 * with all_frames: true so it fires inside iframes too.
 */
(function () {
  if (window.__gsecYtInjected) return;
  window.__gsecYtInjected = true;

  /* ── Inject main-world script for JSON.parse / ytInitialData hooks ── */
  const injectMainWorld = () => {
    try {
      const src = chrome.runtime.getURL("main-world.js");
      const s = document.createElement("script");
      s.src = src;
      s.async = false;
      (document.head || document.documentElement).appendChild(s);
      s.remove();
    } catch (_) {
      // Extension context may be invalid in some embed scenarios.
    }
  };

  /* ── CSS: collapse known ad renderers ── */
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
      #masthead-ad,
      #player-ads,
      .video-ads,
      .ytp-ad-module,
      .ytp-ad-overlay-container,
      .ytp-ad-player-overlay,
      .ytp-ad-action-interstitial,
      .ytp-ad-image-overlay,
      .ytp-ad-text-overlay,
      .ytp-ad-skip-ad-slot,
      .ad-showing .ytp-ad-module,
      tp-yt-paper-dialog:has(#dismiss-button),
      ytd-popup-container:has(a[href*="/premium"]),
      ytd-mealbar-promo-renderer,
      ytd-enforcement-message-view-model {
        display: none !important;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  };

  /* ── DOM scrubbing ── */
  const AD_SELECTORS = [
    ".video-ads",
    ".ytp-ad-module",
    ".ytp-ad-overlay-container",
    ".ytp-ad-player-overlay",
    ".ytp-ad-action-interstitial",
    ".ytp-ad-image-overlay",
    ".ytp-ad-text-overlay",
    "#player-ads",
    "#masthead-ad",
    "ytd-display-ad-renderer",
    "ytd-ad-slot-renderer",
    "ytd-promoted-video-renderer",
    "ytd-promoted-sparkles-web-renderer",
    "ytd-promoted-sparkles-text-search-renderer",
    "ytd-banner-promo-renderer",
    "ytd-statement-banner-renderer",
    "ytd-in-feed-ad-layout-renderer",
    "ytd-masthead-ad-renderer",
    "ytd-primetime-promo-renderer",
    "ytd-compact-promoted-video-renderer",
    "ytd-action-companion-ad-renderer",
    "ytd-mealbar-promo-renderer",
    "ytd-enforcement-message-view-model",
    'ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-ads"]',
    // Feed items wrapping ads
    "ytd-rich-item-renderer:has(ytd-ad-slot-renderer)",
    "ytd-rich-item-renderer:has(ytd-display-ad-renderer)",
    "ytd-rich-item-renderer:has(ytd-promoted-video-renderer)",
    "ytd-rich-item-renderer:has(ytd-promoted-sparkles-web-renderer)",
    "ytd-rich-section-renderer:has(ytd-ad-slot-renderer)",
    // Search result ads
    "ytd-search-pyv-renderer",
    "ytd-movie-offer-module-renderer"
  ];

  const SKIP_BTN_SELECTORS = [
    ".ytp-ad-skip-button",
    ".ytp-skip-ad-button",
    ".ytp-ad-skip-button-modern",
    ".ytp-skip-ad-button__text",
    'button[class*="skip"]',
    ".ytp-ad-overlay-close-button"
  ];

  const scrubYouTubeAds = () => {
    // 1. Remove ad DOM elements
    for (const sel of AD_SELECTORS) {
      document.querySelectorAll(sel).forEach((el) => el.remove());
    }

    // 2. Click any skip buttons
    for (const sel of SKIP_BTN_SELECTORS) {
      document.querySelectorAll(sel).forEach((btn) => {
        if (btn.click) btn.click();
      });
    }

    // 3. Fast-forward video ads that are currently playing
    const player = document.querySelector(".html5-video-player");
    const video = document.querySelector("video");
    if (player && player.classList.contains("ad-showing") && video) {
      if (Number.isFinite(video.duration) && video.duration > 0) {
        video.currentTime = Math.max(0, video.duration - 0.1);
      }
      video.muted = true;
      video.playbackRate = 16;
      video.play().catch(() => {});
      player.classList.remove("ad-showing");
    }

    // 4. Remove residual empty feed shells (ad placeholders)
    document.querySelectorAll("ytd-rich-item-renderer").forEach((el) => {
      const hasAdMarker = !!el.querySelector(
        "ytd-ad-slot-renderer, ytd-display-ad-renderer, ytd-promoted-video-renderer, ytd-promoted-sparkles-web-renderer"
      );
      if (hasAdMarker) {
        el.remove();
        return;
      }
      const hasTitle = !!el.querySelector(
        "a#video-title-link, a#video-title[href], #video-title.ytd-rich-grid-media"
      );
      const hasThumbImage = !!el.querySelector(
        "ytd-thumbnail img[src], ytd-thumbnail yt-image img[src], img.yt-core-image[src]"
      );
      if (!hasTitle && !hasThumbImage) {
        const compactText = (el.textContent || "").replace(/\s+/g, "");
        if (compactText.length === 0) el.remove();
      }
      // Remove thumbnail shells with no real content
      const hasThumbnailShell = !!el.querySelector("ytd-thumbnail, a#thumbnail");
      if (hasThumbnailShell && !hasThumbImage) {
        const hasDuration = !!el.querySelector(
          "#text.ytd-thumbnail-overlay-time-status-renderer"
        );
        const hasMenu = !!el.querySelector("ytd-menu-renderer");
        if (!hasDuration && !hasTitle && !hasMenu) el.remove();
      }
    });

    // 5. Dismiss "ad blockers are not allowed" popups
    document.querySelectorAll("tp-yt-paper-dialog").forEach((dialog) => {
      const text = (dialog.textContent || "").toLowerCase();
      if (text.includes("ad blocker") || text.includes("allow ads")) {
        const dismiss = dialog.querySelector("#dismiss-button, .dismiss-button, button");
        if (dismiss && dismiss.click) dismiss.click();
        dialog.remove();
      }
    });
  };

  /* ── Bootstrap ── */
  injectMainWorld();
  injectCollapseCss();
  scrubYouTubeAds();

  setInterval(scrubYouTubeAds, 250);

  const observer = new MutationObserver(scrubYouTubeAds);
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
>>>>>>> b06f6c1e04c411cefe1541a263842cb1ee55fa58
