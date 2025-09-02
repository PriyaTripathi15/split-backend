import express from "express";
import { addExpense, getFullExpenses,getMyGroupExpenseSummary } from "../controllers/expenseController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import { getGroupExpenses } from "../controllers/expenseController.js";
import { getMyExpenseSummary  } from "../controllers/expenseController.js";

const router = express.Router();

// POST /expenses
router.post("/add/:groupId", authMiddleware, (req, res, next) => {
  req.body.groupId = req.params.groupId;
  addExpense(req, res, next);
});

router.get("/group/:groupId", authMiddleware, getGroupExpenses);
router.get("/my-summary", authMiddleware, getMyExpenseSummary ); // GET /expenses/my
router.get('/my-group-summary',authMiddleware,getMyGroupExpenseSummary);
router.get("/my-expenses", authMiddleware,getFullExpenses);
export default router;