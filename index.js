const express = require("express")
const cors = require("cors");
require("dotenv").config()

const app = express()
const PORT = process.env.PORT || 5000;

app.use(cors())
app.use(express.json())

// Sample route
app.get("/api/health", (_, res) => {
  res.status(200).json({ status: "RemoteLogger API is running 🎯" });
});

// Start the server
app.listen(PORT, () => {
  console.log(`🚀 Backend API is running on http://localhost:${PORT}`);
});