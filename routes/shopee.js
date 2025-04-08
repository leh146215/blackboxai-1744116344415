const express = require("express");
const router = express.Router();

// Test endpoint
router.get("/test", (req, res) => {
    res.json({
        status: "API is working",
        timestamp: new Date()
    });
});

module.exports = router;
