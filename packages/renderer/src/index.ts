import { chromium } from "playwright-core";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

export type ViewportName = "desktop" | "mobile";

export type RenderedElement = {
  text: string;
  role?: string;
  href?: string | null;
  tag: string;
};

export type LayoutElementMetric = {
  selector: string;
  tag: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  font_size: number;
  font_weight: string;
  color: string;
  background_color: string;
  center_offset_px?: number;
  text_overflow?: boolean;
  above_fold: boolean;
};

export type ViewportLayoutMetrics = {
  above_fold_action_count: number;
  primary_heading_area_ratio: number;
  tiny_tap_target_count: number;
  unlabeled_action_count: number;
  crowded_region_count: number;
  overlapping_element_count: number;
  unsafe_translucent_overlay_count: number;
  misaligned_section_heading_count: number;
  cramped_peer_card_count: number;
  peer_card_imbalance_count: number;
  weak_primary_card_text_count: number;
  over_carded_section_count: number;
  tight_block_spacing_count: number;
  unique_font_family_count: number;
  dominant_font_family: string;
  gradient_text_count: number;
  side_accent_card_count: number;
  nested_card_depth: number;
  cta_elements: LayoutElementMetric[];
  heading_elements: LayoutElementMetric[];
};

export type RenderedViewport = {
  name: ViewportName;
  width: number;
  height: number;
  document_scroll_width: number;
  body_scroll_width: number;
  layout_metrics: ViewportLayoutMetrics;
  screenshot_path: string;
};

export type RenderedUiContext = {
  url: string;
  final_url: string;
  title: string;
  captured_at: string;
  viewports: RenderedViewport[];
  headings: RenderedElement[];
  buttons: RenderedElement[];
  links: RenderedElement[];
  forms: RenderedElement[];
  text_sample: string;
};

const VIEWPORTS: Record<ViewportName, { width: number; height: number }> = {
  desktop: { width: 1440, height: 1000 },
  mobile: { width: 390, height: 844 }
};

export type CaptureOptions = {
  viewport?: string[];
  outDir?: string;
  chromeExecutable?: string;
};

function normalizeViewports(viewport?: string[]): ViewportName[] {
  const requested = viewport?.length ? viewport : ["desktop", "mobile"];
  const clean = requested.filter((name): name is ViewportName => name === "desktop" || name === "mobile");
  return clean.length ? Array.from(new Set(clean)) : ["desktop", "mobile"];
}

function slug(input: string): string {
  const hash = crypto.createHash("sha1").update(input).digest("hex").slice(0, 8);
  return `${input.replace(/^https?:\/\//, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0, 48)}-${hash}`;
}

function resolveChromeExecutable(explicit?: string): string {
  if (explicit) return explicit;
  if (process.env.UI_REVIEWER_CHROME) return process.env.UI_REVIEWER_CHROME;
  for (const candidate of ["/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"]) {
    if (existsSync(candidate)) return candidate;
  }
  return chromium.executablePath();
}

export async function captureUiUrl(url: string, options: CaptureOptions = {}): Promise<RenderedUiContext> {
  const outDir = options.outDir ?? path.resolve(process.cwd(), "reports", "screenshots");
  await mkdir(outDir, { recursive: true });

  const executablePath = resolveChromeExecutable(options.chromeExecutable);
  const browser = await chromium.launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"]
  });

  const viewports = normalizeViewports(options.viewport);
  const screenshots: RenderedViewport[] = [];
  let title = "";
  let finalUrl = url;
  let dom: Omit<RenderedUiContext, "url" | "final_url" | "title" | "captured_at" | "viewports"> | null = null;

  try {
    for (const viewportName of viewports) {
      const size = VIEWPORTS[viewportName];
      const page = await browser.newPage({ viewport: size });
      page.setDefaultTimeout(60_000);
      page.setDefaultNavigationTimeout(45_000);
      await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
      title = await page.title();
      finalUrl = page.url();

      if (!dom) {
        dom = await page.evaluate(`(() => {
          const clean = (text) => (text || "").replace(/\\s+/g, " ").trim();
          const labelFor = (el) => clean(el.textContent)
            || clean(el.getAttribute('aria-label'))
            || clean(el.getAttribute('placeholder'))
            || clean(el.getAttribute('name'))
            || clean(el.getAttribute('type'));
          const pick = (selector, role) => Array.from(document.querySelectorAll(selector))
            .slice(0, 30)
            .map((el) => ({
              text: labelFor(el),
              role,
              href: el instanceof HTMLAnchorElement ? el.href : null,
              tag: el.tagName.toLowerCase()
            }))
            .filter((item) => item.text.length > 0 || item.href);
          const bodyText = clean(document.body && document.body.innerText ? document.body.innerText : "");
          return {
            headings: pick("h1,h2,h3,h4,h5,h6", "heading"),
            buttons: pick("button,a.button,[role='button'],input[type='button'],input[type='submit']", "button"),
            links: pick("a[href]", "link"),
            forms: pick("form,input,textarea,select", "form"),
            text_sample: bodyText.slice(0, 3500)
          };
        })()`);
      }

      const layoutMetrics = await page.evaluate(`(() => {
        const clean = (text) => (text || "").replace(/\\s+/g, " ").trim();
        const labelFor = (el) => clean(el.textContent)
          || clean(el.getAttribute('aria-label'))
          || clean(el.getAttribute('title'))
          || clean(el.getAttribute('placeholder'))
          || clean(el.getAttribute('name'))
          || clean(el.getAttribute('type'));
        const alphaFor = (value) => {
          const color = (value || '').trim().toLowerCase();
          if (!color || color === 'transparent') return 0;
          if (!color.startsWith('rgb')) return 1;
          const open = color.indexOf('(');
          const close = color.lastIndexOf(')');
          if (open < 0 || close <= open) return 1;
          const parts = color.slice(open + 1, close).split(',').map((part) => Number.parseFloat(part.trim()));
          return parts.length >= 4 && !Number.isNaN(parts[3]) ? parts[3] : 1;
        };
        const rgbParts = (value) => {
          const color = (value || '').trim().toLowerCase();
          if (!color.startsWith('rgb')) return null;
          const open = color.indexOf('(');
          const close = color.lastIndexOf(')');
          if (open < 0 || close <= open) return null;
          const parts = color.slice(open + 1, close).split(',').slice(0, 3).map((part) => Number.parseFloat(part.trim()));
          return parts.length === 3 && parts.every((part) => !Number.isNaN(part)) ? parts : null;
        };
        const effectiveBackgroundColor = (el) => {
          for (let node = el; node && node instanceof Element; node = node.parentElement) {
            const color = window.getComputedStyle(node).backgroundColor;
            if (alphaFor(color) >= 0.85) return color;
          }
          return window.getComputedStyle(document.body).backgroundColor || 'rgb(255, 255, 255)';
        };
        const selectorFor = (el) => {
          const tag = el.tagName.toLowerCase();
          const id = el.id ? "#" + el.id : "";
          const className = typeof el.className === "string" && el.className.trim()
            ? "." + el.className.trim().split(/\\s+/).slice(0, 2).join(".")
            : "";
          return tag + id + className;
        };
        const elementMetric = (el) => {
          const rect = el.getBoundingClientRect();
          const style = window.getComputedStyle(el);
          return {
            selector: selectorFor(el),
            tag: el.tagName.toLowerCase(),
            text: labelFor(el).slice(0, 120),
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            font_size: Number.parseFloat(style.fontSize) || 0,
            font_weight: style.fontWeight,
            color: style.color,
            background_color: effectiveBackgroundColor(el),
            center_offset_px: Math.round(rect.x + rect.width / 2 - window.innerWidth / 2),
            text_overflow: el.scrollWidth > el.clientWidth + 2 || el.scrollHeight > el.clientHeight + 2,
            above_fold: rect.top < window.innerHeight && rect.bottom > 0
          };
        };
        const visible = (el) => {
          if (el.closest('[aria-hidden="true"], .uxray-dialog:not(.is-open), .image-lightbox:not(.is-open)')) return false;
          const rect = el.getBoundingClientRect();
          const style = window.getComputedStyle(el);
          return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none" && style.opacity !== "0";
        };
        const rawCtaElements = Array.from(document.querySelectorAll("button,a.button,[role='button'],input[type='button'],input[type='submit'],a[data-uxray-action]"))
          .filter(visible)
          .map(elementMetric);
        const ctaElements = rawCtaElements
          .filter((item) => item.text || item.tag === "input")
          .slice(0, 24);
        const headingElements = Array.from(document.querySelectorAll("h1,h2,h3"))
          .filter(visible)
          .map(elementMetric)
          .slice(0, 18);
        const rawCardElements = Array.from(document.querySelectorAll("section,article,.card,[class*='card'],[class*='grid'],[class*='panel']"))
          .filter(visible);
        const cardLikeElements = rawCardElements.map(elementMetric);
        const compactPeerLabels = Array.from(document.querySelectorAll("[class*='visual'] span,[class*='grid'] > article > span,[class*='card'] > span"))
          .filter(visible)
          .map(elementMetric)
          .filter((item) => {
            const length = clean(item.text).length;
            return length >= 14 && (item.text_overflow || item.width < Math.min(170, length * 8.5 + 20));
          });
        const peerContainers = Array.from(document.querySelectorAll(".checkout-summary,.pricing-grid,.docs-grid,.cloud-grid,.feature-grid,.proof-scoreboard,[class*='card-grid'],[class*='plan-grid']"))
          .filter(visible);
        const peerCardImbalanceCount = peerContainers.filter((container) => {
          const children = Array.from(container.children).filter(visible).filter((child) => {
            const rect = child.getBoundingClientRect();
            return rect.width >= 70 && rect.height >= 40 && clean(child.textContent).length >= 8;
          });
          if (children.length < 3 || children.length > 8) return false;
          const metrics = children.map((child) => {
            const rect = child.getBoundingClientRect();
            const textLength = clean(child.textContent).length;
            const area = Math.max(1, rect.width * rect.height);
            return { width: rect.width, height: rect.height, top: rect.top, density: textLength / area };
          });
          const rowGroups = [];
          for (const item of metrics) {
            const row = rowGroups.find((group) => Math.abs(group[0].top - item.top) < 18);
            if (row) row.push(item); else rowGroups.push([item]);
          }
          const imbalancedRow = rowGroups.some((row) => {
            if (row.length < 2) return false;
            const widths = row.map((item) => item.width);
            const heights = row.map((item) => item.height);
            return Math.max(...widths) - Math.min(...widths) > 18 || Math.max(...heights) - Math.min(...heights) > 18;
          });
          const heights = metrics.map((item) => item.height);
          const densities = metrics.map((item) => item.density).filter((value) => value > 0);
          const stackHeightImbalance = rowGroups.every((row) => row.length === 1) && Math.max(...heights) - Math.min(...heights) > 18;
          const densityImbalance = densities.length >= 3 && Math.max(...densities) / Math.max(0.0001, Math.min(...densities)) > 2.15;
          return imbalancedRow || stackHeightImbalance || densityImbalance;
        }).length;
        const visibleTextElements = Array.from(document.querySelectorAll("h1,h2,h3,h4,h5,h6,p,a,button,li,label,span,strong,small"))
          .filter(visible)
          .filter((el) => clean(el.textContent).length > 0);
        const weakPrimaryCardTextCount = visibleTextElements.filter((el) => {
          const text = clean(el.textContent);
          if (text.length < 3 || text.length > 64) return false;
          if (!el.matches("h3,h4,strong,[class*='card'] > span,[class*='visual'] span,[class*='grid'] > article > span")) return false;
          const card = el.closest("article,.card,[class*='card'],[class*='panel'],[class*='visual']");
          if (!card || !visible(card)) return false;
          const rect = card.getBoundingClientRect();
          if (rect.width < 70 || rect.height < 45) return false;
          const style = window.getComputedStyle(el);
          const rgb = rgbParts(style.color);
          if (!rgb) return false;
          const average = (rgb[0] + rgb[1] + rgb[2]) / 3;
          const grayscaleSpread = Math.max(...rgb) - Math.min(...rgb);
          const weight = Number.parseInt(style.fontWeight, 10) || 400;
          return average >= 92 && average <= 154 && grayscaleSpread <= 28 && weight <= 760;
        }).length;
        const cardSurfaceCountFor = (el) => Array.from(el.querySelectorAll("article,.card,[class*='card'],.callout,[class*='callout']"))
          .filter(visible)
          .filter((child) => {
            const rect = child.getBoundingClientRect();
            const style = window.getComputedStyle(child);
            return rect.width >= 120 && rect.height >= 56 && Number.parseFloat(style.borderTopWidth) >= 1 && Number.parseFloat(style.borderTopLeftRadius) >= 8;
          }).length;
        const isCardSurface = (el) => {
          if (!visible(el)) return false;
          const rect = el.getBoundingClientRect();
          const style = window.getComputedStyle(el);
          return rect.width >= 120 && rect.height >= 56 && Number.parseFloat(style.borderTopWidth) >= 1 && Number.parseFloat(style.borderTopLeftRadius) >= 8;
        };
        const overCardedSectionCount = Array.from(document.querySelectorAll("main,section"))
          .filter(visible)
          .filter((container) => {
            const children = Array.from(container.children).filter(visible);
            return children.some((child, index) => {
              const childCardCount = cardSurfaceCountFor(child);
              if (childCardCount < 3) return false;
              const followingCardSurfaces = children.slice(index + 1, index + 4).filter(isCardSurface).length;
              return followingCardSurfaces >= 2;
            });
          }).length;
        const isPanelLikeBlock = (el) => {
          const rect = el.getBoundingClientRect();
          const style = window.getComputedStyle(el);
          const isExplicitPanel = el.matches("pre,figure,.card,[class*='card'],[class*='panel'],[class*='preview'],[class*='code']");
          const hasPanelSurface = rect.height >= 64 && (Number.parseFloat(style.borderTopWidth) >= 1 || Number.parseFloat(style.borderTopLeftRadius) >= 10);
          return isExplicitPanel || hasPanelSurface;
        };
        const isFollowupTextBlock = (el) => el.matches("p,ul,ol,small,.fine-print,[class*='lede'],[class*='helper']") && clean(el.textContent).length >= 18;
        const tightBlockSpacingCount = Array.from(document.querySelectorAll("main,section,article,div"))
          .filter(visible)
          .reduce((count, parent) => {
            const children = Array.from(parent.children).filter(visible);
            for (let index = 0; index < children.length - 1; index += 1) {
              const current = children[index];
              const next = children[index + 1];
              if (!isPanelLikeBlock(current) || !isFollowupTextBlock(next)) continue;
              const currentRect = current.getBoundingClientRect();
              const nextRect = next.getBoundingClientRect();
              const gap = nextRect.top - currentRect.bottom;
              const nextStyle = window.getComputedStyle(next);
              const nextLineHeight = Number.parseFloat(nextStyle.lineHeight) || Number.parseFloat(nextStyle.fontSize) * 1.4 || 20;
              const minGap = Math.min(28, Math.max(18, nextLineHeight * 0.85));
              if (currentRect.width >= 160 && currentRect.height >= 54 && gap >= 0 && gap < minGap) count += 1;
            }
            return count;
          }, 0);
        const fontFamilies = visibleTextElements
          .map((el) => (window.getComputedStyle(el).fontFamily || '').split(',')[0].replace(/[\"']/g, '').trim().toLowerCase())
          .filter(Boolean);
        const fontCounts = fontFamilies.reduce((map, family) => map.set(family, (map.get(family) || 0) + 1), new Map());
        const dominantFontFamily = [...fontCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '';
        const gradientTextCount = visibleTextElements.filter((el) => {
          const style = window.getComputedStyle(el);
          return style.backgroundImage.includes('gradient') && (style.webkitBackgroundClip === 'text' || style.backgroundClip === 'text');
        }).length;
        const sideAccentCardCount = rawCardElements.filter((el) => {
          const rect = el.getBoundingClientRect();
          const style = window.getComputedStyle(el);
          const radius = Number.parseFloat(style.borderTopLeftRadius) || 0;
          const widths = [style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth].map((value) => Number.parseFloat(value) || 0);
          const max = Math.max(...widths);
          const min = Math.min(...widths);
          return rect.width >= 120 && rect.height >= 60 && radius >= 8 && max >= 4 && max - min >= 3;
        }).length;
        const nestedCardDepth = rawCardElements.reduce((maxDepth, el) => {
          let depth = 0;
          for (let node = el.parentElement; node; node = node.parentElement) {
            if (node.matches && node.matches("section,article,.card,[class*='card'],[class*='panel']")) depth += 1;
          }
          return Math.max(maxDepth, depth);
        }, 0);
        const crowdedRegionCount = cardLikeElements.filter((item) => item.width > 0 && item.height > 0 && clean(item.text).length / Math.max(1, item.width * item.height / 1000) > 2.6).length;
        const misalignedSectionHeadingCount = Array.from(document.querySelectorAll("h2"))
          .filter(visible)
          .filter((el) => {
            const rect = el.getBoundingClientRect();
            const style = window.getComputedStyle(el);
            const parentStyle = el.parentElement ? window.getComputedStyle(el.parentElement) : style;
            const centeredContext = style.textAlign === 'center'
              || parentStyle.textAlign === 'center'
              || !!el.closest('.section-center,.stack-strip,.proof-metric,.cloud-band,.pricing,.hero-statement');
            return centeredContext
              && rect.width >= Math.min(460, window.innerWidth * 0.35)
              && Math.abs(rect.x + rect.width / 2 - window.innerWidth / 2) > 80;
          }).length;
        const overlayCandidates = Array.from(document.querySelectorAll('header,nav,[class*="nav"],[class*="header"],[class*="toolbar"],[class*="sticky"]'))
          .filter(visible)
          .filter((el) => {
            const rect = el.getBoundingClientRect();
            const style = window.getComputedStyle(el);
            return (style.position === 'sticky' || style.position === 'fixed') && rect.height > 0 && rect.height <= 130 && alphaFor(style.backgroundColor) < 0.72;
          });
        const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
        const scrollStops = [...new Set([0, 120, 240, 420, 640].map((value) => Math.min(value, maxScroll)))];
        let unsafeTranslucentOverlayCount = 0;
        for (const overlay of overlayCandidates) {
          let isUnsafe = false;
          for (const scrollY of scrollStops) {
            window.scrollTo(0, scrollY);
            const rect = overlay.getBoundingClientRect();
            if (rect.bottom <= 0 || rect.top >= window.innerHeight) continue;
            const sampleY = Math.max(1, Math.min(window.innerHeight - 1, rect.top + rect.height / 2));
            const sampleXs = [rect.left + rect.width * 0.18, rect.left + rect.width * 0.42, rect.left + rect.width * 0.66, rect.left + rect.width * 0.86]
              .map((x) => Math.max(1, Math.min(window.innerWidth - 1, x)));
            for (const sampleX of sampleXs) {
              const underlay = document.elementsFromPoint(sampleX, sampleY)
                .find((node) => node instanceof Element && node !== overlay && !overlay.contains(node) && visible(node) && clean(node.textContent).length > 0);
              if (underlay) {
                isUnsafe = true;
                break;
              }
            }
            if (isUnsafe) break;
          }
          if (isUnsafe) unsafeTranslucentOverlayCount += 1;
        }
        window.scrollTo(0, 0);
        const tinyTapTargetCount = ctaElements.filter((item) => item.above_fold && (item.width < 44 || item.height < 44)).length;
        const unlabeledActionCount = rawCtaElements.filter((item) => item.above_fold && !item.text && item.tag !== "input").length;
        const primaryHeading = headingElements.find((item) => item.tag === "h1");
        const primaryHeadingAreaRatio = primaryHeading ? Number(((primaryHeading.width * primaryHeading.height) / (window.innerWidth * window.innerHeight)).toFixed(4)) : 0;
        let overlappingElementCount = 0;
        for (let i = 0; i < ctaElements.length; i += 1) {
          for (let j = i + 1; j < ctaElements.length; j += 1) {
            const a = ctaElements[i];
            const b = ctaElements[j];
            const overlaps = a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
            if (overlaps) overlappingElementCount += 1;
          }
        }
        return {
          document_scroll_width: document.documentElement.scrollWidth,
          body_scroll_width: document.body.scrollWidth,
          layout_metrics: {
            above_fold_action_count: ctaElements.filter((item) => item.above_fold).length,
            primary_heading_area_ratio: primaryHeadingAreaRatio,
            tiny_tap_target_count: tinyTapTargetCount,
            unlabeled_action_count: unlabeledActionCount,
            crowded_region_count: crowdedRegionCount,
            overlapping_element_count: overlappingElementCount,
            unsafe_translucent_overlay_count: unsafeTranslucentOverlayCount,
            misaligned_section_heading_count: misalignedSectionHeadingCount,
            cramped_peer_card_count: compactPeerLabels.length,
            peer_card_imbalance_count: peerCardImbalanceCount,
            weak_primary_card_text_count: weakPrimaryCardTextCount,
            over_carded_section_count: overCardedSectionCount,
            tight_block_spacing_count: tightBlockSpacingCount,
            unique_font_family_count: new Set(fontFamilies).size,
            dominant_font_family: dominantFontFamily,
            gradient_text_count: gradientTextCount,
            side_accent_card_count: sideAccentCardCount,
            nested_card_depth: nestedCardDepth,
            cta_elements: ctaElements.slice(0, 12),
            heading_elements: headingElements.slice(0, 12)
          }
        };
      })()`) as { document_scroll_width: number; body_scroll_width: number; layout_metrics: ViewportLayoutMetrics };
      const screenshotPath = path.join(outDir, `${slug(url)}-${viewportName}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true, animations: "disabled", timeout: 60_000 });
      screenshots.push({
        name: viewportName,
        width: size.width,
        height: size.height,
        document_scroll_width: layoutMetrics.document_scroll_width,
        body_scroll_width: layoutMetrics.body_scroll_width,
        layout_metrics: layoutMetrics.layout_metrics,
        screenshot_path: screenshotPath
      });
      await page.close();
    }
  } finally {
    await browser.close();
  }

  if (!dom) {
    throw new Error("No DOM context captured");
  }

  return {
    url,
    final_url: finalUrl,
    title,
    captured_at: new Date().toISOString(),
    viewports: screenshots,
    ...dom
  };
}
