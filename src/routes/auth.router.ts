import { Router, Request, Response } from "express";
import { twitterService } from "../services/twitter";
import { logger } from "../utils/logger";

const router = Router();

router.get("/auth", (req: Request, res: Response) => {
  try {
    const url = twitterService.getAuthUrl();
    res.redirect(url);
  } catch (error) {
    logger.error("Authentication error:", error);
    res.status(500).send("Authentication failed");
  }
});

router.get("/callback", async (req: Request, res: Response) => {
  try {
    const { state, code } = req.query;

    if (!state || !code) {
      return res.status(400).send("Missing state or code parameters");
    }

    const userData = await twitterService.handleCallback(
      state.toString(),
      code.toString(),
    );

    res.send(`
      <h1>Authentication Successful!</h1>
      <p>Welcome ${userData.name || userData.username}!</p>
      <p>Your Twitter metrics bot has been activated.</p>
      <p><a href="/status">View bot status</a></p>
    `);
  } catch (error: any) {
    logger.error("Callback error:", error);
    res.status(500).send("Callback processing failed: " + error.message);
  }
});

export default router;
