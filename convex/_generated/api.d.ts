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
import type * as analytics_blockchainData from "../analytics/blockchainData.js";
import type * as analytics_blockchainExplorers from "../analytics/blockchainExplorers.js";
import type * as analytics_cache from "../analytics/cache.js";
import type * as analytics_coingecko from "../analytics/coingecko.js";
import type * as analytics_geckoterminal from "../analytics/geckoterminal.js";
import type * as analytics_rateLimiter from "../analytics/rateLimiter.js";
import type * as analytics from "../analytics.js";
import type * as auth from "../auth.js";
import type * as autoLiquidity from "../autoLiquidity.js";
import type * as blockchain_bondingCurveIntegration from "../blockchain/bondingCurveIntegration.js";
import type * as blockchain_contractData from "../blockchain/contractData.js";
import type * as blockchain_contractVerification from "../blockchain/contractVerification.js";
import type * as blockchain_ethereum from "../blockchain/ethereum.js";
import type * as blockchain_realDeployment from "../blockchain/realDeployment.js";
import type * as blockchain_solana from "../blockchain/solana.js";
import type * as blockchain_withCircuitBreaker from "../blockchain/withCircuitBreaker.js";
import type * as blockchain from "../blockchain.js";
import type * as bondingCurve_core from "../bondingCurve/core.js";
import type * as bondingCurve_index from "../bondingCurve/index.js";
import type * as bondingCurve_types from "../bondingCurve/types.js";
import type * as bondingCurve from "../bondingCurve.js";
import type * as bondingCurveApi from "../bondingCurveApi.js";
import type * as cache from "../cache.js";
import type * as circuitBreaker from "../circuitBreaker.js";
import type * as config_mainnetConfig from "../config/mainnetConfig.js";
import type * as crons from "../crons.js";
import type * as dex_graduation from "../dex/graduation.js";
import type * as dex_liquidityManager from "../dex/liquidityManager.js";
import type * as dex_pancakeswapV3 from "../dex/pancakeswapV3.js";
import type * as dex_uniswapV3 from "../dex/uniswapV3.js";
import type * as fairLaunch from "../fairLaunch.js";
import type * as fees_feeManager from "../fees/feeManager.js";
import type * as fees_initializeFees from "../fees/initializeFees.js";
import type * as fixBondingCurves from "../fixBondingCurves.js";
import type * as http from "../http.js";
import type * as jobQueue from "../jobQueue.js";
import type * as memeCoins from "../memeCoins.js";
import type * as migrations_addTokenIdToBondingCurves from "../migrations/addTokenIdToBondingCurves.js";
import type * as monitoring_alerts from "../monitoring/alerts.js";
import type * as monitoring_auditLog from "../monitoring/auditLog.js";
import type * as monitoring_metrics from "../monitoring/metrics.js";
import type * as monitoring_scheduler from "../monitoring/scheduler.js";
import type * as monitoring from "../monitoring.js";
import type * as monitoringApi from "../monitoringApi.js";
import type * as notifications from "../notifications.js";
import type * as oracles_priceOracle from "../oracles/priceOracle.js";
import type * as reflections from "../reflections.js";
import type * as revenue_creatorRevenue from "../revenue/creatorRevenue.js";
import type * as router from "../router.js";
import type * as runMigration from "../runMigration.js";
import type * as security_multiSigActions from "../security/multiSigActions.js";
import type * as security_multiSigQueries from "../security/multiSigQueries.js";
import type * as simulatedTrading from "../simulatedTrading.js";
import type * as social_comments from "../social/comments.js";
import type * as social_discord from "../social/discord.js";
import type * as social_formatter from "../social/formatter.js";
import type * as social_reactions from "../social/reactions.js";
import type * as social_telegram from "../social/telegram.js";
import type * as social_trending from "../social/trending.js";
import type * as social_twitter from "../social/twitter.js";
import type * as social_utils from "../social/utils.js";
import type * as social from "../social.js";
import type * as tokenBurn from "../tokenBurn.js";
import type * as users from "../users.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  "analytics/blockchainData": typeof analytics_blockchainData;
  "analytics/blockchainExplorers": typeof analytics_blockchainExplorers;
  "analytics/cache": typeof analytics_cache;
  "analytics/coingecko": typeof analytics_coingecko;
  "analytics/geckoterminal": typeof analytics_geckoterminal;
  "analytics/rateLimiter": typeof analytics_rateLimiter;
  analytics: typeof analytics;
  auth: typeof auth;
  autoLiquidity: typeof autoLiquidity;
  "blockchain/bondingCurveIntegration": typeof blockchain_bondingCurveIntegration;
  "blockchain/contractData": typeof blockchain_contractData;
  "blockchain/contractVerification": typeof blockchain_contractVerification;
  "blockchain/ethereum": typeof blockchain_ethereum;
  "blockchain/realDeployment": typeof blockchain_realDeployment;
  "blockchain/solana": typeof blockchain_solana;
  "blockchain/withCircuitBreaker": typeof blockchain_withCircuitBreaker;
  blockchain: typeof blockchain;
  "bondingCurve/core": typeof bondingCurve_core;
  "bondingCurve/index": typeof bondingCurve_index;
  "bondingCurve/types": typeof bondingCurve_types;
  bondingCurve: typeof bondingCurve;
  bondingCurveApi: typeof bondingCurveApi;
  cache: typeof cache;
  circuitBreaker: typeof circuitBreaker;
  "config/mainnetConfig": typeof config_mainnetConfig;
  crons: typeof crons;
  "dex/graduation": typeof dex_graduation;
  "dex/liquidityManager": typeof dex_liquidityManager;
  "dex/pancakeswapV3": typeof dex_pancakeswapV3;
  "dex/uniswapV3": typeof dex_uniswapV3;
  fairLaunch: typeof fairLaunch;
  "fees/feeManager": typeof fees_feeManager;
  "fees/initializeFees": typeof fees_initializeFees;
  fixBondingCurves: typeof fixBondingCurves;
  http: typeof http;
  jobQueue: typeof jobQueue;
  memeCoins: typeof memeCoins;
  "migrations/addTokenIdToBondingCurves": typeof migrations_addTokenIdToBondingCurves;
  "monitoring/alerts": typeof monitoring_alerts;
  "monitoring/auditLog": typeof monitoring_auditLog;
  "monitoring/metrics": typeof monitoring_metrics;
  "monitoring/scheduler": typeof monitoring_scheduler;
  monitoring: typeof monitoring;
  monitoringApi: typeof monitoringApi;
  notifications: typeof notifications;
  "oracles/priceOracle": typeof oracles_priceOracle;
  reflections: typeof reflections;
  "revenue/creatorRevenue": typeof revenue_creatorRevenue;
  router: typeof router;
  runMigration: typeof runMigration;
  "security/multiSigActions": typeof security_multiSigActions;
  "security/multiSigQueries": typeof security_multiSigQueries;
  simulatedTrading: typeof simulatedTrading;
  "social/comments": typeof social_comments;
  "social/discord": typeof social_discord;
  "social/formatter": typeof social_formatter;
  "social/reactions": typeof social_reactions;
  "social/telegram": typeof social_telegram;
  "social/trending": typeof social_trending;
  "social/twitter": typeof social_twitter;
  "social/utils": typeof social_utils;
  social: typeof social;
  tokenBurn: typeof tokenBurn;
  users: typeof users;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
