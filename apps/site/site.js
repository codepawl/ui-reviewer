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


  const getPath = (object, path) => path.split('.').reduce((value, key) => value?.[key], object);

  const hydrateDashboard = async () => {
    const root = document.querySelector('[data-dashboard-root]');
    if (!root) return;
    try {
      const response = await fetch('/v1/account/dashboard', { cache: 'no-store' });
      if (!response.ok) throw new Error(`Dashboard request failed: ${response.status}`);
      const dashboard = await response.json();

      root.querySelectorAll('[data-dashboard-field]').forEach((node) => {
        const value = getPath(dashboard, node.getAttribute('data-dashboard-field') || '');
        node.textContent = value === null || value === undefined || value === '' ? '—' : String(value);
      });

      const reports = root.querySelector('[data-dashboard-reports]');
      const recentReports = dashboard.recent_reports || [];
      if (reports) {
        reports.innerHTML = recentReports.length
          ? recentReports.map((report) => `
            <a class="report-row" href="${escapeHtml(report.report_url)}">
              <span><strong>${escapeHtml(report.title || 'Saved UXRay report')}</strong><small>${escapeHtml(report.reviewed_url || '')}</small></span>
              <span><b>${escapeHtml(report.score ?? '—')}</b><small>${escapeHtml(report.verdict || '')}</small></span>
            </a>`).join('')
          : '<p class="fine-print">No saved hosted reports yet. Run a hosted review to unlock the dashboard.</p>';
      }

      const achievements = root.querySelector('[data-dashboard-achievements]');
      if (achievements) {
        achievements.innerHTML = (dashboard.achievements || []).map((achievement) => {
          const percent = Math.min(100, Math.round(((achievement.progress || 0) / Math.max(achievement.target || 1, 1)) * 100));
          return `<article class="achievement-card ${escapeHtml(achievement.status)}">
            <div><strong>${escapeHtml(achievement.name)}</strong><span>${escapeHtml(achievement.status)}</span></div>
            <p>${escapeHtml(achievement.description)}</p>
            <div class="progress"><i style="width:${percent}%"></i></div>
            <small>${escapeHtml(achievement.progress || 0)} / ${escapeHtml(achievement.target || 1)}</small>
          </article>`;
        }).join('');
      }

      const features = root.querySelector('[data-dashboard-features]');
      const apiKeys = root.querySelector('[data-dashboard-api-keys]');
      if (apiKeys) {
        const keys = dashboard.api_keys || [];
        apiKeys.innerHTML = keys.length
          ? keys.map((key) => `
            <div class="report-row">
              <span><strong>${escapeHtml(key.label || 'UXRay API key')}</strong><small>${escapeHtml(key.prefix || '')}••••</small></span>
              <span><b>${escapeHtml(key.revoked_at ? 'revoked' : 'active')}</b><small>${escapeHtml(key.last_used_at || 'never used')}</small></span>
            </div>`).join('')
          : '<p class="fine-print">No API keys yet. Verify email, then POST /v1/account/api-keys to create one.</p>';
      }

      if (features) {
        features.innerHTML = (dashboard.advanced_features || []).map((feature) => `
          <article class="feature-bet">
            <div><span>${escapeHtml(feature.category)}</span><b>${escapeHtml(feature.price_anchor)}</b></div>
            <h3>${escapeHtml(feature.name)}</h3>
            <p>${escapeHtml(feature.description)}</p>
            <small>${escapeHtml(feature.why_it_can_charge)}</small>
          </article>`).join('');
      }
    } catch (error) {
      root.querySelectorAll('[data-dashboard-reports], [data-dashboard-achievements], [data-dashboard-api-keys], [data-dashboard-features]').forEach((node) => {
        node.innerHTML = `<p class="fine-print">Dashboard failed to load: ${escapeHtml(error?.message || error)}</p>`;
      });
    }
  };
  hydrateDashboard();

  document.addEventListener('click', async (event) => {
    const target = event.target.closest('[data-copy-link], [data-copy-upgrade], [data-close-dialog], [data-dismiss-update]');
    if (!target) return;
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
