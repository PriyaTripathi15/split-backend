import express from 'express';
import { getUserExpenseStats, getMonthlyTrend, getPaidVsOwed, getCategorySummary, getGroupWiseSummary } from '../controllers/statsController.js';

const router = express.Router();

router.get('/user/:userId', getUserExpenseStats);            // Card Summary + Pie + Bar
router.get('/user/:userId/monthly', getMonthlyTrend);        // Line chart
router.get('/user/:userId/paid-vs-owed', getPaidVsOwed);     // Horizontal bar
router.get('/user/:userId/category', getCategorySummary);    // Pie again (detailed)
router.get('/user/:userId/groups', getGroupWiseSummary);     // Bar again (detailed)

export default router;