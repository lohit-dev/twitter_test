import { TwitterApi } from "twitter-api-v2";
import fs from "fs";
import path from "path";
import { generateMetricsReport } from "./metrics";
import { formatMetricsToTweet } from "../utils/formatters";
import { logger } from "../utils/logger";
import { getClient } from "../config/twitter";

// Define types for token data
interface TokenData {
  codeVerifier?: string;
  state?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: string;
  authenticated?: boolean;
}

// Define tweet log entry type
interface TweetLogEntry {
  id: string;
  message: string;
  timestamp: string;
}

// File paths
const DATA_FILE: string = path.join(process.cwd(), "tokens.json");
const TWEET_LOG_FILE: string = path.join(process.cwd(), "tweet_log.json");

// In-memory storage
let tokenData: TokenData = {};
let tweetLog: TweetLogEntry[] = [];

// Initialize data
try {
  if (fs.existsSync(DATA_FILE)) {
    const data = fs.readFileSync(DATA_FILE, "utf8");
    tokenData = JSON.parse(data);
    logger.info("Loaded existing tokens from file");
  }
} catch (error) {
  logger.error("Error reading token data:", error);
}

// Load existing tweet log
try {
  if (fs.existsSync(TWEET_LOG_FILE)) {
    tweetLog = JSON.parse(fs.readFileSync(TWEET_LOG_FILE, "utf8"));
  }
} catch (error) {
  logger.error("Error reading tweet log:", error);
}

// Define callback URL
const callbackURL: string =
  process.env.CALLBACK_URL || "http://localhost:3000/api/twitter/callback";

// Save data to file
const saveTokenData = (): void => {
  fs.writeFileSync(DATA_FILE, JSON.stringify(tokenData, null, 2));
  logger.info("Tokens saved to file");
};

// Add a tweet to the log
const addToTweetLog = (message: string, tweetId: string): void => {
  tweetLog.push({
    id: tweetId,
    message,
    timestamp: new Date().toISOString(),
  });

  // Keep only the latest 100 tweets in the log
  if (tweetLog.length > 100) {
    tweetLog = tweetLog.slice(-100);
  }

  fs.writeFileSync(TWEET_LOG_FILE, JSON.stringify(tweetLog, null, 2));
};

export const twitterService = {
  getAuthUrl: async () => {
    const twitterClient = getClient();
    const { url, codeVerifier, state } = twitterClient.generateOAuth2AuthLink(
      callbackURL,
      { scope: ["tweet.read", "tweet.write", "users.read", "offline.access"] }
    );

    // Store verifier
    tokenData.codeVerifier = codeVerifier;
    tokenData.state = state;
    saveTokenData();

    return url;
  },

  handleCallback: async (state: string, code: string) => {
    const twitterClient = getClient();
    const { codeVerifier, state: storedState } = tokenData;

    if (state !== storedState || !codeVerifier) {
      throw new Error("Stored tokens do not match!");
    }

    const {
      client: loggedClient,
      accessToken,
      refreshToken,
      expiresIn,
    } = await twitterClient.loginWithOAuth2({
      code,
      codeVerifier,
      redirectUri: callbackURL,
    });

    const now = new Date();
    tokenData.accessToken = accessToken;
    tokenData.refreshToken = refreshToken;
    tokenData.expiresAt = new Date(
      now.getTime() + expiresIn * 1000
    ).toISOString();
    tokenData.authenticated = true;
    saveTokenData();

    const { data } = await loggedClient.v2.me();
    return data;
  },

  getTwitterClient: async () => {
    if (!tokenData.refreshToken) {
      throw new Error("No refresh token available. Please authenticate first.");
    }

    // Check if the token is expired or about to expire (5 minute buffer)
    const now = new Date();
    const expiresAt = tokenData.expiresAt
      ? new Date(tokenData.expiresAt)
      : new Date(0);
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

    if (fiveMinutesFromNow >= expiresAt) {
      logger.info("Token expired or about to expire, refreshing...");
      try {
        const twitterClient = getClient();
        const {
          client: refreshedClient,
          accessToken,
          refreshToken: newRefreshToken,
          expiresIn,
        } = await twitterClient.refreshOAuth2Token(tokenData.refreshToken);

        // Update tokens
        tokenData.accessToken = accessToken;
        tokenData.refreshToken = newRefreshToken;
        tokenData.expiresAt = new Date(
          now.getTime() + expiresIn * 1000
        ).toISOString();
        saveTokenData();

        return refreshedClient;
      } catch (error) {
        logger.error("Error refreshing token:", error);
        tokenData.authenticated = false;
        saveTokenData();
        throw new Error("Failed to refresh token. Please re-authenticate.");
      }
    } else {
      // Token is still valid
      if (!tokenData.accessToken) {
        throw new Error(
          "No access token available. Please authenticate first."
        );
      }
      return new TwitterApi(tokenData.accessToken);
    }
  },

  isAuthenticated: async () => {
    return !!tokenData.authenticated;
  },

  getStatus: async () => {
    return {
      authenticated: !!tokenData.authenticated,
      expiresAt: tokenData.expiresAt,
    };
  },

  getRecentTweets: async () => {
    return tweetLog.slice(-5).reverse();
  },

  getNextScheduledTime: () => {
    try {
      const now = new Date();
      let nextDate = new Date(now);

      // Set to noon today
      nextDate.setHours(12, 0, 0, 0);

      // If it's already past noon, set to tomorrow
      if (now > nextDate) {
        nextDate.setDate(nextDate.getDate() + 1);
      }

      return nextDate.toLocaleString();
    } catch (error) {
      return "Unknown";
    }
  },

  postTweet: async (message: string) => {
    try {
      const client = await twitterService.getTwitterClient();
      const { data } = await client.v2.tweet(message);
      logger.info(`Tweet posted successfully: ${message.substring(0, 50)}...`);

      // Log the tweet for record keeping
      addToTweetLog(message, data.id);

      return data;
    } catch (error) {
      logger.error("Tweet error:", error);
      throw error;
    }
  },

  postMetricsTweet: async () => {
    try {
      if (!tokenData.authenticated) {
        logger.info("Not authenticated. Cannot post metrics tweet.");
        return null;
      }

      logger.info("Generating metrics report...");
      const metrics = await generateMetricsReport();
      const formattedMetrics = formatMetricsToTweet(metrics);

      logger.info("Posting metrics to Twitter...");
      const result = await twitterService.postTweet(formattedMetrics);

      logger.info("Metrics successfully posted to Twitter");
      return result;
    } catch (error) {
      logger.error("Error posting metrics tweet:", error);

      // Save metrics to file as fallback
      try {
        const metrics = await generateMetricsReport();
        const formattedMetrics = formatMetricsToTweet(metrics);
        const failedTweetsDir = path.join(process.cwd(), "failed_tweets");

        if (!fs.existsSync(failedTweetsDir)) {
          fs.mkdirSync(failedTweetsDir, { recursive: true });
        }

        const filename = path.join(
          failedTweetsDir,
          `metrics_${new Date().toISOString().replace(/:/g, "-")}.txt`
        );
        fs.writeFileSync(filename, formattedMetrics);
        logger.info(`Metrics saved to file: ${filename}`);
      } catch (saveError) {
        logger.error("Error saving metrics to file:", saveError);
      }

      throw error;
    }
  },
};
