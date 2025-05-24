/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as analytics_blockchainExplorers from "../analytics/blockchainExplorers.js";
import type * as analytics_cache from "../analytics/cache.js";
import type * as analytics_coingecko from "../analytics/coingecko.js";
import type * as analytics_geckoterminal from "../analytics/geckoterminal.js";
import type * as analytics_rateLimiter from "../analytics/rateLimiter.js";
import type * as analytics from "../analytics.js";
import type * as auth from "../auth.js";
import type * as blockchain_ethereum from "../blockchain/ethereum.js";
import type * as blockchain_solana from "../blockchain/solana.js";
import type * as blockchain from "../blockchain.js";
import type * as crons from "../crons.js";
import type * as http from "../http.js";
import type * as memeCoins from "../memeCoins.js";
import type * as router from "../router.js";
import type * as social_discord from "../social/discord.js";
import type * as social_formatter from "../social/formatter.js";
import type * as social_telegram from "../social/telegram.js";
import type * as social_twitter from "../social/twitter.js";
import type * as social_utils from "../social/utils.js";
import type * as social from "../social.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  "analytics/blockchainExplorers": typeof analytics_blockchainExplorers;
  "analytics/cache": typeof analytics_cache;
  "analytics/coingecko": typeof analytics_coingecko;
  "analytics/geckoterminal": typeof analytics_geckoterminal;
  "analytics/rateLimiter": typeof analytics_rateLimiter;
  analytics: typeof analytics;
  auth: typeof auth;
  "blockchain/ethereum": typeof blockchain_ethereum;
  "blockchain/solana": typeof blockchain_solana;
  blockchain: typeof blockchain;
  crons: typeof crons;
  http: typeof http;
  memeCoins: typeof memeCoins;
  router: typeof router;
  "social/discord": typeof social_discord;
  "social/formatter": typeof social_formatter;
  "social/telegram": typeof social_telegram;
  "social/twitter": typeof social_twitter;
  "social/utils": typeof social_utils;
  social: typeof social;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
