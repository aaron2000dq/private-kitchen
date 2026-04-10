import fs from "node:fs";
import path from "node:path";

const IMAGES_DIR = path.resolve(process.cwd(), "images");
const OUT_PATH = path.resolve(process.cwd(), "generated", "recipes.json");

function isImageFile(name) {
  const lower = name.toLowerCase();
  return (
    lower.endsWith(".jpg") ||
    lower.endsWith(".jpeg") ||
    lower.endsWith(".png") ||
    lower.endsWith(".webp")
  );
}

function stripExt(filename) {
  return filename.replace(/\.[^.]+$/, "");
}

function normalizeDishName(filenameNoExt) {
  // Support: 菜名_1 / 菜名-1 / 菜名 1
  return filenameNoExt.replace(/[\s_-]*\d+$/, "").trim();
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function pickCategory(name) {
  const n = name;
  if (/(汤|羹|蛋花汤|排骨汤|鸡汤|牛肉汤|鱼汤|粥)/.test(n)) return "汤羹";
  if (/(粥|饭|面|粉|河粉|米粉|拌面|汤面|煲仔饭|焖饭|烩饭|炒饭)/.test(n)) return "粥饭面";
  if (/(火锅|锅底|套餐)/.test(n)) return "火锅";
  if (/(烤|煎|炸|椒盐|香煎)/.test(n)) return "烧烤煎炸";
  if (/(炖|煲|焖|扣|卤|红烧|烧|煮)/.test(n)) return "炖煮";
  if (/(蒸|清蒸)/.test(n)) return "家常菜";
  if (/(甜|雪梨|冰糖|红枣|枸杞)/.test(n)) return "甜品饮品";
  if (/(虾|蟹|鱼|鲈鱼|鱿鱼|海鲜)/.test(n)) return "海鲜";
  return "家常菜";
}

function pickDifficulty(name) {
  if (/(火锅|套餐|烧鸡|扣肉|炖|煲|卤|猪蹄|牛腩)/.test(name)) return "hard";
  if (/(汤|煲|焖|烩|蒸)/.test(name)) return "medium";
  return "easy";
}

function pickTags(name, category) {
  const tags = new Set();
  if (/(辣|剁椒|麻辣|酸辣)/.test(name)) tags.add("微辣");
  if (/(酸菜|柠檬|番茄|醋)/.test(name)) tags.add("酸爽");
  if (/(清炒|清蒸|汤)/.test(name)) tags.add("清爽");
  if (/(下饭|烧肉|炒肉|扣肉|红烧)/.test(name)) tags.add("下饭");
  if (/(鸡翅|排骨|牛肉|牛腩|猪蹄|鸡)/.test(name)) tags.add("肉菜");
  if (/(豆腐|青菜|菠菜|生菜|空心菜|白菜|丝瓜|南瓜|菌菇)/.test(name)) tags.add("家常");
  if (category === "粥饭面") tags.add("主食");
  if (category === "炖煮") tags.add("慢炖");
  if (category === "汤羹") tags.add("热汤");
  if (category === "火锅") tags.add("聚餐");
  if (category === "烧烤煎炸") tags.add("香脆");
  if (category === "甜品饮品") tags.add("甜口");
  if (tags.size < 2) tags.add("快手");
  return Array.from(tags).slice(0, 6);
}

function buildDescription(name, category) {
  const base =
    category === "汤羹"
      ? "一碗热汤，慢慢回温。"
      : category === "粥饭面"
        ? "把日常的饱足感，做得更温柔。"
        : category === "炖煮"
          ? "小火慢慢收住味道，越煮越踏实。"
        : category === "火锅"
          ? "适合分享，也适合认真吃完。"
          : category === "甜品饮品"
            ? "甜一点，心就安定一点。"
            : "简单、踏实、耐吃。";
  return `${name}。${base}`;
}

function defaultIngredientGroups(name, category) {
  const commonAux = [
    { name: "食用油", amount: "适量" },
    { name: "盐", amount: "适量" },
    { name: "生抽", amount: "1-2汤匙" },
    { name: "蒜", amount: "2-3瓣", note: "切末" },
    { name: "葱", amount: "1根", note: "切段" },
  ];
  if (category === "汤羹") {
    return {
      mainIngredients: [{ name: "主食材", amount: "适量", note: "按菜名准备" }],
      auxiliaryIngredients: [
        { name: "清水/高汤", amount: "800ml" },
        { name: "姜", amount: "2-3片" },
        ...commonAux,
      ],
    };
  }
  if (category === "粥饭面") {
    return {
      mainIngredients: [{ name: "米/面/粉", amount: "2人份" }],
      auxiliaryIngredients: [{ name: "清水/高汤", amount: "适量" }, ...commonAux],
    };
  }
  if (category === "炖煮") {
    return {
      mainIngredients: [{ name: "主食材", amount: "500-800g", note: "按菜名准备" }],
      auxiliaryIngredients: [
        { name: "姜", amount: "3-4片" },
        { name: "料酒", amount: "1-2汤匙" },
        { name: "老抽", amount: "1/2汤匙", note: "可选" },
        { name: "冰糖/白糖", amount: "少许", note: "可选" },
        ...commonAux,
      ],
    };
  }
  if (category === "火锅") {
    return {
      mainIngredients: [{ name: "涮品", amount: "适量", note: "按喜好准备" }],
      auxiliaryIngredients: [
        { name: "火锅底料", amount: "适量" },
        { name: "清水", amount: "1.5L" },
        { name: "蘸料", amount: "适量" },
      ],
    };
  }
  if (category === "甜品饮品") {
    return {
      mainIngredients: [{ name: "主食材", amount: "适量", note: "按菜名" }],
      auxiliaryIngredients: [
        { name: "清水", amount: "1L" },
        { name: "冰糖/白糖", amount: "适量" },
      ],
    };
  }
  if (category === "海鲜") {
    return {
      mainIngredients: [{ name: "主海鲜食材", amount: "300-500g", note: "按菜名准备" }],
      auxiliaryIngredients: [{ name: "料酒", amount: "1汤匙" }, ...commonAux],
    };
  }
  return {
    mainIngredients: [{ name: "主食材", amount: "300-500g", note: "按菜名准备" }],
    auxiliaryIngredients: commonAux,
  };
}

function defaultSteps(category) {
  if (category === "汤羹") {
    return [
      { order: 1, content: "食材处理干净，切成适合入口的大小。" },
      { order: 2, content: "锅中加少许油，下姜蒜葱爆香。" },
      { order: 3, content: "加入主食材略炒，倒入清水/高汤。" },
      { order: 4, content: "大火煮开后转小火，煮至食材熟软。" },
      { order: 5, content: "用盐、生抽调味，出锅前撒葱花。" },
    ];
  }
  if (category === "粥饭面") {
    return [
      { order: 1, content: "主食按包装或习惯煮熟/焯熟备用。" },
      { order: 2, content: "锅中少许油，下蒜葱爆香。" },
      { order: 3, content: "加入配菜/肉类炒至变色，调入生抽与盐。" },
      { order: 4, content: "加入主食翻拌均匀，必要时加少量汤汁润滑。" },
      { order: 5, content: "出锅装盘，按口味加胡椒/香油。" },
    ];
  }
  if (category === "火锅") {
    return [
      { order: 1, content: "锅中加入清水与火锅底料，煮开后小火保持微沸。" },
      { order: 2, content: "荤素食材分别处理干净，切片/切块备用。" },
      { order: 3, content: "先下耐煮食材，后下易熟食材。" },
      { order: 4, content: "蘸料按喜好调配，边煮边吃。" },
      { order: 5, content: "最后可煮面/粉收尾。" },
    ];
  }
  if (category === "烧烤煎炸") {
    return [
      { order: 1, content: "主食材擦干表面水分，按需要切块或改刀。" },
      { order: 2, content: "用盐、生抽、蒜末腌制 10-20 分钟。" },
      { order: 3, content: "平底锅少油煎至两面金黄，或油温合适时下锅炸。" },
      { order: 4, content: "根据口味撒椒盐/孜然/辣椒粉，翻匀。" },
      { order: 5, content: "静置 1 分钟再食用，口感更稳。" },
    ];
  }
  if (category === "甜品饮品") {
    return [
      { order: 1, content: "食材清洗处理，按需要切块。" },
      { order: 2, content: "锅中加水煮开，转小火慢煮 20-40 分钟。" },
      { order: 3, content: "加入冰糖调味，继续煮至融化。" },
      { order: 4, content: "关火焖 10 分钟，让味道更融合。" },
      { order: 5, content: "温热或冷藏后食用。" },
    ];
  }
  if (category === "炖煮") {
    return [
      { order: 1, content: "食材处理干净；肉类可先焯水去浮沫。" },
      { order: 2, content: "锅中少许油，下姜蒜葱爆香。" },
      { order: 3, content: "下主食材翻炒，加入生抽/老抽上色。" },
      { order: 4, content: "加水没过食材，小火炖至软烂入味。" },
      { order: 5, content: "大火略收汁，调盐出锅。" },
    ];
  }
  return [
    { order: 1, content: "食材处理干净，肉类切片/切块，蔬菜洗净切段。" },
    { order: 2, content: "锅中少许油，下蒜葱爆香。" },
    { order: 3, content: "先下肉类炒至变色，再下蔬菜翻炒。" },
    { order: 4, content: "加入生抽与盐调味，必要时加少量清水焖 2-5 分钟。" },
    { order: 5, content: "收汁后出锅装盘。" },
  ];
}

function buildRecipeFromName(name, imageFiles) {
  const category = pickCategory(name);
  const difficulty = pickDifficulty(name);
  const { mainIngredients, auxiliaryIngredients } = defaultIngredientGroups(name, category);
  return {
    name,
    category,
    rating: 0,
    difficulty,
    tags: pickTags(name, category),
    description: buildDescription(name, category),
    mainIngredients,
    auxiliaryIngredients,
    steps: defaultSteps(category),
    images: imageFiles,
  };
}

async function main() {
  if (!fs.existsSync(IMAGES_DIR)) {
    console.error(`images folder not found: ${IMAGES_DIR}`);
    process.exit(1);
  }

  const names = fs.readdirSync(IMAGES_DIR).filter(isImageFile);
  if (names.length === 0) {
    console.error("No image files found in images/");
    process.exit(1);
  }

  const byDish = new Map();
  for (const filename of names) {
    const dish = normalizeDishName(stripExt(filename));
    if (!dish) continue;
    const arr = byDish.get(dish) ?? [];
    arr.push(filename);
    byDish.set(dish, arr);
  }

  const dishes = Array.from(byDish.entries())
    .map(([dish, files]) => ({
      dish,
      files: files.slice().sort((a, b) => a.localeCompare(b, "zh-CN")),
    }))
    .sort((a, b) => a.dish.localeCompare(b.dish, "zh-CN"));

  console.log(`Found ${names.length} images, grouped into ${dishes.length} dishes.`);

  const finalRecipes = dishes.map(({ dish, files }) =>
    buildRecipeFromName(dish, files),
  );

  // Make sure we have one recipe per dish and stable ordering.
  const out = { recipes: finalRecipes };

  fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2), "utf8");
  console.log(`Wrote ${finalRecipes.length} recipes to ${OUT_PATH}`);
}

await main();

