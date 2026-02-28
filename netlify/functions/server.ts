import express from "express";
import serverless from "serverless-http";
import { neon } from '@neondatabase/serverless';

// الاتصال بـ Neon باستخدام الرابط اللي حطيته في Netlify
const sql = neon(process.env.DATABASE_URL!);

const app = express();
app.use(express.json());

// API Routes
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const users = await sql`SELECT * FROM users WHERE username = ${username} AND password = ${password}`;
    if (users.length > 0) {
      res.json({ username: users[0].username, role: users[0].role });
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
  } catch (error) {
    res.status(500).json({ error: "Database error" });
  }
});

app.get("/api/projects", async (req, res) => {
  const projects = await sql`SELECT * FROM projects`;
  res.json(projects);
});

// يمكنك إضافة بقية الروابط (POST, DELETE) بنفس الطريقة باستخدام sql`query`

// تصدير الكود كـ Netlify Function
export const handler = serverless(app);
