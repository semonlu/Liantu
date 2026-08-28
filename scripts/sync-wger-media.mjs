import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const outputDir = path.join(root, "public", "exercises", "wger");
const manifestPath = path.join(root, "Training-Nutrition-KB", "exercise-media.json");

const exercises = [
  ["leg_press", 371, "leg-press"],
  ["bench", 73, "bench-press"],
  ["lat_pulldown", 1127, "lat-pulldown"],
  ["leg_curl", 366, "leg-curl"],
  ["cable_row", 1117, "cable-row"],
  ["leg_extension", 369, "leg-extension"],
  ["chest_fly", 926, "chest-fly"],
  ["triceps", 1185, "triceps-pushdown"],
  ["squat", 203, "goblet-squat"],
  ["body_squat", 1312, "bodyweight-squat"],
  ["pushup", 1551, "push-up"],
  ["row", 81, "dumbbell-row"],
  ["dead_bug", 2505, "dead-bug"],
  ["lunge", 999, "reverse-lunge"],
  ["plank", 458, "plank"],
  ["jumping_jack", 320, "jumping-jack"],
  ["mountain", 996, "mountain-climber"],
  ["bridge", 265, "glute-bridge"],
  ["bird_dog", 1572, "bird-dog"],
  ["rdl", 1652, "dumbbell-rdl"],
  ["press", 567, "shoulder-press"],
  ["swing", 960, "kettlebell-swing"],
  ["side_plank", 2509, "side-plank"],
];

const originalAssets = [
  ["body_squat", "/exercises/bodyweight-squat.png", "徒手深蹲"],
  ["dead_bug", "/exercises/dead-bug.png", "死虫式"],
  ["mountain", "/exercises/mountain-climber.png", "登山跑"],
  ["carry", "/exercises/farmers-walk.png", "农夫行走"],
  ["walk", "/exercises/treadmill-walk.png", "跑步机快走或轻松跑"],
];

const allowedLicense = /CC(?:-| )?(?:BY|0)|Creative Commons/i;

async function fetchJson(url) {
  const response = await fetch(url, { headers: { Accept: "application/json", "User-Agent": "Liantu/1.0 exercise-media-audit" } });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.json();
}

async function resolveLicense(data, asset) {
  let license = data.license;
  if (asset?.license && asset.license !== license?.id) {
    license = await fetchJson(`https://wger.de/api/v2/license/${asset.license}/`);
  }
  return license;
}

function extension(contentType, sourceUrl) {
  if (/png/i.test(contentType)) return ".png";
  if (/webp/i.test(contentType)) return ".webp";
  if (/jpe?g/i.test(contentType)) return ".jpg";
  const match = new URL(sourceUrl).pathname.match(/\.(png|webp|jpe?g)$/i);
  return match ? `.${match[1].toLowerCase().replace("jpeg", "jpg")}` : ".jpg";
}

fs.mkdirSync(outputDir, { recursive: true });
const records = [];

for (const [exerciseId, wgerId, baseName] of exercises) {
  try {
    const data = await fetchJson(`https://wger.de/api/v2/exerciseinfo/${wgerId}/`);
    const image = [...(data.images || [])].sort((a, b) => Number(Boolean(b.is_main)) - Number(Boolean(a.is_main)))[0];
    if (!image?.image) {
      records.push({ exerciseId, wgerId, status: "missing", reason: "no-image" });
      continue;
    }
    const license = await resolveLicense(data, image);
    if (!license?.short_name || !allowedLicense.test(`${license.short_name} ${license.url || ""}`)) {
      records.push({ exerciseId, wgerId, status: "excluded", reason: "license-not-confirmed", license: license?.short_name || "" });
      continue;
    }
    const response = await fetch(image.image, { headers: { "User-Agent": "Liantu/1.0 exercise-media-audit" } });
    if (!response.ok) throw new Error(`${response.status} ${image.image}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    const ext = extension(response.headers.get("content-type") || "", image.image);
    const filename = `${baseName}${ext}`;
    fs.writeFileSync(path.join(outputDir, filename), bytes);
    records.push({
      exerciseId,
      wgerId,
      status: "downloaded",
      localPath: `/exercises/wger/${filename}`,
      sourceUrl: image.image,
      author: image.license_author || data.license_author || "wger community",
      license: license.short_name,
      licenseUrl: license.url,
      retrievedAt: new Date().toISOString(),
    });
  } catch (error) {
    records.push({ exerciseId, wgerId, status: "error", reason: error instanceof Error ? error.message : String(error) });
  }
}

for (const [exerciseId, localPath, title] of originalAssets) {
  const file = path.join(root, "public", ...localPath.split("/").filter(Boolean));
  if (!fs.existsSync(file)) throw new Error(`缺少原创动作图：${file}`);
  const existing = records.findIndex((record) => record.exerciseId === exerciseId);
  const record = {
    exerciseId,
    status: "generated",
    localPath,
    title,
    author: "OpenAI image model / Liantu project",
    license: "Project original asset",
    licenseUrl: "",
    style: "grayscale anatomical figure with terracotta muscle highlights",
  };
  if (existing >= 0) records[existing] = record;
  else records.push(record);
}

fs.writeFileSync(manifestPath, `${JSON.stringify(records, null, 2)}\n`);
const downloaded = records.filter((item) => item.status === "downloaded").length;
const generated = records.filter((item) => item.status === "generated").length;
console.log(`exercise media audit: ${downloaded} downloaded + ${generated} generated; manifest=${manifestPath}`);
for (const item of records.filter((record) => !["downloaded", "generated"].includes(record.status))) console.log(item);
