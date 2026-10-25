/**
 * Rule-based Chinese draft generator.
 *
 *   This is deliberately NOT an LLM call: there is no API key in the build
 *   environment, and a draft that invents features would be worse than no draft.
 *   Everything below is assembled from facts we actually fetched — repo name,
 *   language, description, README headings, README length, topics, and install
 *   commands that literally appear in a fenced code block.
 *
 *   Output is always marked `（机器草稿，待人工改写）` and lands in a `draft` record,
 *   which the build refuses to publish. A human must replace it after reading the
 *   README — that is the review step the site promises.
 *
 * Optional AI: set AI_BASE_URL / AI_API_KEY / AI_MODEL and pass `--ai` to
 * `data:import`; the key stays in the maintainer's environment (never in the
 * browser, never in data files). Without it, this deterministic draft is used.
 */

const CN_TOPIC = {
  ai: 'AI',
  llm: '大语言模型',
  'self-hosted': '自托管',
  docker: 'Docker',
  cli: '命令行',
  api: 'API',
  'developer-tools': '开发者工具',
  productivity: '效率',
  visualization: '可视化',
  'data-visualization': '数据可视化',
  design: '设计',
  learning: '学习',
  hardware: '硬件',
  web3: 'Web3',
  ethereum: '以太坊',
  wallet: '钱包',
  bookmark: '书签',
  'bookmark-manager': '书签管理',
  photography: '照片',
  privacy: '隐私',
  rust: 'Rust',
  python: 'Python',
  typescript: 'TypeScript',
  go: 'Go',
  react: 'React',
  vue: 'Vue',
};

export function translateTopics(topics = []) {
  return topics
    .map((t) => CN_TOPIC[t] || null)
    .filter(Boolean)
    .slice(0, 4);
}

export function extractInstallCommands(readmeText = '', limit = 3) {
  const blocks = [...String(readmeText).matchAll(/```(?:bash|sh|shell|console|zsh)?\n([\s\S]*?)```/g)].map((m) => m[1]);
  const commands = [];
  for (const block of blocks) {
    for (const raw of block.split('\n')) {
      // keep inline comments out of the step text, but don't drop the command
      const line = raw.trim().replace(/^\$\s*/, '').split(/\s{2,}#/)[0].trim();
      if (!line || line.startsWith('#')) continue;
      if (/^(npm|pnpm|yarn|pip|pipx|uv|uvx|docker|brew|curl|winget|scoop|npx|cargo|go install|git clone)\b/.test(line)) {
        if (!commands.includes(line) && line.length < 140) commands.push(line);
      }
      if (commands.length >= limit) return commands;
    }
  }
  return commands;
}

function cleanDescription(desc) {
  if (!desc) return null;
  return String(desc)
    .replace(/:[a-z0-9_+-]+:/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

const NOISE_HEADING = /^(table of contents|contents|testimonials|installation|install|getting started|quick ?start|usage|license|licence|contributing|contributors|credits|acknowledg(e)?ments?|sponsors?|funding|changelog|releases?|roadmap|faq|community|support|star history|security|code of conduct|links?|documentation|docs|about|why .*|features?|configuration|config|settings|options|requirements?|prerequisites?|rules|examples?|screenshots?|demo|benchmarks?|tests?|testing|development|setup|build(ing)?|deploy(ment)?|publish(ing)?)$/i;

/** "With uv.", "On macOS and Linux.", "Step 1" — install instructions, not capabilities. */
const SUBHEADING = /^(with|on|via|using|for|from|in|at|step|option)\b/i;

function isCapabilityHeading(h) {
  const plain = h.replace(/[*_`]/g, '').replace(/[^\p{L}\p{N} .-]/gu, '').trim();
  if (plain.length < 2 || plain.length > 36) return false;
  if (/[.。:]$/.test(plain)) return false;
  if (/^[\d.\s]+$/.test(plain)) return false;
  if (SUBHEADING.test(plain)) return false;
  if (NOISE_HEADING.test(plain)) return false;
  return true;
}

/**
 * @param {{ slug: string, name: string, record: any, readme?: { chars: number, headings: string[], excerpt: string|null }, readmeText?: string, mode?: 'draft'|'auto' }} input
 */
export function buildChineseDraft({ slug, name, record, readme, readmeText, mode = 'draft' }) {
  // Two readers: an editor opening a draft, and the unattended pipeline that
  // publishes straight to the site. Both must say plainly that this is not human copy.
  const auto = mode === 'auto';
  const stamp = auto ? '（自动整理，未经人工校对）' : '（机器草稿，待人工改写）';
  const noteTag = auto ? '（自动整理）' : '（机器草稿）';
  const desc = cleanDescription(record?.description);
  const lang = record?.language || '未知语言';
  const topics = translateTopics(record?.topics || []);
  const allHeadings = (readme?.headings || []).filter((h) => h.length > 1 && h.length < 40);
  // Prefer headings that describe capability, not boilerplate sections or install options.
  const headings = [...new Set(allHeadings.filter(isCapabilityHeading))];
  const commands = extractInstallCommands(readmeText || '');
  const chars = readme?.chars || 0;
  const descSentence = desc ? `仓库自述「${desc.replace(/[.。]$/, '')}」。` : '仓库没有提供一句话描述，需人工补充。';
  const langSentence = record?.language ? `是一个用 ${lang} 写的开源项目。` : '是一个开源项目（主要语言未取到）。';

  const summary = [
    `${stamp}${name} ${langSentence}`,
    descSentence,
    chars
      ? `已抓取 README 约 ${chars.toLocaleString('en-US')} 字；其中有${headings.length ? `「${headings.slice(0, 5).join('」「')}」等章节` : '若干章节'}可对应到具体能力。`
      : '未能读取 README，摘要只能依据仓库元信息。',
    topics.length ? `仓库 Topics 涉及：${topics.join('、')}。` : '',
    auto
      ? '自动整理只复述 README 能核实的内容，没有推测功能，也没有补充未取得的数据。'
      : '以上均为可核实的抓取结果；具体功能、适用人群与使用门槛请编辑阅读 README 后补全。',
  ]
    .filter(Boolean)
    .join('');

  const features = (headings.filter((h) => h.toLowerCase() !== String(name).toLowerCase()).length
    ? headings.filter((h) => h.toLowerCase() !== String(name).toLowerCase())
    : ['待补全功能一', '待补全功能二', '待补全功能三']
  )
    .slice(0, 4)
    .map((h) => ({
      title: h.replace(/^[^\p{L}\p{N}]+/u, '').slice(0, 24) || '待补全',
      detail: `${noteTag}README 中有「${h}」章节，此处只标注来源，未展开复述。`,
    }));
  while (features.length < 3) features.push({ title: '待补全', detail: `${noteTag}请依据 README 补全。` });

  const steps = commands.length
    ? commands.map((c, i) => ({ title: i === 0 ? '安装 / 运行' : `第 ${i + 1} 步`, detail: `README 中给出的命令：${c}` }))
    : [{ title: '阅读安装章节', detail: `${noteTag}README 未提供可识别的安装命令。` }];

  return {
    summary,
    tagline: desc ? desc.slice(0, 48) : '（待补全）一句话介绍',
    features,
    audienceFor: auto
      ? ['想找一个能跑起来的新工具的人（自动收录，未细分人群）', '愿意自己读 README 确认细节的开发者']
      : ['（机器草稿）请写明第一类适合的人', '（机器草稿）请写明第二类适合的人'],
    setup: {
      requires: [],
      steps,
      effortNote: auto ? '门槛未评估：请以 README 的安装说明为准' : '（机器草稿）请按真实上手成本改写',
    },
    contentBasis: chars
      ? `${auto ? '自动整理' : '机器草稿'}：依据 GitHub API 元信息与 README（${readme?.path || 'README'}，约 ${chars} 字，抓取于 ${record?.fetchedAt?.slice(0, 10) || '未知日期'}）汇总；${auto ? '未经人工校对，页面上已标注「自动收录」。' : '尚未人工改写，不应发布。'}`
      : `${auto ? '自动整理' : '机器草稿'}：仅依据 GitHub API 元信息（${record?.fetchedAt?.slice(0, 10) || '未知日期'}）；README 未读取成功。`,
    suggestedTopics: topics,
    installCommands: commands,
    slug,
  };
}

/** A short, honest tagline for the automatic lane: category + the repo's own words. */
export function autoTagline(categoryName, record) {
  const desc = cleanDescription(record?.description) || '';
  const hasCjk = /[\u4e00-\u9fa5]/.test(desc);
  if (!desc) return `${categoryName}方向的开源项目`;
  const short = desc.length > 46 ? `${desc.slice(0, 45).trimEnd()}…` : desc;
  return hasCjk ? short : `${categoryName} · ${short}`;
}
