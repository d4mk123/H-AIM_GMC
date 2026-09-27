/**
 * Deterministic weekly-brief builder.
 *
 * Used when the AI provider is unavailable, rate limited or returns
 * unusable JSON, so POST /brief still answers with something actionable.
 * Every recommendation is derived from the supplied items and the profile
 * interests — nothing is invented beyond the playbook templates below.
 */

const normalize = (value) => String(value ?? '').trim().toLowerCase();

// Focused templates for the tags that actually occur in the seed/feed data.
const PLAYBOOK = {
  ai: {
    name: 'Applied LLM engineering',
    focus: 'shipping features on top of hosted models',
    roadmap: [
      'Pick one repeated task from your week and automate it with a single model call',
      'Learn prompt structuring, JSON output modes and failure handling',
      'Add retrieval: embed a small local corpus and ground answers in it',
      'Evaluate with a 20-case golden set before changing prompts again',
      'Deploy behind an endpoint with timeouts, caching and cost limits',
    ],
    milestones: ['First working prototype', 'Golden evaluation set', 'Deployed endpoint'],
    checklist: ['API key stored in env only', 'JSON output validated', 'Latency and cost measured', 'Failure path returns a fallback'],
  },
  ml: {
    name: 'Machine learning fundamentals',
    focus: 'moving from notebooks to models you can defend',
    roadmap: [
      'Refresh supervised vs unsupervised learning and train/test splits',
      'Reproduce one classic model (regression or tree ensemble) end to end',
      'Learn the core metrics: precision, recall, ROC-AUC and when each misleads',
      'Tune hyperparameters with cross-validation instead of manual guessing',
      'Write a one-page model card describing data, limits and drift risk',
    ],
    milestones: ['Baseline reproduced', 'Cross-validated tuning', 'Model card written'],
    checklist: ['Dataset documented', 'Baseline metric recorded', 'Leakage checked', 'Reproducible training script'],
  },
  cloud: {
    name: 'Cloud & DevOps foundations',
    focus: 'running services other people can rely on',
    roadmap: [
      'Containerise an existing project with a multi-stage Dockerfile',
      'Provision it with infrastructure as code instead of clicks',
      'Add health checks, structured logs and a readiness probe',
      'Set up CI that builds, tests and deploys on every merge',
      'Configure alerts for error rate and latency, not just CPU',
    ],
    milestones: ['Containerised app', 'First IaC deployment', 'Pipelined releases'],
    checklist: ['Secrets in env vars', 'Rollback documented', 'Logs searchable', 'Cost alarm configured'],
  },
  startups: {
    name: 'Startup & product craft',
    focus: 'turning an idea into something people pay for',
    roadmap: [
      'Write a one-paragraph problem statement and name the exact customer',
      'Interview five people who have the problem before writing code',
      'Define a single activation metric and instrument it',
      'Ship the narrowest version that delivers one real outcome',
      'Run a weekly review: what did the metric do and why',
    ],
    milestones: ['Five interviews done', 'Activation metric live', 'First retained users'],
    checklist: ['Problem statement written', 'Interview notes stored', 'Metric instrumented', 'Weekly review scheduled'],
  },
  fintech: {
    name: 'Fintech engineering',
    focus: 'payments, compliance and money-safe systems',
    roadmap: [
      'Map how a local payment flow works end to end (gateway to settlement)',
      'Integrate one sandbox payment API and handle its failure modes',
      'Study the compliance basics: KYC, AML and data retention',
      'Design idempotent transaction handling and reconciliation',
      'Add audit logging for every money-moving action',
    ],
    milestones: ['Sandbox payment working', 'Idempotency implemented', 'Audit trail in place'],
    checklist: ['No secrets in code', 'Retry policy defined', 'Reconciliation job tested', 'Failure paths documented'],
  },
  cybersecurity: {
    name: 'Security engineering habits',
    focus: 'making the systems you build hostile to abuse',
    roadmap: [
      'Run a dependency and secret scan across your repositories',
      'Complete one guided web security module (OWASP Top 10)',
      'Add rate limiting, input validation and safe error messages to a project',
      'Practise reading auth flows: sessions, JWT, refresh rotation',
      'Write a short threat model for a service you maintain',
    ],
    milestones: ['Clean dependency scan', 'Threat model written', 'Hardening shipped'],
    checklist: ['Secrets rotated', 'Auth covered by tests', 'Headers hardened', 'Logs exclude sensitive data'],
  },
  'data engineering': {
    name: 'Data pipeline engineering',
    focus: 'getting data to the right place, reliably',
    roadmap: [
      'Model one raw source into clean, typed tables',
      'Add idempotent backfills so reruns never duplicate rows',
      'Build tests for uniqueness, nullability and referential integrity',
      'Schedule the pipeline with retries and alerting',
      'Document the contract each table promises to consumers',
    ],
    milestones: ['First clean table', 'Backfill-safe pipeline', 'Scheduled with alerts'],
    checklist: ['Schema documented', 'Tests in CI', 'Late data handled', 'Owner identified'],
  },
};

const GENERIC = (tag) => ({
  name: `${tag.charAt(0).toUpperCase()}${tag.slice(1)} skills`,
  focus: `practical ${tag} work showing up in this week's feed`,
  roadmap: [
    `Pick one ${tag} item from this week's feed and study it closely`,
    `Complete one hands-on ${tag} tutorial without skipping steps`,
    `Build a small project that demonstrates the core concept`,
    `Write up what you learned and what broke`,
    `Share it where Tunisian tech people will see it`,
  ],
  milestones: ['Concept understood', 'Small project finished', 'Write-up published'],
  checklist: ['Resource chosen', 'Project scoped', 'Code pushed', 'Summary written'],
});

function countTags(items) {
  const counts = new Map();
  for (const item of items) {
    for (const tag of item.tags ?? []) {
      const key = normalize(tag);
      if (!key) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return counts;
}

// Interest labels are free text ("AI & Machine Learning"), tags are short.
const INTEREST_TO_TAG = [
  [/ai|machine learning|python & ai|llm|agent/, 'ai'],
  [/data/, 'data engineering'],
  [/cloud|devops|kubernetes|aws|docker|terraform/, 'cloud'],
  [/startup|business|product|growth|founder/, 'startups'],
  [/fintech|payment|open banking/, 'fintech'],
  [/cyber|security|hacking|crypto(?!currency)/, 'cybersecurity'],
  [/ml|deep learning|vision|nlp/, 'ml'],
];

function candidateTags(profile, counts) {
  const picked = [];
  const seen = new Set();
  const push = (tag) => {
    if (!tag || seen.has(tag)) return;
    seen.add(tag);
    picked.push(tag);
  };

  // 1. Profile interests first — they are the strongest relevance signal.
  for (const interest of profile.interests ?? []) {
    const key = normalize(interest);
    if (!key) continue;
    if (counts.has(key)) push(key);
    for (const [pattern, tag] of INTEREST_TO_TAG) {
      if (pattern.test(key)) push(tag);
    }
  }

  // 2. Then the tags this week's items are actually about.
  for (const [tag] of [...counts.entries()].sort((a, b) => b[1] - a[1])) {
    push(tag);
  }

  return picked;
}

export function buildFallbackBrief(profile = {}, items = [], period = '') {
  const counts = countTags(items);
  const top = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([tag, mentions]) => ({ tag, mentions }));

  const skills = [];
  for (const tag of candidateTags(profile, counts)) {
    const template = PLAYBOOK[tag] ?? GENERIC(tag);
    const mentions = counts.get(tag) ?? 0;
    const matchedInterest = (profile.interests ?? []).find(
      (interest) => normalize(interest) === tag || template.name.toLowerCase().includes(normalize(interest)),
    );
    skills.push({
      name: template.name,
      why: matchedInterest
        ? `You listed "${matchedInterest}" and it appears in ${mentions || 'several'} item${mentions === 1 ? '' : 's'} this week.`
        : `It drives ${mentions} item${mentions === 1 ? '' : 's'} in this week's feed — a good moment to build ${template.focus}.`,
      interests: matchedInterest ? [matchedInterest] : [],
      sources: items.filter((item) => (item.tags ?? []).some((tagB) => normalize(tagB) === tag)).slice(0, 3).map((item) => item.id),
      roadmap: template.roadmap,
      milestones: template.milestones,
      checklist: template.checklist,
    });
    if (skills.length >= 5) break;
  }

  if (skills.length === 0) {
    skills.push({
      name: 'Consistent learning habit',
      why: 'No strong signal this week — a steady habit keeps options open.',
      interests: [],
      sources: [],
      roadmap: ['Block 30 minutes a day', 'Finish one tutorial module', 'Apply it to a small snippet', 'Note what confused you'],
      milestones: ['One module finished', 'One snippet written'],
      checklist: ['Calendar blocked', 'Module completed', 'Notes saved'],
    });
  }

  const occupation = profile.occupation ? ` for a ${profile.occupation}` : '';
  const headline = top.length > 0
    ? `This week${occupation}: ${top.slice(0, 3).map((entry) => entry.tag).join(', ')} dominate the Tunisian tech feed.`
    : `This week${occupation}: a steady stream of Tunisian tech news and events.`;

  return { period, headline, trends: top, skills };
}
