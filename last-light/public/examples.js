// Only known, unchanged examples are localized. Player-written text is never translated.
export const examples = {
  "ocean": {
    "en": {
      "premise": "I’m a detective in an underwater city where everyone has forgotten yesterday. A letter arrives in my own handwriting, warning me not to trust the sunrise.",
      "protagonist": "A rookie detective who can hear echoes of lost memories",
      "details": "My partner is a nervous octopus. The city runs on bottled sunlight. Make the mystery hopeful, with no combat."
    },
    "zh-CN": {
      "premise": "我是一座海底城市的侦探，这里的每个人都忘记了昨天。一封信送到了我手中，笔迹竟然是我自己的，警告我不要相信日出。",
      "protagonist": "一名能听见失落记忆回声的新手侦探",
      "details": "我的搭档是一只紧张的章鱼。城市靠瓶装阳光运转。请让这段谜案充满希望，不包含战斗。"
    }
  },
  "space": {
    "en": {
      "premise": "I’m the last gardener on a spaceship carrying Earth’s final forest. One morning, the trees start growing star maps—and the ship changes course on its own.",
      "protagonist": "A young botanist who has never seen a real sunrise",
      "details": "My only companion is a maintenance robot that secretly writes poetry. Our choices should affect the forest and our friendship."
    },
    "zh-CN": {
      "premise": "我是一艘宇宙飞船上最后的园丁，船上载着地球最后一片森林。一天早晨，树木开始长出星图，飞船也自行改变了航向。",
      "protagonist": "一位从未见过真正日出的年轻植物学家",
      "details": "我唯一的伙伴是一个偷偷写诗的维修机器人。我们的选择应该影响森林，也影响我们的友谊。"
    }
  },
  "forest": {
    "en": {
      "premise": "I’ve inherited a tiny tea shop at the edge of an enchanted forest. My first customer is a dragon who has lost the ability to breathe fire, and the moon has gone missing.",
      "protagonist": "An apprentice tea maker with a very opinionated cat",
      "details": "A cozy adventure about helping strangers. Magic comes from small acts of kindness. No violence or horror."
    },
    "zh-CN": {
      "premise": "我继承了一间位于魔法森林边缘的小茶馆。第一位客人是一条失去喷火能力的龙，而月亮也不见了。",
      "protagonist": "一位养着很有主见的猫的学徒茶师",
      "details": "一段帮助陌生人的温馨冒险。魔法源于小小的善举。不包含暴力或恐怖内容。"
    }
  }
};

const defaultExamples = {
  "premise": {
    "en": "I’m a detective in an underwater city where everyone has forgotten yesterday. A letter arrives in my own handwriting…",
    "zh-CN": "我是一座海底城市的侦探，这里的每个人都忘记了昨天。一封信送到了我手中，笔迹竟然是我自己的……"
  },
  "protagonist": {
    "en": "A rookie detective who can hear people’s memories",
    "zh-CN": "一名能听见他人记忆的新手侦探"
  },
  "details": {
    "en": "My partner is a nervous octopus. The city runs on bottled sunlight. Keep the mystery hopeful, with no combat.",
    "zh-CN": "我的搭档是一只紧张的章鱼。城市靠瓶装阳光运转。让谜案充满希望，不包含战斗。"
  },
  "customMood": {
    "en": "Bittersweet and dreamlike, with quiet humor and a hopeful ending.",
    "zh-CN": "苦乐参半，如梦似幻，带着含蓄的幽默，以希望作结。"
  },
  "customArtStyle": {
    "en": "Hand-painted gouache, soft grain, warm amber and deep blue, expressive silhouettes.",
    "zh-CN": "手绘水粉，柔和颗粒感，温暖的琥珀色与深蓝色，富有表现力的剪影。"
  }
};

export function localizeExampleValue(field, value, language) {
  for (const example of Object.values(examples)) {
    if (value === example.en[field] || value === example['zh-CN'][field]) {
      return example[language]?.[field] ?? value;
    }
  }
  const fallback = defaultExamples[field];
  if (fallback && (value === fallback.en || value === fallback['zh-CN'])) return fallback[language] ?? value;
  return value;
}
