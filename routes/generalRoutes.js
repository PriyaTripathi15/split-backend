import  express from"express";
const router = express.Router();
import { submitQuery, submitFeedback, getAllFeedback } from "../controllers/generalController.js";
// POST route to handle contact form submissions
router.post("/contact", submitQuery);
router.post("/submit-feedback", submitFeedback);
router.get("/all-feedback", getAllFeedback);
export default router;
