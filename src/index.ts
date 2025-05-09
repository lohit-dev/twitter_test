import express, { Request, Response } from "express";
import fs from "fs";
import path from "path";
import cron from "node-cron";
import { logger } from "./utils/logger";
import { twitterService } from "./services/twitter";

// Global variable to track scheduler
let tweetScheduler: cron.ScheduledTask | null = null;
let metricsScheduler: cron.ScheduledTask | null = null;

// Main function to run the application
async function main() {
  logger.info("Starting Twitter Metrics Bot...");

  // Start the server
  const PORT = process.env.PORT || 3000;
  const app = express();

  // Middleware to parse request bodies
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // STEP 1 - Auth URL
  app.get("/auth", (req: Request, res: Response) => {
    try {
      const url = twitterService.getAuthUrl();
      res.redirect(url);
    } catch (error) {
      logger.error("Authentication error:", error);
      res.status(500).send("Authentication failed");
    }
  });

  // STEP 2 - Verify callback code, store access_token
  app.get("/callback", async (req: Request, res: Response) => {
    try {
      const { state, code } = req.query;

      if (!state || !code) {
        return res.status(400).send("Missing state or code parameters");
      }

      const userData = await twitterService.handleCallback(
        state.toString(),
        code.toString()
      );

      // Set up the schedulers after successful authentication
      setupSchedulers();

      // Post metrics after a delay to ensure Twitter API is ready
      setTimeout(async () => {
        try {
          logger.info("Posting initial metrics after authentication...");
          const result = await twitterService.postMetricsTweet();
          if (result) {
            logger.info(
              `Initial metrics posted successfully with tweet ID: ${result.id}`
            );
          } else {
            logger.warn(
              "Metrics posting returned null result - check database connection"
            );
          }
        } catch (error) {
          logger.error("Failed to post initial metrics:", error);
        }
      }, 15000); // 15 second delay

      res.send(`
        <h1>Authentication Successful!</h1>
        <p>Welcome ${userData.name || userData.username}!</p>
        <p>Your Twitter metrics bot has been activated.</p>
        <p>The system will automatically post metrics and tweets on schedule.</p>
        <p><a href="/status">View bot status</a></p>
        <p><a href="/tweet-now">Send a tweet right now</a></p>
        <p><a href="/post-metrics">Post metrics now</a></p>
      `);
    } catch (error: any) {
      logger.error("Callback error:", error);
      res.status(500).send("Callback processing failed: " + error.message);
    }
  });

  // Route to manually trigger a tweet
  app.get("/tweet-now", async (req: Request, res: Response) => {
    if (!twitterService.isAuthenticated()) {
      return res.redirect("/");
    }

    try {
      await twitterService.postTweet();
      res.send(`
        <h1>Tweet Sent!</h1>
        <p>Successfully posted a tweet</p>
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
    if (!twitterService.isAuthenticated()) {
      return res.redirect("/");
    }

    try {
      // Add a delay to ensure Twitter API is ready
      await twitterService.postMetricsTweet();
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
    if (!twitterService.isAuthenticated()) {
      return res.redirect("/");
    }

    const nextTweetTime = twitterService.calculateNextTweetTime();
    const nextMetricsTime = twitterService.calculateNextMetricsTime();
    const recentTweets = twitterService.getRecentTweets();

    res.send(`
      <h1>Twitter Bot Status</h1>
      <p><strong>Status:</strong> ${
        twitterService.isAuthenticated() ? "Active" : "Inactive"
      }</p>
      <p><strong>Next scheduled tweet:</strong> ${nextTweetTime}</p>
      <p><strong>Next scheduled metrics:</strong> ${nextMetricsTime}</p>
      <p><strong>Recent tweets:</strong></p>
      <ul>
        ${recentTweets
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

  // Home route
  app.get("/", (req: Request, res: Response) => {
    if (twitterService.isAuthenticated()) {
      res.redirect("/status");
    } else {
      res.send(`
        <h1>Twitter Metrics Bot Setup</h1>
        <p>This application will post metrics to Twitter once per day.</p>
        <p>Click the button below to authenticate with Twitter and activate the bot:</p>
        <p><a href="/auth" style="display: inline-block; background-color: #1DA1F2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Connect Twitter Account</a></p>
      `);
    }
  });

  // Start the server
  const server = app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
    logger.info(
      `Visit http://localhost:${PORT} to set up your Twitter metrics bot`
    );
  });

  // Check if we're already authenticated and set up schedulers if we are
  if (twitterService.isAuthenticated()) {
    logger.info("Found valid authentication, setting up schedulers...");
    setupSchedulers();

    // Post metrics on startup if already authenticated
    setTimeout(async () => {
      try {
        logger.info("Posting metrics on startup (already authenticated)...");
        const result = await twitterService.postMetricsTweet();
        if (result) {
          logger.info(
            `Startup metrics posted successfully with tweet ID: ${result.id}`
          );
        } else {
          logger.warn(
            "Metrics posting returned null result - check database connection"
          );
        }
      } catch (error) {
        logger.error("Failed to post startup metrics:", error);
      }
    }, 15000); // 15 second delay
  } else {
    logger.info(
      "No valid authentication found. Please authenticate through the web interface."
    );
  }
}

// Function to set up all schedulers
function setupSchedulers() {
  if (tweetScheduler) {
    tweetScheduler.stop();
    logger.info("Stopped existing tweet scheduler");
  }

  if (metricsScheduler) {
    metricsScheduler.stop();
    logger.info("Stopped existing metrics scheduler");
  }

  // Schedule tweet posting daily at 12:00 PM
  tweetScheduler = cron.schedule("0 12 * * *", async () => {
    logger.info("Running scheduled tweet posting...");
    try {
      await twitterService.postTweet();
    } catch (error) {
      logger.error("Scheduled tweet posting failed:", error);
    }
  });

  // Schedule metrics posting daily at 12:00 PM
  metricsScheduler = cron.schedule("0 12 * * *", async () => {
    logger.info("Running scheduled metrics posting...");
    try {
      await twitterService.postMetricsTweet();
    } catch (error) {
      logger.error("Scheduled metrics posting failed:", error);
    }
  });

  logger.info("Tweet and metrics schedulers initialized");
}

// Handle process termination gracefully
process.on("SIGINT", () => {
  logger.info("Server shutting down...");
  if (tweetScheduler) tweetScheduler.stop();
  if (metricsScheduler) metricsScheduler.stop();
  process.exit(0);
});

process.on("SIGTERM", () => {
  logger.info("Server shutting down...");
  if (tweetScheduler) tweetScheduler.stop();
  if (metricsScheduler) metricsScheduler.stop();
  process.exit(0);
});

// Start the application
main().catch((error) => {
  logger.error("Failed to start application:", error);
  process.exit(1);
});
