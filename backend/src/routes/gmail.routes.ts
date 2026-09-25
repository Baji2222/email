import { Router } from 'express';
import { processGmailTickets } from '../services/gmail-ticket-automation.service';

export const gmailRouter = Router();

gmailRouter.get('/process', async (req, res, next) => {
  try {
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      return res.status(500).json({
        success: false,
        message: 'CRON_SECRET is not configured',
      });
    }

    const authHeader = req.headers.authorization;

    if (authHeader !== `Bearer ${cronSecret}`) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    const result = await processGmailTickets();

    res.json({
      success: true,
      message: 'Gmail ticket automation completed',
      result,
    });
  } catch (error) {
    next(error);
  }
});