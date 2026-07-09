import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function listItems(items) {
  return (items || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("\n");
}

function baseStyles() {
  return `
    :root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #0f172a; background: #f8fafc; }
    a { color: inherit; }
    .shell { max-width: 1120px; margin: 0 auto; padding: 36px 24px 64px; }
    .nav { display: flex; justify-content: space-between; gap: 20px; align-items: center; margin-bottom: 56px; }
    .brand { font-weight: 760; letter-spacing: -0.03em; }
    .nav-actions { display: flex; gap: 10px; flex-wrap: wrap; }
    .btn { min-height: 44px; display: inline-flex; align-items: center; justify-content: center; padding: 0 18px; border-radius: 999px; border: 1px solid #cbd5e1; background: white; text-decoration: none; font-weight: 700; }
    .btn.primary { color: white; background: #111827; border-color: #111827; }
    .hero { display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(320px, 0.95fr); gap: 42px; align-items: center; }
    .eyebrow { color: #475569; font-size: 0.85rem; font-weight: 760; text-transform: uppercase; letter-spacing: .12em; }
    h1 { font-size: clamp(2.5rem, 6vw, 4.9rem); line-height: .94; letter-spacing: -0.07em; margin: 14px 0 20px; }
    h2 { font-size: clamp(1.55rem, 3vw, 2.35rem); line-height: 1.04; letter-spacing: -0.05em; margin: 0 0 18px; }
    p { color: #475569; font-size: 1.03rem; line-height: 1.65; }
    .hero p { max-width: 650px; font-size: 1.15rem; }
    .cta-row { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 26px; }
    .panel { background: white; border: 1px solid #dbe3ef; border-radius: 28px; padding: 28px; box-shadow: 0 24px 70px rgba(15,23,42,.08); }
    .grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; margin-top: 34px; }
    .card { background: white; border: 1px solid #dbe3ef; border-radius: 22px; padding: 22px; min-height: 170px; }
    .card h3 { margin: 0 0 10px; font-size: 1.05rem; letter-spacing: -.02em; }
    .card p, .card li { font-size: .94rem; line-height: 1.55; }
    .proof { margin-top: 42px; display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
    code { background: #0f172a; color: #e2e8f0; display: block; border-radius: 18px; padding: 18px; white-space: pre-wrap; }
    @media (max-width: 780px) { .shell { padding: 24px 16px 48px; } .hero, .proof, .grid { grid-template-columns: 1fr; } .nav { align-items: flex-start; flex-direction: column; margin-bottom: 36px; } }
  `;
}

function baselineBody(prompt, run) {
  return `
    <nav class="nav">
      <div class="brand">UXRay TasteBench</div>
      <div class="nav-actions">
        <a class="btn" href="#">Learn more</a><a class="btn" href="#">Get started</a><a class="btn" href="#">Read more</a><a class="btn primary" href="#">Unlock now</a>
      </div>
    </nav>
    <section class="hero">
      <div>
        <div class="eyebrow">${escapeHtml(run.run_id)}</div>
        <h1>Supercharge your workflow with next-generation design intelligence</h1>
        <p>Unlock seamless, enterprise-grade experiences for modern teams. This polished interface helps you streamline everything with delightful cards, effortless insights, and world-class automation.</p>
        <div class="cta-row"><a class="btn primary" href="#">Get started</a><a class="btn" href="#">Learn more</a><a class="btn" href="#">Book demo</a><a class="btn" href="#">Read more</a></div>
      </div>
      <aside class="panel">
        <h2>AI-powered growth engine</h2>
        <p>This generic card soup intentionally includes vague SaaS filler for the baseline condition.</p>
        <ul>${listItems(prompt.slop_risks)}</ul>
      </aside>
    </section>
    <section class="grid">
      <article class="card"><h3>Unlock potential</h3><p>Transform your workflow with cutting-edge capabilities and seamless integrations.</p></article>
      <article class="card"><h3>Streamline teams</h3><p>Empower every stakeholder with revolutionary outcomes and scalable excellence.</p></article>
      <article class="card"><h3>Boost productivity</h3><p>10x your process with fake proof, vague claims, and decorative polish.</p></article>
    </section>
    <section class="grid"><article class="card"><h3>More cards</h3><p>Extra card layer to simulate card soup.</p></article><article class="card"><h3>More proof</h3><p>Another equally weighted block.</p></article><article class="card"><h3>More magic</h3><p>Decorative without task value.</p></article></section>
  `;
}

function tasteBody(prompt, run) {
  return `
    <nav class="nav"><div class="brand">UXRay TasteBench</div><div class="nav-actions"><a class="btn" href="#evidence">See evidence</a><a class="btn primary" href="#start">Start ${escapeHtml(prompt.primary_task)}</a></div></nav>
    <section class="hero">
      <div>
        <div class="eyebrow">${escapeHtml(prompt.route_type)} · technical premium</div>
        <h1>${escapeHtml(prompt.product_goal)}</h1>
        <p>This version uses specific workflow copy and clear mechanism explanation instead of generic SaaS filler. The page is organized around the primary task: ${escapeHtml(prompt.primary_task)}.</p>
        <div class="cta-row"><a id="start" class="btn primary" href="#">${escapeHtml(prompt.primary_task)}</a><a class="btn" href="#evidence">Inspect the mechanism</a></div>
      </div>
      <aside class="panel">
        <h2>How the mechanism works</h2>
        <ol>
          <li>Capture the rendered UI in desktop and mobile.</li>
          <li>Score hard UX issues before subjective taste.</li>
          <li>Feed pairwise human choices back into the next generation.</li>
        </ol>
      </aside>
    </section>
    <section id="evidence" class="proof">
      <article class="panel"><h2>Prefer</h2><ul><li>specific workflow copy</li><li>clear mechanism explanation</li><li>quiet secondary text</li></ul></article>
      <article class="panel"><h2>Avoid</h2><ul>${listItems(prompt.slop_risks)}</ul></article>
    </section>
  `;
}

function repairBody(prompt, run) {
  return `
    <nav class="nav"><div class="brand">UXRay repair-ready</div><div class="nav-actions"><a class="btn primary" href="#run">${escapeHtml(prompt.primary_task)}</a></div></nav>
    <section class="hero">
      <div>
        <div class="eyebrow">${escapeHtml(run.run_id)} · verified loop</div>
        <h1>${escapeHtml(prompt.product_goal)}</h1>
        <p>UXRay repair-ready fixture: one primary task, concrete evidence, balanced surfaces, and no vague marketing filler. The design keeps visual structure calm while preserving the product mechanism.</p>
        <div class="cta-row"><a id="run" class="btn primary" href="#">${escapeHtml(prompt.primary_task)}</a></div>
      </div>
      <aside class="panel">
        <h2>Review contract</h2>
        <code>render desktop/mobile\nmeasure hard failures\nrepair high severity\nrerun UXRay</code>
        <p>Clear spacing separates the code block from follow-up explanation.</p>
      </aside>
    </section>
    <section class="grid">
      <article class="card"><h3>Primary mechanism</h3><p>Browser capture, DOM extraction, and layout metrics produce actionable evidence.</p></article>
      <article class="card"><h3>Human taste loop</h3><p>Pairwise choices teach which variant fits the active profile.</p></article>
      <article class="card"><h3>Regression check</h3><p>Before/after reports keep repairs from hiding new blockers.</p></article>
    </section>
  `;
}

export function conditionFixtureHtml({ run, prompt, condition = run.condition }) {
  const body = condition === "baseline" ? baselineBody(prompt, run) : condition === "taste_context" ? tasteBody(prompt, run) : repairBody(prompt, run);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(run.run_id)}</title>
  <style>${baseStyles()}</style>
</head>
<body data-prompt-id="${escapeHtml(run.prompt_id)}" data-condition="${escapeHtml(condition)}">
  <main class="shell">
    ${body}
  </main>
</body>
</html>`;
}

export async function materializeBenchmarkFixtures(plan, { outputRoot = "reports/taste-benchmark", onlyCondition } = {}) {
  const promptById = new Map(plan.prompts.map((prompt) => [prompt.id, prompt]));
  const written = [];
  for (const run of plan.runs) {
    if (onlyCondition && run.condition !== onlyCondition) continue;
    const prompt = promptById.get(run.prompt_id);
    if (!prompt) continue;
    const html = conditionFixtureHtml({ run, prompt });
    const htmlPath = path.join(outputRoot, run.prompt_id, run.condition, "index.html");
    await mkdir(path.dirname(htmlPath), { recursive: true });
    await writeFile(htmlPath, html);
    written.push({ run_id: run.run_id, condition: run.condition, html_path: htmlPath });
  }
  return written;
}

export function reviewCommandForRun(run, { port, rootDir = "reports/taste-benchmark" }) {
  const urlPath = `${run.prompt_id}/${run.condition}/index.html`.split(path.sep).map(encodeURIComponent).join("/");
  return {
    command: "npm run review:url",
    env: {
      TEST_URL: `http://127.0.0.1:${port}/${urlPath}`,
      REVIEW_LABEL: "review",
      REVIEW_OUTPUT_DIR: path.join(rootDir, run.prompt_id, run.condition),
      REVIEW_GOAL: run.generator_prompt.slice(0, 900),
      REVIEW_AUDIENCE: "UXRay taste-loop benchmark evaluator",
      REVIEW_TASTE_PROFILE: run.review_taste_profile || "balanced"
    }
  };
}
