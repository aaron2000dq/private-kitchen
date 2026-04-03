/** 基于公历月日的简易北半球（中国）时令文案，供首页与推荐提示使用 */

export function formatTodayZh(d: Date = new Date()): string {
  const w = ["日", "一", "二", "三", "四", "五", "六"][d.getDay()];
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 · 星期${w}`;
}

/** month: 1–12 */
export function getSeasonName(month1to12: number): "春" | "夏" | "秋" | "冬" {
  if (month1to12 >= 3 && month1to12 <= 5) return "春";
  if (month1to12 >= 6 && month1to12 <= 8) return "夏";
  if (month1to12 >= 9 && month1to12 <= 11) return "秋";
  return "冬";
}

/** 近期时令：节气附近略提，其余按季 + 常见鲜物 */
export function getSeasonalIntro(d: Date = new Date()): string {
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const season = getSeasonName(m);

  // 粗略节气窗口（公历近似）
  if (m === 4 && day >= 4 && day <= 6) {
    return "清明前后，艾草青团、春笋、河鲜正当时；宜清淡少腻，配一碗热汤暖胃。";
  }
  if (m === 6 && day >= 5 && day <= 7) {
    return "芒种前后，新麦与瓜果渐多；天热宜补水，汤羹与凉拌菜可多些。";
  }
  if ((m === 12 && day >= 21) || (m === 1 && day <= 5)) {
    return "冬至前后，适合温补与一锅炖；根茎类、羊肉、菌菇都很应景。";
  }

  if (season === "春") {
    return "仲春至暮春，笋、豆苗、荠菜、河鲜陆续上市；宜鲜、宜嫩，少油更顺口。";
  }
  if (season === "夏") {
    return "暑气渐盛，瓜茄、绿豆、莲子、苦瓜清润解暑；汤粥面也适合做得清爽些。";
  }
  if (season === "秋") {
    return "秋燥渐显，梨、藕、山药、菌菇润燥养人；炖煮与蒸菜都很合拍。";
  }
  return "天寒宜暖，萝卜、白菜、根茎与一锅炖最踏实；汤羹暖胃，慢慢吃。";
}

export function seasonHintForPrompt(d: Date): string {
  const season = getSeasonName(d.getMonth() + 1);
  const intro = getSeasonalIntro(d);
  return `节气/时令参考（${d.toISOString().slice(0, 10)}）：${season}季。${intro}`;
}
