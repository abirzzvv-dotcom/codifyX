const router = require("express").Router();
const { getNgrokUrl } = require("../services/ngrok");
const { authenticate } = require("../middleware/auth");

router.get("/status", authenticate, (req, res) => {
  const { url, connected } = getNgrokUrl();
  res.json({ url, connected });
});

module.exports = router;
