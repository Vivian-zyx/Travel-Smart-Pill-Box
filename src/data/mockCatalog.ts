export type CatalogItem = {
  id: string;
  scenario: string;
  name: string;
  property: string;
  manufacturer: string;
  summary: string;
  caution: string;
  sourceLabel: string;
  sourceUrl: string;
};

export const scenarios = [
  { id: 'cold', label: '感冒相关', icon: '🌬️', helper: '查看说明书收载的感冒类药品' },
  { id: 'stomach', label: '胃部不适', icon: '☕', helper: '按说明书用途浏览胃药目录' },
  { id: 'allergy', label: '过敏相关', icon: '🌿', helper: '包含口服与皮肤外用候选' },
  { id: 'motion', label: '晕车相关', icon: '🚌', helper: '查看晕动病相关药品目录' },
  { id: 'other', label: '其他', icon: '＋', helper: '手动记录你已决定携带的药品' },
];

export const medicationCatalog: CatalogItem[] = [
  {
    id: 'cold-ganmaoling',
    scenario: 'cold',
    name: '999 感冒灵颗粒',
    property: 'OTC · 复方制剂',
    manufacturer: '华润三九（枣庄）药业有限公司',
    summary: '说明书用途：用于感冒引起的头痛、发热、鼻塞、流涕、咽痛。',
    caution: '仅作目录展示。使用前核对包装成分、禁忌与特殊人群信息，避免与成分重复的同类药并用。',
    sourceLabel: '华润三九官方产品页',
    sourceUrl: 'https://www.999.com.cn/ProductIntro3/2023-12-15/496257.html',
  },
  {
    id: 'cold-ganmaoqingre',
    scenario: 'cold',
    name: '999 感冒清热颗粒',
    property: 'OTC · 中成药',
    manufacturer: '华润三九旗下生产企业',
    summary: '说明书用途：疏风散寒，解表清热；用于风寒感冒相关症状。',
    caution: '不同感冒药的说明书适用范围不同，不可只按“感冒”自行判断；请按实际包装说明书或咨询药师。',
    sourceLabel: '华润三九官方说明书页',
    sourceUrl: 'https://www.999.com.cn/gmqr/2023-12-06/488845.html',
  },
  {
    id: 'stomach-wei-tai',
    scenario: 'stomach',
    name: '三九胃泰颗粒',
    property: 'OTC · 中成药',
    manufacturer: '华润三九医药股份有限公司相关生产企业',
    summary: '说明书用途：用于说明书所列湿热内蕴、气滞血瘀相关胃痛及浅表性胃炎相应证候。',
    caution: '本目录不判断中医证候，也不替代诊断；请对照随盒说明书或咨询药师后决定是否携带。',
    sourceLabel: '华润三九官方产品页',
    sourceUrl: 'https://www.999.com.cn/wcxh/2023-12-08/490865.html',
  },
  {
    id: 'stomach-wenweishu',
    scenario: 'stomach',
    name: '999 温胃舒颗粒',
    property: 'OTC · 中成药',
    manufacturer: '华润三九旗下生产企业',
    summary: '说明书用途：温胃止痛；用于慢性胃炎及说明书所列胃脘凉痛等证候。',
    caution: '与其他胃药的适用证候并不相同，请核对说明书；持续或加重的不适应及时就医。',
    sourceLabel: '华润三九官方说明书页',
    sourceUrl: 'https://www.999.com.cn/wcxh/2023-12-06/488596.html',
  },
  {
    id: 'allergy-desloratadine',
    scenario: 'allergy',
    name: '地氯雷他定片（5mg）',
    property: '口服抗过敏药 · 购买属性以包装为准',
    manufacturer: '浙江华润三九众益制药有限公司',
    summary: '说明书用途：用于缓解慢性特发性荨麻疹及常年性过敏性鼻炎的相关症状。',
    caution: '剂型、适用年龄和禁忌以实际包装说明书为准；本目录不判断具体过敏原因。',
    sourceLabel: '华润三九众益官方产品页',
    sourceUrl: 'https://www.999.com.cn/hrsjzy_ProductIntro/2023-12-04/487206.html',
  },
  {
    id: 'allergy-piyanping',
    scenario: 'allergy',
    name: '999 皮炎平（复方醋酸地塞米松乳膏）',
    property: 'OTC · 皮肤外用',
    manufacturer: '华润三九医药股份有限公司相关生产企业',
    summary: '说明书用途：用于局限性瘙痒症及说明书所列多类皮炎、慢性湿疹。',
    caution: '仅供外用；避免接触眼睛和黏膜，不宜大面积、长期使用，具体按随盒说明书执行。',
    sourceLabel: '华润三九官方产品页',
    sourceUrl: 'https://www.999.com.cn/pfoutsideuse/2023-12-06/488600.html',
  },
  {
    id: 'motion-dimenhydrinate',
    scenario: 'motion',
    name: '茶苯海明片（50mg）',
    property: 'OTC 甲类 · 抗晕动病',
    manufacturer: '北京益民药业有限公司',
    summary: '说明书用途：用于防治晕动病，如晕车、晕船、晕机所致的恶心、呕吐。',
    caution: '可能引起嗜睡、注意力不集中等；服药期间不得驾驶或操作机械，并应核对饮酒及合并用药限制。',
    sourceLabel: '北京市药监局药品信息页',
    sourceUrl: 'https://xxcx.yjj.beijing.gov.cn/eportal/ui?artileId=4164774570c94b06aeb980d548f3c55a&pageId=723944',
  },
  {
    id: 'motion-phenyclidine',
    scenario: 'motion',
    name: '飞赛乐（盐酸苯环壬酯片）',
    property: '晕动病用药 · 购买属性以包装为准',
    manufacturer: '北京华素制药股份有限公司',
    summary: '企业产品目录收载的晕动病相关药品，具体适应症以随盒说明书为准。',
    caution: '使用前应核对禁忌、特殊人群、驾驶和合并用药限制；不根据场景自动推荐。',
    sourceLabel: '北京华素官方产品页',
    sourceUrl: 'https://www.sihuan.com.cn/?a=view&p=30&r=15',
  },
];
