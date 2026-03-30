import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import axios from "axios";
import CryptoJS from "crypto-js";
import cookieSession from "cookie-session";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(cookieSession({
  name: 'session',
  keys: [process.env.ENCRYPTION_KEY || 'default-secret-key'],
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
  secure: true,
  sameSite: 'none'
}));

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-secret-key';

// Helper to encrypt/decrypt tokens
const encrypt = (text: string) => CryptoJS.AES.encrypt(text, ENCRYPTION_KEY).toString();
const decrypt = (ciphertext: string) => CryptoJS.AES.decrypt(ciphertext, ENCRYPTION_KEY).toString(CryptoJS.enc.Utf8);

// GitHub OAuth Login
app.get("/api/auth/github/login", (req, res) => {
  const redirectUri = `${process.env.APP_URL}/api/auth/github/callback`;
  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${redirectUri}&scope=repo,user`;
  res.json({ url: githubAuthUrl });
});

// GitHub OAuth Callback
app.get("/api/auth/github/callback", async (req, res) => {
  const { code } = req.query;
  try {
    const response = await axios.post("https://github.com/login/oauth/access_token", {
      client_id: GITHUB_CLIENT_ID,
      client_secret: GITHUB_CLIENT_SECRET,
      code,
    }, {
      headers: { Accept: "application/json" }
    });

    const { access_token } = response.data;
    if (!access_token) {
      throw new Error("Failed to obtain access token");
    }

    // Encrypt token before sending back or storing
    const encryptedToken = encrypt(access_token);

    res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'GITHUB_AUTH_SUCCESS', token: '${encryptedToken}' }, '*');
              window.close();
            } else {
              window.location.href = '/';
            }
          </script>
          <p>Authentication successful. This window should close automatically.</p>
        </body>
      </html>
    `);
  } catch (error) {
    console.error("GitHub Auth Error:", error);
    res.status(500).send("Authentication failed");
  }
});

// Proxy GitHub API requests
app.post("/api/github/proxy", async (req, res) => {
  const { encryptedToken, endpoint, method = 'GET', data } = req.body;
  if (!encryptedToken) return res.status(401).json({ error: "No token provided" });

  try {
    const token = decrypt(encryptedToken);
    const response = await axios({
      url: `https://api.github.com${endpoint}`,
      method,
      data,
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "RepoArch-AI"
      }
    });
    res.json(response.data);
  } catch (error: any) {
    console.error("GitHub Proxy Error:", error.response?.data || error.message);
    res.status(error.response?.status || 500).json(error.response?.data || { error: "GitHub API request failed" });
  }
});

// Start server
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
