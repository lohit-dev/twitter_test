import { EUploadMimeType, TwitterApi } from "twitter-api-v2";
import fs from "fs";
import { generateSummaryMetrics } from "./metrics";
import { logger } from "../utils/logger";
import { generateMetricsImage, TemplateName } from "../utils/image_generator";
import { twitterConfig } from "../config/twitter";
import { TweetResponse } from "../types";
import {
  addToTweetLog,
  callbackURL,
  saveTokenData,
  tokenData,
  tweetLog,
} from "../utils/utilities";

const twitterClient = new TwitterApi({
  clientId: twitterConfig.clientId,
  clientSecret: twitterConfig.clientSecret,
});

export const twitterService = {
  getAuthUrl: () => {
    const { url, codeVerifier, state } = twitterClient.generateOAuth2AuthLink(
      callbackURL,
      {
        scope: [
          "tweet.read",
          "tweet.write",
          "users.read",
          "offline.access",
          "block.read",
          "block.write",
        ],
      }
    );

    // Store verifier
    tokenData.codeVerifier = codeVerifier;
    tokenData.state = state;
    saveTokenData();

    return url;
  },

  handleCallback: async (state: string, code: string) => {
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

  getTwitterClient: async (): Promise<TwitterApi> => {
    try {
      if (
        twitterConfig.apiKey &&
        twitterConfig.apiSecret &&
        twitterConfig.accessToken &&
        twitterConfig.accessSecret
      ) {
        logger.info("Using OAuth 1.0a authentication for Twitter API");
        return new TwitterApi({
          appKey: twitterConfig.apiKey,
          appSecret: twitterConfig.apiSecret,
          accessToken: twitterConfig.accessToken,
          accessSecret: twitterConfig.accessSecret,
        });
      }

      logger.info("Falling back to OAuth 2.0 authentication");

      if (!tokenData.refreshToken) {
        throw new Error(
          "No refresh token available. Please authenticate first."
        );
      }

      const now = new Date();
      const expiresAt = tokenData.expiresAt
        ? new Date(tokenData.expiresAt)
        : new Date(0);
      const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

      if (fiveMinutesFromNow >= expiresAt) {
        logger.info("Token expired or about to expire, refreshing...");
        try {
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
        } catch (refreshError) {
          logger.error("Error refreshing token:", refreshError);
          throw new Error(
            "Failed to refresh token. Please authenticate again."
          );
        }
      }

      if (!tokenData.accessToken) {
        throw new Error(
          "No access token available. Please authenticate first."
        );
      }
      return new TwitterApi(tokenData.accessToken);
    } catch (error) {
      logger.error("Error getting Twitter client:", error);
      throw error;
    }
  },

  isAuthenticated: () => {
    return Boolean(tokenData.authenticated && tokenData.refreshToken);
  },

  getStatus: () => {
    return {
      authenticated: Boolean(tokenData.authenticated),
      expiresAt: tokenData.expiresAt,
      hasRefreshToken: Boolean(tokenData.refreshToken),
    };
  },

  getRecentTweets: () => {
    return tweetLog;
  },

  postTweet: async (
    message?: string,
    imagePath?: string
  ): Promise<TweetResponse> => {
    try {
      const client = await twitterService.getTwitterClient();

      if (imagePath) {
        logger.info(`Attaching image from path: ${imagePath}`);
        try {
          const imageBuffer = fs.readFileSync(imagePath);
          logger.info(
            `Image read as buffer, size: ${imageBuffer.length} bytes`
          );

          // Upload the media
          const mediaId = await client.v1.uploadMedia(imageBuffer, {
            mimeType: EUploadMimeType.Png,
          });
          logger.info(`Media uploaded successfully with ID: ${mediaId}`);

          // Post the tweet with the media
          const tweet = await client.v2.tweet({
            text: message || "",
            media: { media_ids: [mediaId] },
          });

          logger.info("Tweet with image posted successfully");
          addToTweetLog(message || "(Image only)", tweet.data.id);

          return {
            id: tweet.data.id,
            text: tweet.data.text,
          };
        } catch (mediaError: any) {
          logger.error("Error uploading media:", mediaError);
          throw new Error(`Failed to upload media: ${mediaError.message}`);
        }
      } else {
        const tweet = await client.v2.tweet(message || "");
        logger.info("Text-only tweet posted successfully");
        addToTweetLog(message || "", tweet.data.id);

        return {
          id: tweet.data.id,
          text: tweet.data.text,
        };
      }
    } catch (error) {
      logger.error("Error posting tweet:", error);
      throw error;
    }
  },

  postMetricsTweet: async (
    templateName: TemplateName = "standard"
  ): Promise<TweetResponse | null> => {
    try {
      logger.info(`Posting metrics tweet with ${templateName} template...`);
      const metrics = await generateSummaryMetrics();

      if (!metrics) {
        logger.warn("No metrics data available");
        return null;
      }

      const imagePath = await generateMetricsImage(metrics, templateName);
      const tweet = await twitterService.postTweet("", imagePath);

      logger.info(`Posted metrics tweet with ID: ${tweet.id}`);
      return tweet;
    } catch (error) {
      logger.error("Error posting metrics tweet:", error);
      throw error;
    }
  },
};
