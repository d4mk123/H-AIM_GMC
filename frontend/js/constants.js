/* ══════════════════════════════════════════════════════════════════
   1. CONFIG & STATIC DATA
   ══════════════════════════════════════════════════════════════════ */

const INTEREST_OPTIONS = [
  "AI & Machine Learning",
  "Cloud & DevOps",
  "Web Development",
  "Mobile Apps",
  "Data Science & Big Data",
  "Cybersecurity",
  "Blockchain & Web3",
  "IoT & Robotics",
  "Startups & Business",
  "UI/UX Design",
  "Fintech",
  "Open Source",
  "Backend Engineering",
  "Frontend Engineering",
  "APIs & Microservices",
  "Python & AI Tools"
];

const INTEREST_RECOMMENDATIONS = {
  "UI/UX Design": [
    "Figma", "Adobe Illustrator", "Photoshop", "Wireframing", "Design Systems", "Prototyping"
  ],
  "AI & Machine Learning": [
    "PyTorch", "TensorFlow", "LLMs & Prompt Eng", "Computer Vision", "NLP & Transformers", "Hugging Face"
  ],
  "Web Development": [
    "React", "Next.js", "Vue.js", "Node.js", "TypeScript", "Tailwind CSS", "HTML5 & CSS3"
  ],
  "Cloud & DevOps": [
    "AWS", "Docker", "Kubernetes", "CI/CD Pipelines", "Terraform", "Linux & Bash", "GCP / Azure"
  ],
  "Mobile Apps": [
    "Flutter", "React Native", "Swift & iOS", "Kotlin & Android", "Mobile UI", "Expo"
  ],
  "Data Science & Big Data": [
    "Pandas & NumPy", "SQL & Database Design", "Data Visualization", "Tableau / Power BI", "Apache Spark", "ETL Pipelines"
  ],
  "Cybersecurity": [
    "Ethical Hacking", "Network Defense", "Penetration Testing", "Security Auditing", "Cryptography", "SOC Analysis"
  ],
  "Blockchain & Web3": [
    "Solidity", "Smart Contracts", "Ethereum & EVM", "DeFi Protocols", "Web3.js / Ethers.js"
  ],
  "IoT & Robotics": [
    "Arduino", "Raspberry Pi", "ROS (Robot Operating System)", "Sensor Networks", "Embedded C/C++"
  ],
  "Startups & Business": [
    "Product Management", "Growth Hacking", "Pitching & Fundraising", "Lean Startup", "SaaS Business Models"
  ],
  "Fintech": [
    "Payment Gateways (Stripe/Flouci)", "Algorithmic Trading", "Open Banking APIs", "Financial Compliance"
  ],
  "Open Source": [
    "Git & GitHub Workflows", "Contributing to OSS", "Documentation Writing", "Community Management"
  ],
  "Backend Engineering": [
    "PostgreSQL", "Redis & Caching", "GraphQL", "Microservices", "REST APIs", "Go / Golang", "Django / FastAPI"
  ],
  "Frontend Engineering": [
    "Modern JavaScript", "Component Architecture", "CSS Animations", "Web Performance", "State Management"
  ],
  "APIs & Microservices": [
    "API Gateway", "gRPC", "Message Queues (RabbitMQ/Kafka)", "Postman & OpenAPI", "Auth & JWT"
  ],
  "Python & AI Tools": [
    "LangChain", "LlamaIndex", "Jupyter Notebooks", "FastAPI", "Automation & Scripting"
  ]
};

const TUNISIAN_SQUADS = [
  { id: "all", name: "All Ecosystem", icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`, members: "12.4k", tag: "all" },
  { id: "squad-ai", name: "Tunisia AI Builders", icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a4 4 0 0 0-4 4v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2h-2V6a4 4 0 0 0-4-4z"/><circle cx="12" cy="15" r="2"/></svg>`, members: "4.8k", tag: "AI" },
  { id: "squad-cloud", name: "Cloud & DevOps TN", icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>`, members: "3.2k", tag: "cloud" },
  { id: "squad-jobs", name: "Junior Devs & Interns", icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>`, members: "6.1k", tag: "internship" },
  { id: "squad-startups", name: "Tunis Founders & VCs", icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`, members: "2.9k", tag: "startups" },
  { id: "squad-cyber", name: "CyberSec Carthage", icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`, members: "1.7k", tag: "cybersecurity" }
];

const TRENDING_TOPICS = [
  { tag: "#AI_Strategy_2030", count: "1.4k reads", delta: "+48%" },
  { tag: "#InstaDeep_ESA", count: "980 reads", delta: "+35%" },
  { tag: "#ESPRIT_AWS", count: "820 reads", delta: "+29%" },
  { tag: "#DevFest_Hammamet", count: "640 reads", delta: "+22%" },
  { tag: "#StartupAct2", count: "510 reads", delta: "+15%" }
];

/* Helpers */
const $ = (sel) => document.querySelector(sel); const $$ = (sel) => document.querySelectorAll(sel);

function formatDate(dateStr) {
  if (!dateStr) return "Recent";
  const raw = String(dateStr).trim();
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  }
  // Seed news dates are truncated RFC-822 strings ("Thu, 24 Se"), which yield an
  // Invalid Date. Recover day + month instead of rendering "Invalid Date".
  const partial = raw.match(/^[A-Za-z]{3},\s*(\d{1,2})\s+([A-Za-z]{2})/);
  if (partial) {
    const MONTHS = { Ja: "Jan", Fe: "Feb", Ma: "Mar", Ap: "Apr", Au: "Aug", Se: "Sep", Oc: "Oct", No: "Nov", De: "Dec" };
    const month = MONTHS[partial[2]] || partial[2]; // "Ju" stays "Ju" (Jun/Jul ambiguous)
    return `${Number(partial[1])} ${month}`;
  }
  return raw;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}