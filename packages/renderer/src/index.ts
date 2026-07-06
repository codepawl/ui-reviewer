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
  above_fold: boolean;
};

export type ViewportLayoutMetrics = {
  above_fold_action_count: number;
  primary_heading_area_ratio: number;
  tiny_tap_target_count: number;
  crowded_region_count: number;
  overlapping_element_count: number;
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
            text: clean(el.textContent).slice(0, 120),
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            font_size: Number.parseFloat(style.fontSize) || 0,
            font_weight: style.fontWeight,
            color: style.color,
            background_color: style.backgroundColor,
            above_fold: rect.top < window.innerHeight && rect.bottom > 0
          };
        };
        const visible = (el) => {
          const rect = el.getBoundingClientRect();
          const style = window.getComputedStyle(el);
          return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
        };
        const ctaElements = Array.from(document.querySelectorAll("button,a.button,[role='button'],input[type='button'],input[type='submit'],a[href]"))
          .filter(visible)
          .map(elementMetric)
          .filter((item) => item.text || item.tag === "input")
          .slice(0, 24);
        const headingElements = Array.from(document.querySelectorAll("h1,h2,h3"))
          .filter(visible)
          .map(elementMetric)
          .slice(0, 18);
        const cardLikeElements = Array.from(document.querySelectorAll("section,article,.card,[class*='card'],[class*='grid'],[class*='panel']"))
          .filter(visible)
          .map(elementMetric);
        const crowdedRegionCount = cardLikeElements.filter((item) => item.width > 0 && item.height > 0 && clean(item.text).length / Math.max(1, item.width * item.height / 1000) > 2.6).length;
        const tinyTapTargetCount = ctaElements.filter((item) => item.above_fold && (item.width < 40 || item.height < 36)).length;
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
            crowded_region_count: crowdedRegionCount,
            overlapping_element_count: overlappingElementCount,
            cta_elements: ctaElements.slice(0, 12),
            heading_elements: headingElements.slice(0, 12)
          }
        };
      })()`) as { document_scroll_width: number; body_scroll_width: number; layout_metrics: ViewportLayoutMetrics };
      const screenshotPath = path.join(outDir, `${slug(url)}-${viewportName}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
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
