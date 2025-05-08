import express, { Request, Response } from "express";
import { TwitterApi } from "twitter-api-v2";
import fs from "fs";
import path from "path";
import cron from "node-cron";
import { getClient } from "./config/twitter";
import { generateMetricsReport } from "./services/metrics";
import { formatMetricsToTweet } from "./utils/formatters";

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

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

const twitterClient = getClient();

// In-memory storage
const DATA_FILE: string = path.join(__dirname, "tokens.json");

// Initialize data storage or load existing data
let tokenData: TokenData = {};
try {
  if (fs.existsSync(DATA_FILE)) {
    const data = fs.readFileSync(DATA_FILE, "utf8");
    tokenData = JSON.parse(data);
    console.log("Loaded existing tokens from file");
  }
} catch (error) {
  console.error("Error reading token data:", error);
}

// Save data to file
const saveTokenData = (): void => {
  fs.writeFileSync(DATA_FILE, JSON.stringify(tokenData, null, 2));
  console.log("Tokens saved to file");
};

// Define callback URL
const callbackURL: string =
  process.env.CALLBACK_URL || "http://localhost:3000/callback";

// Middleware to parse request bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// STEP 1 - Auth URL
app.get("/auth", (req: Request, res: Response) => {
  try {
    const { url, codeVerifier, state } = twitterClient.generateOAuth2AuthLink(
      callbackURL,
      { scope: ["tweet.read", "tweet.write", "users.read", "offline.access"] }
    );

    // Store verifier
    tokenData.codeVerifier = codeVerifier;
    tokenData.state = state;
    saveTokenData();

    res.redirect(url);
  } catch (error) {
    console.error("Authentication error:", error);
    res.status(500).send("Authentication failed");
  }
});

// STEP 2 - Verify callback code, store access_token
app.get("/callback", async (req: Request, res: Response) => {
  try {
    const { state, code } = req.query;
    const { codeVerifier, state: storedState } = tokenData;

    if (state !== storedState || !code || !codeVerifier) {
      return res.status(400).send("Stored tokens do not match!");
    }

    const {
      client: loggedClient,
      accessToken,
      refreshToken,
      expiresIn,
    } = await twitterClient.loginWithOAuth2({
      code: code.toString(),
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

    res.send(`
      <h1>Authentication Successful!</h1>
      <p>Welcome ${data.name || data.username}!</p>
      <p>Your daily "Hello World" tweet bot has been activated.</p>
      <p>The system will automatically tweet "Hello World" once per day.</p>
      <p><a href="/status">View bot status</a></p>
      <p><a href="/tweet-now">Send a tweet right now</a></p>
    `);
  } catch (error: any) {
    console.error("Callback error:", error);
    res.status(500).send("Callback processing failed: " + error.message);
  }
});

async function getTwitterClient(): Promise<TwitterApi> {
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
    console.log("Token expired or about to expire, refreshing...");
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
    } catch (error) {
      console.error("Error refreshing token:", error);
      tokenData.authenticated = false;
      saveTokenData();
      throw new Error("Failed to refresh token. Please re-authenticate.");
    }
  } else {
    // Token is still valid
    if (!tokenData.accessToken) {
      throw new Error("No access token available. Please authenticate first.");
    }
    return new TwitterApi(tokenData.accessToken);
  }
}

// Interface for tweet response
interface TweetResponse {
  id: string;
  text: string;
}

// Function to post a tweet
async function postTweet(message?: string): Promise<TweetResponse> {
  try {
    const client = await getTwitterClient();
    const tweetText = message || getHelloWorldMessage();

    const { data } = await client.v2.tweet(tweetText);
    console.log(`Tweet posted successfully: ${tweetText}`);

    // Log the tweet for record keeping
    addToTweetLog(tweetText, data.id);

    return data;
  } catch (error) {
    console.error("Tweet error:", error);
    throw error;
  }
}

// Function to post metrics to Twitter
async function postMetricsTweet(): Promise<TweetResponse | null> {
  try {
    if (!tokenData.authenticated) {
      console.log("Not authenticated. Cannot post metrics tweet.");
      return null;
    }

    console.log("Generating metrics report...");
    const metrics = await generateMetricsReport();
    const formattedMetrics = formatMetricsToTweet(metrics);

    console.log("Posting metrics to Twitter...");
    const result = await postTweet(formattedMetrics);

    console.log("Metrics successfully posted to Twitter");
    return result;
  } catch (error) {
    console.error("Error posting metrics tweet:", error);

    // Save metrics to file as fallback
    try {
      const metrics = await generateMetricsReport();
      const formattedMetrics = formatMetricsToTweet(metrics);
      const failedTweetsDir = path.join(__dirname, "failed_tweets");

      if (!fs.existsSync(failedTweetsDir)) {
        fs.mkdirSync(failedTweetsDir, { recursive: true });
      }

      const filename = path.join(
        failedTweetsDir,
        `metrics_${new Date().toISOString().replace(/:/g, "-")}.txt`
      );
      fs.writeFileSync(filename, formattedMetrics);
      console.log(`Metrics saved to file: ${filename}`);
    } catch (saveError) {
      console.error("Error saving metrics to file:", saveError);
    }

    throw error;
  }
}

// Get a Hello World message with a slight variation
function getHelloWorldMessage(): string {
  const variations: string[] = [
    "Hello World!",
    "Hello World from my Twitter bot!",
    "Daily Hello World check-in!",
    "Hello World! Automated tweet for today.",
    `Hello World! It's ${new Date().toLocaleDateString()}.`,
  ];

  return variations[Math.floor(Math.random() * variations.length)];
}

// Keep a log of sent tweets
const TWEET_LOG_FILE: string = path.join(__dirname, "tweet_log.json");
let tweetLog: TweetLogEntry[] = [];

// Load existing tweet log
try {
  if (fs.existsSync(TWEET_LOG_FILE)) {
    tweetLog = JSON.parse(fs.readFileSync(TWEET_LOG_FILE, "utf8"));
  }
} catch (error) {
  console.error("Error reading tweet log:", error);
}

// Add a tweet to the log
function addToTweetLog(message: string, tweetId: string): void {
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
}

// Check if we have valid credentials on startup and set up schedulers if we do
if (tokenData.authenticated) {
  setupTweetScheduler();
  setupMetricsScheduler();
  console.log("Tweet and metrics schedulers initialized on startup");
}

// Set up tweet scheduler
function setupTweetScheduler() {
  // Schedule tweet posting daily at 12:00 PM
  const scheduler = cron.schedule("0 12 * * *", async () => {
    console.log("Running scheduled tweet posting...");
    try {
      await postTweet(getHelloWorldMessage());
    } catch (error) {
      console.error("Scheduled tweet posting failed:", error);
    }
  });

  console.log("Tweet scheduler set up for 12:00 PM daily");
  return scheduler;
}

// Set up metrics scheduler
function setupMetricsScheduler() {
  // Schedule metrics posting daily at 12:00 PM
  const metricsScheduler = cron.schedule("0 12 * * *", async () => {
    console.log("Running scheduled metrics posting...");
    try {
      await postMetricsTweet();
    } catch (error) {
      console.error("Scheduled metrics posting failed:", error);
    }
  });

  console.log("Metrics scheduler set up for 12:00 PM daily");
  return metricsScheduler;
}

// Route to manually trigger a tweet
app.get("/tweet-now", async (req: Request, res: Response) => {
  if (!tokenData.authenticated) {
    return res.redirect("/");
  }

  try {
    await postTweet(getHelloWorldMessage());
    res.send(`
      <h1>Tweet Sent!</h1>
      <p>Successfully posted: "${getHelloWorldMessage()}"</p>
      <p><a href="/status">Back to status page</a></p>
    `);
  } catch (error: any) {
    res.status(500).send(`
      <h1>Tweet Failed</h1>
      <p>Error: ${error.message}</p>
      <p><a href="/auth">Re-authenticate</a></p>
    `);
  }
});

// Route to manually post metrics
app.get("/post-metrics", async (req: Request, res: Response) => {
  if (!tokenData.authenticated) {
    return res.redirect("/");
  }

  try {
    await postMetricsTweet();
    res.send(`
      <h1>Metrics Tweet Sent!</h1>
      <p>Successfully posted metrics to Twitter</p>
      <p><a href="/status">Back to status page</a></p>
    `);
  } catch (error: any) {
    res.status(500).send(`
      <h1>Metrics Tweet Failed</h1>
      <p>Error: ${error.message}</p>
      <p><a href="/auth">Re-authenticate</a></p>
    `);
  }
});

// Route to check bot status
app.get("/status", (req: Request, res: Response) => {
  if (!tokenData.authenticated) {
    return res.redirect("/");
  }

  const nextTweetTime = calculateNextTweetTime();
  const nextMetricsTime = calculateNextMetricsTime();

  res.send(`
    <h1>Twitter Bot Status</h1>
    <p><strong>Status:</strong> ${
      tokenData.authenticated ? "Active" : "Inactive"
    }</p>
    <p><strong>Next scheduled tweet:</strong> ${nextTweetTime}</p>
    <p><strong>Next scheduled metrics:</strong> ${nextMetricsTime}</p>
    <p><strong>Recent tweets:</strong></p>
    <ul>
      ${tweetLog
        .slice(-5)
        .reverse()
        .map(
          (tweet) =>
            `<li>${new Date(tweet.timestamp).toLocaleString()}: "${
              tweet.message
            }"</li>`
        )
        .join("")}
    </ul>
    <p><a href="/tweet-now">Send a tweet now</a></p>
    <p><a href="/post-metrics">Post metrics now</a></p>
  `);
});

// Calculate the next scheduled tweet time
function calculateNextTweetTime(): string {
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
}

// Calculate the next scheduled metrics time
function calculateNextMetricsTime(): string {
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
}

// Home route
app.get("/", (req: Request, res: Response) => {
  if (tokenData.authenticated) {
    res.redirect("/status");
  } else {
    res.send(`
      <h1>Twitter Bot Setup</h1>
      <p>This application will post a "Hello World" tweet once per day.</p>
      <p>Click the button below to authenticate with Twitter and activate the bot:</p>
      <p><a href="/auth" style="display: inline-block; background-color: #1DA1F2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Connect Twitter Account</a></p>
    `);
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Visit http://localhost:${PORT} to set up your Twitter bot`);
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("Server shutting down...");
  process.exit(0);
});
