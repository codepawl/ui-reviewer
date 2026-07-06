(() => {
  const escapeHtml = (value) => value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const highlight = (line) => {
    const tokenPattern = /(#.*$|--[a-zA-Z0-9-]+|'.*?'|".*?"|\b(?:npm|npx|codex|claude|curl|git|cd|export|wrangler|uxray|review_ui_url|review_ui_diff|health_check|demo:pipeline|demo:report|typecheck|build|mcp)\b)/g;
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
            : /^(review_ui_url|review_ui_diff|health_check|demo:pipeline|demo:report|typecheck|build|mcp)$/.test(token)
              ? "tok-fn"
              : "tok-command";
      output += `<span class="${klass}">${escapeHtml(token)}</span>`;
      cursor = index + token.length;
    }
    output += escapeHtml(line.slice(cursor));
    return output;
  };

  document.querySelectorAll('pre code').forEach((code) => {
    if (code.dataset.highlighted === 'true') return;
    const lines = code.textContent.replace(/\s+$/g, '').split('\n');
    code.innerHTML = lines.map((line) => `<span class="code-line">${highlight(line)}</span>`).join('');
    code.dataset.highlighted = 'true';
  });

  const hydrateIconifyFallbacks = () => {
    document.querySelectorAll('iconify-icon[icon]').forEach(async (icon) => {
      if (icon.dataset.fallbackHydrated === 'true') return;
      const name = icon.getAttribute('icon') || '';
      if (!/^[a-z0-9-]+:[a-z0-9-]+$/i.test(name)) return;
      await new Promise((resolve) => window.setTimeout(resolve, 900));
      if (icon.shadowRoot?.querySelector('svg') || icon.querySelector('svg')) return;
      const [prefix, slug] = name.split(':');
      try {
        const response = await fetch(`https://api.iconify.design/${prefix}/${slug}.svg?width=24&height=24`, { cache: 'force-cache' });
        if (!response.ok) return;
        icon.innerHTML = await response.text();
        icon.dataset.fallbackHydrated = 'true';
      } catch {
        // Iconify CDN can be blocked by privacy filters; text labels remain usable.
      }
    });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hydrateIconifyFallbacks);
  else hydrateIconifyFallbacks();

  const modal = document.createElement('div');
  modal.className = 'image-lightbox';
  modal.setAttribute('aria-hidden', 'true');
  modal.innerHTML = '<button class="lightbox-close" aria-label="Close image preview">×</button><img alt="Zoomed UXRay evidence" />';
  document.body.appendChild(modal);
  const modalImage = modal.querySelector('img');
  const close = () => {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    modalImage.removeAttribute('src');
  };
  modal.addEventListener('click', (event) => {
    if (event.target === modal || event.target.classList.contains('lightbox-close')) close();
  });
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close();
  });

  document.querySelectorAll('.zoomable, .evidence-card img').forEach((image) => {
    image.classList.add('zoomable');
    image.setAttribute('tabindex', '0');
    image.setAttribute('role', 'button');
    image.setAttribute('aria-label', `${image.getAttribute('alt') || 'Evidence image'} — click to zoom`);
    const open = () => {
      modalImage.src = image.currentSrc || image.src;
      modalImage.alt = image.alt || 'Zoomed UXRay evidence';
      modal.classList.add('is-open');
      modal.setAttribute('aria-hidden', 'false');
    };
    image.addEventListener('click', open);
    image.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        open();
      }
    });
  });
})();
