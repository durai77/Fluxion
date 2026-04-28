const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const createPeerToken = async (req, res) => {
  const peerId = req.body.peerId || crypto.randomUUID();
  const token = jwt.sign(
    {
      peerId,
      userId: req.userId,
    },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );

  res.json({ peerId, token, expiresIn: 3600 });
};

module.exports = { createPeerToken };
