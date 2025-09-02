import express from "express";
import { createGroup } from "../controllers/groupController.js";
import protect  from "../middleware/authMiddleware.js";
import { getMyGroups,getGroupDetails,addMemberToGroup,sendGroupInvites, joinGroup,getGroupBalances,deleteGroup} from "../controllers/groupController.js"; // If you want to add this route later
const router = express.Router();

router.post('/create', protect, createGroup);
router.get("/my-groups", protect, getMyGroups);
router.get("/:groupId", protect, getGroupDetails);
router.post("/:groupId/add-member", protect, addMemberToGroup);
router.post("/:groupId/send-invites", protect, sendGroupInvites);
router.post("/join/:groupId", protect, joinGroup);
router.get("/balances/:groupId/", protect, getGroupBalances);
router.delete("/:groupId", protect, deleteGroup);
export default router;
