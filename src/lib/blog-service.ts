import { getDb } from '@/storage/database/db';
import { normalizeStoredArticle } from '@/lib/blog-article';
import {
  createArticleRecord,
  findArticleById,
  hasAnyArticles,
  insertInitialArticles,
  listArticles,
} from '@/storage/database/queries/app-queries';

// 初始文章数据
const initialArticles = [
  {
    title: '吵架之后的黄金30分钟',
    summary: '为什么有的人吵完架感情更好，有的人却越吵越凉？秘密就在这30分钟里...',
    content: `朋友们，今天咱们聊点严肃的——吵架。

别装了，我知道你们都吵过。那些说"我们从不吵架"的情侣，要么刚在一起三天，要么其中一方已经心如死灰了。

吵架不可怕，可怕的是吵完之后怎么办。

**黄金30分钟法则**

心理学研究表明，吵架后的30分钟是修复关系的黄金窗口期。为什么？因为这时候情绪还在，但理智已经开始回归。

错过这个窗口，会发生什么？

- 她会开始回忆你以前所有的错
- 你会开始觉得"凭什么都怪我"
- 两个人开始冷战，谁也不服谁
- 问题没解决，反而多了"你不爱我"这个新问题

**怎么把握这30分钟？**

第一步：先闭嘴。不是让你认输，是让你冷静。继续吵只会说出让你后悔的话。

第二步：递个台阶。不是低头认错，是让气氛缓和。比如倒杯水、递个水果、说句"我们都冷静一下"。

第三步：主动开口。注意，不是说"对不起我错了"（万一你没错呢？），而是说"我们聊聊这件事吧"。

第四步：先听后说。让对方把话说完，别打断。很多时候，她要的不是你认错，是被听到。

**最后提醒**

如果30分钟内你选择打游戏，那恭喜你，你会收获一个24小时起步的冷战。

别问我是怎么知道的。`,
    author: '恋爱教练小王',
    read_time: '3分钟',
    tags: '["吵架", "沟通技巧", "挽回"]',
  },
  {
    title: '为什么"你说得对"是最烂的回复',
    summary: '看似在认错，其实是在敷衍。这句话可能正在悄悄毁掉你们的关系...',
    content: `"你说得对。"

这四个字，堪称恋爱界的核武器——只不过炸的是自己。

你以为这是认错的态度？不，这是在火上浇油。

**为什么这句话这么烂？**

首先，它不是认错，是敷衍。

真正的认错是："我意识到我做得不对，因为..."
敷衍的认错是："你说得对"（潜台词：行行行你说的都对，赶紧翻篇吧）

女生对语言的敏感度是男生的十倍。你觉得自己是在给台阶，她听到的是"我不想跟你讲道理，你爱咋咋地"。

其次，它终结了沟通。

"你说得对"这句话一出，对方还能说什么？

继续讲道理？你已经"认"了。
说你不真诚？你都说她对了好吗。

所以她只能憋着。憋着憋着，就变成了更大的怨气。

**正确的做法是什么？**

方案A：如果你真觉得自己错了
"你说得有道理，我确实没想到这一点。以后我会注意。"
——具体、真诚、有行动承诺。

方案B：如果你觉得自己没错
"我理解你的感受，但我的想法是..."
——尊重对方，但也表达自己。

方案C：如果你实在不想争了
"咱们都冷静一下，晚点再聊。"
——至少真诚，不假装认同。

**最最后**

千万别说"你说的都对"。

这是"你说得对"的加强版，杀伤力翻倍，副作用是可能导致分手。

别怪我没提醒你。`,
    author: '恋爱教练小王',
    read_time: '4分钟',
    tags: '["沟通技巧", "道歉", "避坑指南"]',
  },
  {
    title: '道歉的正确打开方式',
    summary: '道歉是一门艺术，可惜很多人只会说"对不起"。学会这招，让你的道歉真正有效...',
    content: `问大家一个问题：道歉的目的是什么？

A. 让对方别再生气
B. 让自己赶紧脱身
C. 修复关系、解决问题

如果你的答案是A或B，恭喜你，你的道歉基本无效。

**道歉的三大误区**

误区一：只说"对不起"
"对不起"是最廉价的三个字。为什么？因为它太容易说了，没有任何成本。

误区二：道歉之后加"但是"
"对不起，但是你也有错..."
这不是道歉，这是甩锅。

误区三：道歉之后没下文
嘴上说完就完了，该怎样还怎样。这种道歉还不如不说。

**有效道歉的四步法**

第一步：承认错误
"我意识到我错了，我不应该..."
——要具体，不能笼统。

第二步：表达理解
"我知道这让你感到..."
——站在对方角度，说出她的感受。

第三步：提出补救
"我会...来弥补这件事。"
——行动比语言更重要。

第四步：请求原谅
"你能原谅我吗？"
——给对方选择权，而不是要求翻篇。

**举个栗子**

错误示范：
"对不起，我错了，你别生气了好吗？"

正确示范：
"对不起，我不应该忘记我们的纪念日。我知道你期待了很久，肯定很失望。我已经重新订了明天晚上的餐厅，还准备了一个惊喜。你能原谅我吗？"

看出来区别了吗？

**最后**

道歉不是为了脱身，而是为了修复。

如果你的道歉只是为了让她别再吵你，那问题永远解决不了，下次还会爆发。

真诚的道歉 + 实际的行动 = 真正的原谅。

记住这个公式，祝你早日修成正果。`,
    author: '恋爱教练小王',
    read_time: '4分钟',
    tags: '["道歉", "沟通技巧", "挽回"]',
  },
];

// 初始化文章数据
export async function initArticles() {
  const db = getDb();

  // 如果已有数据，跳过初始化
  if (await hasAnyArticles(db)) {
    return { message: '数据已存在，跳过初始化', count: 0 };
  }

  const count = await insertInitialArticles(db, initialArticles);

  return { message: '初始化成功', count };
}

// 获取所有文章
export async function getAllArticles() {
  return (await listArticles(getDb())).map(article => normalizeStoredArticle(article));
}

// 根据 ID 获取文章详情
export async function getArticleById(id: number) {
  const article = await findArticleById(getDb(), id);

  return article ? normalizeStoredArticle(article) : null;
}

// 创建新文章
export async function createArticle(article: {
  title: string;
  summary: string;
  content: string;
  author?: string;
  read_time?: string;
  tags?: string;
}) {
  const data = await createArticleRecord(getDb(), article);

  if (!data) {
    throw new Error('创建文章失败: 未返回文章数据');
  }

  return data;
}
