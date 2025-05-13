import fs from "fs";
import request from "request";
import { logger } from "./logger";
import { TokenData, TweetLogEntry } from "../types";
import path from "path";

/**
 * Downloads a file from a URI to a local file
 * @param uri Source URI of the file
 * @param filename Destination filename
 * @param callback Function to call after download completes
 */
export function download(
  uri: string,
  filename: string,
  callback: () => void,
): void {
  request.head(uri, function (err, res, body) {
    request(uri).pipe(fs.createWriteStream(filename)).on("close", callback);
  });
}

export const DATA_FILE: string = path.join(__dirname, "..", "tokens.json");
export const TWEET_LOG_FILE: string = path.join(
  __dirname,
  "..",
  "tweet_log.json",
);

export const callbackURL: string = "http://localhost:3000/callback";
export let tokenData: TokenData = {};
export let tweetLog: TweetLogEntry[] = [];
try {
  if (fs.existsSync(DATA_FILE)) {
    const data = fs.readFileSync(DATA_FILE, "utf8");
    tokenData = JSON.parse(data);
    logger.info("Loaded existing tokens from file");
  }
} catch (error) {
  logger.error("Error reading token data:", error);
}

try {
  if (fs.existsSync(TWEET_LOG_FILE)) {
    tweetLog = JSON.parse(fs.readFileSync(TWEET_LOG_FILE, "utf8"));
  }
} catch (error) {
  logger.error("Error reading tweet log:", error);
}

export const saveTokenData = (): void => {
  fs.writeFileSync(DATA_FILE, JSON.stringify(tokenData, null, 2));
  logger.info("Tokens saved to file");
};

export const addToTweetLog = (message: string, tweetId: string): void => {
  tweetLog.push({
    id: tweetId,
    message,
    timestamp: new Date().toISOString(),
  });

  if (tweetLog.length > 100) {
    tweetLog = tweetLog.slice(-100);
  }

  fs.writeFileSync(TWEET_LOG_FILE, JSON.stringify(tweetLog, null, 2));
};
