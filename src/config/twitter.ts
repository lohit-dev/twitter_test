import dotenv from "dotenv";
import { TwitterApi } from "twitter-api-v2";

dotenv.config();

export const twitterConfig = {
  apiKey: process.env.TWITTER_API_KEY || "",
  apiSecret: process.env.TWITTER_API_SECRET || "",
  accessToken: process.env.TWITTER_ACCESS_TOKEN || "",
  accessSecret: process.env.TWITTER_ACCESS_SECRET || "",
  userToken: process.env.USER_TOKEN || "",
  clientId: process.env.CLIENT_ID || "",
  clientSecret: process.env.CLIENT_SECRET || "",
};

export const getClient = () => {
  const twitterClient = new TwitterApi({
    clientId: twitterConfig.clientId,
    clientSecret: twitterConfig.clientSecret,
  });

  return twitterClient;
};
