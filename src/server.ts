import express, { Request, Response } from "express";
import fs from "fs";
import path from "path";
import { logger } from "./utils/logger";
import { twitterService } from "./services/twitter";

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse request bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// STEP 1 - Auth URL
app.get("/auth", async (req: Request, res: Response) => {
  try {
    const url = await twitterService.getAuthUrl();
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

    res.send(`
      <h1>Authentication Successful!</h1>
      <p>Welcome ${userData.name || userData.username}!</p>
      <p>Your Twitter metrics bot has been activated.</p>
      <p>The system will automatically post metrics on schedule.</p>
      <p><a href="/status">View bot status</a></p>
      <p><a href="/post-metrics">Post metrics now</a></p>
    `);
  } catch (error: any) {
    logger.error("Callback error:", error);
    res.status(500).send("Callback processing failed: " + error.message);
  }
});

// Route to manually post metrics
app.get("/post-metrics", async (req: Request, res: Response) => {
  const isAuthenticated = await twitterService.isAuthenticated();
  if (!isAuthenticated) {
    return res.redirect("/");
  }

  try {
    const result = await twitterService.postMetricsTweet();
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
app.get("/status", async (req: Request, res: Response) => {
  const isAuthenticated = await twitterService.isAuthenticated();
  if (!isAuthenticated) {
    return res.redirect("/");
  }

  const status = await twitterService.getStatus();
  const nextScheduledTime = twitterService.getNextScheduledTime();
  const recentTweets = await twitterService.getRecentTweets();

  res.send(`
    <h1>Twitter Bot Status</h1>
    <p><strong>Status:</strong> ${isAuthenticated ? "Active" : "Inactive"}</p>
    <p><strong>Next scheduled metrics:</strong> ${nextScheduledTime}</p>
    <p><strong>Token expires:</strong> ${status.expiresAt ? new Date(status.expiresAt).toLocaleString() : "Unknown"}</p>
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
    <p><a href="/post-metrics">Post metrics now</a></p>
  `);
});

// Home route
app.get("/", async (req: Request, res: Response) => {
  const isAuthenticated = await twitterService.isAuthenticated();
  if (isAuthenticated) {
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

// Function to start the server
export async function startServer() {
  return new Promise<express.Application>((resolve) => {
    const server = app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(
        `Visit http://localhost:${PORT} to set up your Twitter metrics bot`
      );
      resolve(app);
    });
    
    // Attach server to app for later reference
    (app as any).server = server;
  });
}

// If this file is run directly, start the server
if (require.main === module) {
  startServer();
}
