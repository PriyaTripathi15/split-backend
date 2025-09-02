import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { settleUp,approveSettlement,rejectSettlement ,getPendingSettlements} from "../controllers/transactionController.js";

const router = express.Router();

router.post("/settle", authMiddleware, settleUp);
router.get("/pending", authMiddleware, getPendingSettlements);
router.put("/:id/approve",authMiddleware,approveSettlement);
router.put('/:id/reject',authMiddleware,rejectSettlement)

export default router;
