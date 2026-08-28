import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const kbRoot = path.join(root, "Training-Nutrition-KB");
const publicRoot = path.join(root, "public");
const requiredFields = ["id", "title", "evidence_level", "applicable_population", "sources", "rule_ids"];
const requiredSections = ["解决什么问题：", "不解决什么问题：", "适用人群：", "如何监测：", "证据等级：", "仍有哪些不确定性："];

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "sources" ? [] : walk(full);
    return entry.name.endsWith(".md") && !["SOURCE_MANIFEST.md","LICENSE_REPORT.md"].includes(entry.name) ? [full] : [];
  });
}

function parseFrontMatter(text, file) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!match) throw new Error(`${file}: 缺少 YAML front matter`);
  const meta = {};
  for (const line of match[1].split(/\r?\n/)) {
    const index = line.indexOf(":");
    if (index < 1) continue;
    const key = line.slice(0, index).trim();
    const raw = line.slice(index + 1).trim();
    meta[key] = ["sources", "rule_ids"].includes(key)
      ? raw.split(",").map((item) => item.trim()).filter(Boolean)
      : raw;
  }
  for (const field of requiredFields) {
    if (!meta[field] || (Array.isArray(meta[field]) && meta[field].length === 0)) {
      throw new Error(`${file}: front matter 缺少 ${field}`);
    }
  }
  return { meta, body: text.slice(match[0].length) };
}

const sources = JSON.parse(fs.readFileSync(path.join(kbRoot, "sources.json"), "utf8"));
const sourceMap = new Map(sources.map((source) => [source.id, source]));
for (const source of sources) {
  if (!source.license) throw new Error(`来源 ${source.id} 缺少许可证或使用说明`);
  if (!/^https:\/\//.test(source.url)) throw new Error(`来源 ${source.id} 地址无效`);
  if (source.localFile && !fs.existsSync(path.join(kbRoot, source.localFile))) {
    throw new Error(`来源 ${source.id} 的本地文件不存在: ${source.localFile}`);
  }
}

const cards = walk(kbRoot).map((file) => {
  const text = fs.readFileSync(file, "utf8");
  const { meta, body } = parseFrontMatter(text, path.relative(root, file));
  for (const section of requiredSections) {
    if (!body.includes(section)) throw new Error(`${meta.id}: 缺少必填段落 ${section}`);
  }
  for (const sourceId of meta.sources) {
    if (!sourceMap.has(sourceId)) throw new Error(`${meta.id}: 未知来源 ${sourceId}`);
  }
  return {
    ...meta,
    path: path.relative(root, file).replaceAll("\\", "/"),
    summary: body.match(/一句话结论：([^\r\n]+)/)?.[1]?.trim() ?? "",
    body,
  };
});

const cardMap = new Map(cards.map((card) => [card.id, card]));
const rules = JSON.parse(fs.readFileSync(path.join(kbRoot, "rules.json"), "utf8"));
const seenRuleIds = new Set();
for (const rule of rules) {
  if (seenRuleIds.has(rule.id)) throw new Error(`重复规则: ${rule.id}`);
  seenRuleIds.add(rule.id);
  if (!cardMap.has(rule.cardId)) throw new Error(`${rule.id}: 未知知识卡 ${rule.cardId}`);
  if (!rule.sourceIds?.length) throw new Error(`${rule.id}: 没有关联来源`);
  for (const sourceId of rule.sourceIds) {
    if (!sourceMap.has(sourceId)) throw new Error(`${rule.id}: 未知来源 ${sourceId}`);
    if (!cardMap.get(rule.cardId).sources.includes(sourceId)) {
      throw new Error(`${rule.id}: 来源 ${sourceId} 未声明在知识卡 ${rule.cardId}`);
    }
  }
  if (typeof rule.min === "number" && typeof rule.max === "number" && rule.min > rule.max) {
    throw new Error(`${rule.id}: 下限大于上限`);
  }
}
for (const card of cards) {
  for (const ruleId of card.rule_ids) {
    if (!seenRuleIds.has(ruleId)) throw new Error(`${card.id}: 规则 ${ruleId} 未定义`);
  }
}

fs.mkdirSync(publicRoot, { recursive: true });
fs.writeFileSync(path.join(publicRoot, "knowledge-index.json"), JSON.stringify({ generatedAt: new Date().toISOString(), sources, cards }, null, 2));
fs.writeFileSync(path.join(publicRoot, "training-rules.json"), JSON.stringify({ generatedAt: new Date().toISOString(), rules }, null, 2));
console.log(`知识库校验通过：${sources.length} 个来源，${cards.length} 张知识卡，${rules.length} 条规则。`);
