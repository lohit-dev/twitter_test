import { Router, Request, Response } from "express";
import { twitterService } from "../services/twitter";

const router = Router();

router.get("/status", (req: Request, res: Response) => {
  if (!twitterService.isAuthenticated()) {
    return res.redirect("/");
  }

  const recentTweets = twitterService.getRecentTweets();

  res.send(`
    <h1>Twitter Bot Status</h1>
    <p><strong>Status:</strong> ${
      twitterService.isAuthenticated() ? "Active" : "Inactive"
    }</p>
    <p><strong>Recent tweets:</strong></p>
    <ul>
      ${recentTweets
        .map(
          (tweet) =>
            `<li>${new Date(tweet.timestamp).toLocaleString()}: "${
              tweet.message
            }"</li>`,
        )
        .join("")}
    </ul>
  `);
});

router.get("/", (req: Request, res: Response) => {
  if (twitterService.isAuthenticated()) {
    res.redirect("/status");
  } else {
    res.send(`
      <h1>Twitter Metrics Bot Setup</h1>
      <p>This application will post metrics to Twitter using your selected template.</p>
      <p>Click the button below to authenticate with Twitter and activate the bot:</p>
      <p><a href="/auth" style="display: inline-block; background-color: #1DA1F2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Connect Twitter Account</a></p>
    `);
  }
});

export default router;
