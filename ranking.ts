import { FediverseEvent } from "./fediverse";

export type Weights = Readonly<{
  botPenalty: number;
  sensitivePenalty: number;
  languagePenalty: number;
  reblog: number;
  favourite: number;
  follower: number;
  follows: number;
  status: number;
  reply: number;
  isVerified: number;
  isTrendy: number;
  isReblog: number;
}>;

export type TrendsMap = Readonly<Record<string, true>>;

// TODO: retrospection

export const ranking =
  (
    {
      botPenalty,
      sensitivePenalty,
      languagePenalty,
      favourite,
      reblog,
      follower,
      follows,
      reply,
      status,
      isVerified,
      isTrendy,
      isReblog,
    }: Weights,
    limits: readonly number[],
    myLanguages: readonly string[]
  ) =>
  (
    {
      favourites_count,
      reblogs_count,
      replies_count,
      sensitive,
      tags,
      reblog,
      language,
      account: {
        followers_count,
        following_count,
        statuses_count,
        bot,
        fields,
      },
    }: FediverseEvent,
    trends: TrendsMap
  ): number => {
    for (const limit in limits) {
      const botMod = bot ? botPenalty : 1;
      const languageMod = myLanguages.some((lang) => lang === language)
        ? 1
        : languagePenalty;
      const sensitiveMod = sensitive ? sensitivePenalty : 1;
      const verifiedMod = fields.some(({ verified_at }) => verified_at != null)
        ? isVerified
        : 1;
      const trendMod = tags.some(({ name }) => name.toLowerCase() in trends)
        ? isTrendy
        : 1;
      const reblogMod = reblog == null ? 1 : isReblog;

      const weight =
        (favourites_count * favourite +
          reblogs_count * isReblog +
          followers_count * follower +
          following_count * follows +
          replies_count * reply +
          statuses_count * status) *
        botMod *
        languageMod *
        sensitiveMod *
        verifiedMod *
        trendMod *
        reblogMod;

      if (weight >= limits[limit]) return Number(limit) + 1;
    }

    return NaN;
  };
