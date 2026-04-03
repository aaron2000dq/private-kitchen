import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const INPUT = path.join(ROOT, "generated", "recipes.json");

function hash32(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pick(arr, h, salt = 0) {
  if (!arr.length) return "";
  const idx = (h + salt) % arr.length;
  return arr[idx];
}

function hasAny(name, list) {
  return list.find((x) => name.includes(x)) ?? "";
}

function detectMethod(name) {
  const methods = [
    ["红烧", "红烧"],
    ["糖醋", "糖醋"],
    ["清蒸", "清蒸"],
    ["蒸", "清蒸"],
    ["爆炒", "爆炒"],
    ["小炒", "小炒"],
    ["快炒", "快炒"],
    ["炒", "家常快炒"],
    ["炖", "慢炖"],
    ["煲", "煲"],
    ["煲仔", "煲仔"],
    ["焖", "焖"],
    ["卤", "卤"],
    ["凉拌", "凉拌"],
    ["拌", "拌"],
    ["烤", "烤"],
    ["炸", "炸"],
    ["煎", "香煎"],
    ["焗", "焗"],
    ["意面", "意面"],
    ["沙拉", "沙拉"],
    ["汤", "汤"],
    ["羹", "羹"],
    ["火锅", "火锅"],
  ];
  for (const [k, v] of methods) {
    if (name.includes(k)) return v;
  }
  return "";
}

function detectMain(name) {
  const mains = [
    "鸡翅",
    "鸡腿",
    "鸡",
    "牛腩",
    "牛肉",
    "肥牛",
    "排骨",
    "猪蹄",
    "五花肉",
    "猪肉",
    "鸭",
    "虾",
    "蟹",
    "鱼",
    "鲈鱼",
    "鱿鱼",
    "贝",
    "豆腐",
    "茄子",
    "土豆",
    "番茄",
    "白菜",
    "青菜",
    "菌菇",
    "西兰花",
    "面",
    "粉",
    "粥",
    "饭",
  ];
  return hasAny(name, mains);
}

function detectTaste(name) {
  const tastes = [
    ["麻辣", "麻辣"],
    ["香辣", "香辣"],
    ["辣", "微辣"],
    ["酸菜", "酸爽"],
    ["酸", "酸香"],
    ["甜", "微甜"],
    ["椒盐", "椒盐香"],
    ["黑椒", "黑椒香"],
    ["蒜", "蒜香"],
    ["葱", "葱香"],
    ["姜", "姜香"],
    ["咖喱", "咖喱香"],
    ["奶油", "奶香"],
    ["芝士", "芝士香"],
    ["番茄", "番茄酸甜"],
    ["酱", "酱香"],
    ["咸蛋黄", "咸香起沙"],
    ["蛋黄", "咸香起沙"],
  ];
  for (const [k, v] of tastes) {
    if (name.includes(k)) return v;
  }
  return "";
}

function buildDescription(r) {
  const name = String(r.name ?? "").trim();
  if (!name) return "";
  const h = hash32(name);

  const method = detectMethod(name);
  const main = detectMain(name);
  const taste = detectTaste(name);

  const openers = [
    "一口下去就很踏实，",
    "这道菜很适合放进常做清单，",
    "做法不复杂但很耐吃，",
    "味道收得干净利落，",
    "热热上桌最舒服，",
    "属于“越吃越顺口”的那类，",
  ];
  const scenes = [
    "下班回家快速搞定。",
    "配一碗白米饭刚好。",
    "周末慢慢做更有成就感。",
    "适合多做一点当作第二天便当。",
    "当作一顿正餐的主角也稳。",
    "天气转凉时尤其合适。",
  ];
  const endings = [
    "口味可以按你习惯再调一点咸淡辣度。",
    "如果想更清爽，油量收一点会更顺口。",
    "想更下饭就把酱汁收浓一点。",
    "搭配一份清爽蔬菜会更均衡。",
    "把火候掌握好，香气会更立体。",
    "做完厨房也不会太狼狈。",
  ];

  const coreBits = [];
  if (method) coreBits.push(`主打${method}`);
  if (taste) coreBits.push(taste);
  if (main) coreBits.push(`以${main}为主`);

  const core =
    coreBits.length > 0
      ? `（${coreBits.slice(0, 3).join("，")}）`
      : "";

  const s1 = `${pick(openers, h)}${name}${core}，味型偏${taste || "家常"}。`;
  const s2 = `${pick(scenes, h, 7)}${pick(endings, h, 13)}`;

  // Avoid awkward duplication like “番茄…味型偏番茄酸甜”
  const cleaned = `${s1} ${s2}`
    .replace(/味型偏家常。/g, "味型偏家常。")
    .replace(/，味型偏家常。/g, "，整体很家常。");
  return cleaned.trim();
}

function isGenericDescription(desc) {
  if (!desc) return true;
  const s = String(desc).trim();
  if (!s) return true;
  if (s === "按常规做法处理食材并烹饪至熟。") return true;
  if (s.includes("后续可补充")) return true;
  return false;
}

const raw = fs.readFileSync(INPUT, "utf8");
const data = JSON.parse(raw);
const recipes = Array.isArray(data?.recipes) ? data.recipes : [];

let changed = 0;
for (const r of recipes) {
  const desc = String(r.description ?? "");
  if (isGenericDescription(desc)) {
    r.description = buildDescription(r);
    changed++;
  }
}

fs.writeFileSync(INPUT, JSON.stringify({ ...data, recipes }, null, 2) + "\n", "utf8");
console.log(`updated descriptions: ${changed}/${recipes.length}`);

