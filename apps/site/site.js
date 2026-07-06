(() => {
  const UXRAY_VERSION = "0.3.1";
  const UPDATE_ENDPOINT = "https://useuxray.com/v1/update";

  const escapeHtml = (value = "") => String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const highlight = (line) => {
    const tokenPattern = /(#.*$|--[a-zA-Z0-9-]+|'.*?'|".*?"|\b(?:npm|npx|codex|claude|curl|git|cd|export|wrangler|uxray|review_ui_url|review_ui_diff|health_check|demo:pipeline|demo:report|typecheck|build|mcp|upgrade|check:update)\b)/g;
    let output = "";
    let cursor = 0;
    for (const match of line.matchAll(tokenPattern)) {
      const token = match[0];
      const index = match.index || 0;
      output += escapeHtml(line.slice(cursor, index));
      const klass = token.startsWith("#")
        ? "tok-comment"
        : token.startsWith("--")
          ? "tok-flag"
          : token.startsWith("'") || token.startsWith('"')
            ? "tok-string"
            : /^(review_ui_url|review_ui_diff|health_check|demo:pipeline|demo:report|typecheck|build|mcp|upgrade|check:update)$/.test(token)
              ? "tok-fn"
              : "tok-command";
      output += `<span class="${klass}">${escapeHtml(token)}</span>`;
      cursor = index + token.length;
    }
    output += escapeHtml(line.slice(cursor));
    return output;
  };

  const icon = (name) => {
    const icons = {
      share: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" x2="15.42" y1="13.51" y2="17.49"></line><line x1="15.41" x2="8.59" y1="6.51" y2="10.49"></line></svg>',
      bookmark: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 3a2 2 0 0 1 2 2v15a1 1 0 0 1-1.496.868l-4.512-2.578a2 2 0 0 0-1.984 0l-4.512 2.578A1 1 0 0 1 5 20V5a2 2 0 0 1 2-2z"></path></svg>'
    };
    return icons[name] || "";
  };

  const copyText = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand("copy");
      textarea.remove();
      return ok;
    }
  };

  const pageUrl = () => window.location.href.split("#")[0];
  const pageTitle = () => document.title.replace(/\s+—\s+.*$/, "") || "UXRay";

  document.querySelectorAll('pre code').forEach((code) => {
    if (code.dataset.highlighted === 'true') return;
    const lines = code.textContent.replace(/\s+$/g, '').split('\n');
    code.innerHTML = lines.map((line) => `<span class="code-line">${highlight(line)}</span>`).join('');
    code.dataset.highlighted = 'true';
  });

  const hydrateIconifyFallbacks = () => {
    document.querySelectorAll('iconify-icon[icon]').forEach(async (iconEl) => {
      if (iconEl.dataset.fallbackHydrated === 'true') return;
      const name = iconEl.getAttribute('icon') || '';
      if (!/^[a-z0-9-]+:[a-z0-9-]+$/i.test(name)) return;
      await new Promise((resolve) => window.setTimeout(resolve, 900));
      if (iconEl.shadowRoot?.querySelector('svg') || iconEl.querySelector('svg')) return;
      const [prefix, slug] = name.split(':');
      try {
        const response = await fetch(`https://api.iconify.design/${prefix}/${slug}.svg?width=24&height=24`, { cache: 'force-cache' });
        if (!response.ok) return;
        iconEl.innerHTML = await response.text();
        iconEl.dataset.fallbackHydrated = 'true';
      } catch {
        // Iconify CDN can be blocked by privacy filters; text labels remain usable.
      }
    });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hydrateIconifyFallbacks);
  else hydrateIconifyFallbacks();

  const imageModal = document.createElement('div');
  imageModal.className = 'image-lightbox';
  imageModal.setAttribute('aria-hidden', 'true');
  imageModal.innerHTML = '<button class="lightbox-close" aria-label="Close image preview">×</button><img alt="Zoomed UXRay evidence" />';
  document.body.appendChild(imageModal);
  const modalImage = imageModal.querySelector('img');
  const closeImageModal = () => {
    imageModal.classList.remove('is-open');
    imageModal.setAttribute('aria-hidden', 'true');
    modalImage.removeAttribute('src');
  };
  imageModal.addEventListener('click', (event) => {
    if (event.target === imageModal || event.target.classList.contains('lightbox-close')) closeImageModal();
  });

  document.querySelectorAll('.zoomable, .evidence-card img').forEach((image) => {
    image.classList.add('zoomable');
    image.setAttribute('tabindex', '0');
    image.setAttribute('role', 'button');
    image.setAttribute('aria-label', `${image.getAttribute('alt') || 'Evidence image'} — click to zoom`);
    const open = () => {
      modalImage.src = image.currentSrc || image.src;
      modalImage.alt = image.alt || 'Zoomed UXRay evidence';
      imageModal.classList.add('is-open');
      imageModal.setAttribute('aria-hidden', 'false');
    };
    image.addEventListener('click', open);
    image.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        open();
      }
    });
  });

  const dialog = document.createElement('div');
  dialog.className = 'uxray-dialog';
  dialog.setAttribute('aria-hidden', 'true');
  dialog.innerHTML = '<div class="uxray-dialog-card" role="dialog" aria-modal="true" aria-labelledby="uxray-dialog-title"><button class="uxray-dialog-close" type="button" aria-label="Close dialog">×</button><div class="uxray-dialog-content"></div></div>';
  document.body.appendChild(dialog);
  const dialogContent = dialog.querySelector('.uxray-dialog-content');
  const closeDialog = () => {
    dialog.classList.remove('is-open');
    dialog.setAttribute('aria-hidden', 'true');
    dialogContent.innerHTML = '';
  };
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog || event.target.classList.contains('uxray-dialog-close')) closeDialog();
  });

  const openBookmarkDialog = () => {
    const next = encodeURIComponent(window.location.pathname + window.location.search + window.location.hash);
    dialogContent.innerHTML = `
      <p class="section-kicker">Save report</p>
      <h2 id="uxray-dialog-title">Want to bookmark this UXRay page?</h2>
      <p>Saved report links are durable now. Create an account to attach reports, MCP configs, plugin packs, and hosted credits to your workspace once sessions are enabled.</p>
      <div class="dialog-actions">
        <a class="button primary" href="/signup.html?intent=bookmark&next=${next}">Create account</a>
        <a class="button secondary" href="/login.html?intent=bookmark&next=${next}">Log in</a>
        <button class="button ghost" type="button" data-close-dialog>Cancel</button>
      </div>`;
    dialog.classList.add('is-open');
    dialog.setAttribute('aria-hidden', 'false');
  };

  const shareLinks = () => {
    const url = encodeURIComponent(pageUrl());
    const title = encodeURIComponent(`${pageTitle()} — UXRay`);
    return [
      ["X / Twitter", `https://twitter.com/intent/tweet?text=${title}&url=${url}`],
      ["LinkedIn", `https://www.linkedin.com/sharing/share-offsite/?url=${url}`],
      ["Reddit", `https://www.reddit.com/submit?url=${url}&title=${title}`],
      ["Hacker News", `https://news.ycombinator.com/submitlink?u=${url}&t=${title}`],
      ["Email", `mailto:?subject=${title}&body=${url}`]
    ];
  };

  const openShareDialog = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: pageTitle(), text: "UXRay turns frontend review into an agent repair loop.", url: pageUrl() });
        return;
      } catch (error) {
        if (error?.name === "AbortError") return;
      }
    }
    dialogContent.innerHTML = `
      <p class="section-kicker">Share UXRay</p>
      <h2 id="uxray-dialog-title">Share this page.</h2>
      <p>Send UXRay to another builder, save it in your team channel, or copy the link.</p>
      <div class="share-grid">
        ${shareLinks().map(([label, href]) => `<a href="${href}" target="_blank" rel="noreferrer">${label}</a>`).join('')}
      </div>
      <div class="copy-row"><input value="${escapeHtml(pageUrl())}" readonly /><button class="button secondary" type="button" data-copy-link>Copy link</button></div>`;
    dialog.classList.add('is-open');
    dialog.setAttribute('aria-hidden', 'false');
  };

  const hydrateShareActions = () => {
    const privatePath = /\/(login|signup|checkout|account)\.html$/.test(window.location.pathname);
    if (!privatePath && !document.querySelector('.share-actions')) {
      const actions = document.createElement('div');
      actions.className = 'share-actions';
      actions.setAttribute('aria-label', 'Share or bookmark UXRay');
      actions.innerHTML = `
        <button type="button" data-share-action aria-label="Share this UXRay page">Share ${icon('share')}</button>
        <button type="button" data-bookmark-action aria-label="Bookmark this UXRay page">Bookmark ${icon('bookmark')}</button>`;
      document.body.appendChild(actions);
    }

    document.querySelectorAll('.share-actions').forEach((actions) => {
      if (actions.dataset.hydrated === 'true') return;
      const hasButtons = actions.querySelector('[data-share-action], [data-bookmark-action]');
      if (!hasButtons) {
        actions.innerHTML = `
          <button type="button" data-share-action aria-label="Share this UXRay page">Share ${icon('share')}</button>
          <button type="button" data-bookmark-action aria-label="Bookmark this UXRay page">Bookmark ${icon('bookmark')}</button>`;
      }
      actions.dataset.hydrated = 'true';
    });
  };

  hydrateShareActions();

  document.addEventListener('click', async (event) => {
    const target = event.target.closest('[data-share-action], [data-bookmark-action], [data-copy-link], [data-copy-upgrade], [data-close-dialog], [data-dismiss-update]');
    if (!target) return;
    if (target.matches('[data-share-action]')) {
      event.preventDefault();
      openShareDialog();
    }
    if (target.matches('[data-bookmark-action]')) {
      event.preventDefault();
      openBookmarkDialog();
    }
    if (target.matches('[data-copy-link]')) {
      const ok = await copyText(pageUrl());
      target.textContent = ok ? 'Copied' : 'Copy failed';
    }
    if (target.matches('[data-copy-upgrade]')) {
      const command = target.getAttribute('data-copy-upgrade') || 'npm run check:update -- --auto';
      const ok = await copyText(command);
      target.textContent = ok ? 'Command copied' : 'Copy failed';
    }
    if (target.matches('[data-close-dialog]')) closeDialog();
    if (target.matches('[data-dismiss-update]')) {
      const version = target.getAttribute('data-dismiss-update') || UXRAY_VERSION;
      localStorage.setItem(`uxray-update-dismissed-${version}`, 'true');
      target.closest('.update-banner')?.remove();
    }
  });

  const showUpdateBanner = (info) => {
    if (!info?.update_available || !info.latest_version) return;
    if (localStorage.getItem(`uxray-update-dismissed-${info.latest_version}`) === 'true') return;
    const banner = document.createElement('aside');
    banner.className = 'update-banner';
    banner.setAttribute('role', 'status');
    banner.innerHTML = `
      <div><strong>UXRay ${escapeHtml(info.latest_version)} is available.</strong><span>${escapeHtml(info.release_notes?.[0] || 'Run the local upgrade command when ready.')}</span></div>
      <code>${escapeHtml(info.commands?.auto_upgrade || 'npm run check:update -- --auto')}</code>
      <button class="button primary" type="button" data-copy-upgrade="${escapeHtml(info.commands?.auto_upgrade || 'npm run check:update -- --auto')}">Auto-upgrade command</button>
      <button class="button ghost" type="button" data-dismiss-update="${escapeHtml(info.latest_version)}">Cancel</button>`;
    document.body.appendChild(banner);
  };

  const checkForUpdates = async () => {
    if (window.location.protocol === 'file:') return;
    try {
      const endpoint = window.location.hostname.endsWith('useuxray.com') ? '/v1/update' : UPDATE_ENDPOINT;
      const response = await fetch(`${endpoint}?current=${encodeURIComponent(UXRAY_VERSION)}&channel=stable`, { cache: 'no-store' });
      if (!response.ok) return;
      showUpdateBanner(await response.json());
    } catch {
      // Update checks are best-effort and should never block the site.
    }
  };
  window.setTimeout(checkForUpdates, 1200);

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeImageModal();
      closeDialog();
    }
  });
})();
