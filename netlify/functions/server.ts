import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("jacks_management.db");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    role TEXT CHECK(role IN ('admin', 'supervisor'))
  );

  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    location TEXT
  );

  CREATE TABLE IF NOT EXISTS jack_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    daily_rate REAL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    jack_type_id INTEGER,
    quantity INTEGER,
    date TEXT,
    type TEXT CHECK(type IN ('IN', 'OUT')),
    FOREIGN KEY(project_id) REFERENCES projects(id),
    FOREIGN KEY(jack_type_id) REFERENCES jack_types(id)
  );
`);

// Seed default admin if not exists
const adminExists = db.prepare("SELECT * FROM users WHERE username = 'admin'").get();
if (!adminExists) {
  db.prepare("INSERT INTO users (username, password, role) VALUES (?, ?, ?)").run("admin", "admin123", "admin");
}

const app = express();
app.use(express.json());

// API Routes
app.get("/api/projects", (req, res) => {
  const projects = db.prepare("SELECT * FROM projects").all();
  res.json(projects);
});

app.post("/api/projects", (req, res) => {
  const { name, location } = req.body;
  const result = db.prepare("INSERT INTO projects (name, location) VALUES (?, ?)").run(name, location);
  res.json({ id: result.lastInsertRowid });
});

app.delete("/api/projects/:id", (req, res) => {
  db.prepare("DELETE FROM projects WHERE id = ?").run(req.params.id);
  res.status(204).send();
});

app.put("/api/projects/:id", (req, res) => {
  const { name, location } = req.body;
  db.prepare("UPDATE projects SET name = ?, location = ? WHERE id = ?").run(name, location, req.params.id);
  res.json({ success: true });
});

app.get("/api/jack-types", (req, res) => {
  const types = db.prepare("SELECT * FROM jack_types").all();
  res.json(types);
});

app.post("/api/jack-types", (req, res) => {
  const { name, daily_rate } = req.body;
  const result = db.prepare("INSERT INTO jack_types (name, daily_rate) VALUES (?, ?)").run(name, daily_rate);
  res.json({ id: result.lastInsertRowid });
});

app.put("/api/jack-types/:id", (req, res) => {
  const { name, daily_rate } = req.body;
  db.prepare("UPDATE jack_types SET name = ?, daily_rate = ? WHERE id = ?").run(name, daily_rate, req.params.id);
  res.json({ success: true });
});

app.delete("/api/jack-types/:id", (req, res) => {
  db.prepare("DELETE FROM jack_types WHERE id = ?").run(req.params.id);
  res.status(204).send();
});

app.get("/api/transactions", (req, res) => {
  const transactions = db.prepare(`
    SELECT t.*, p.name as project_name, jt.name as jack_name, jt.daily_rate
    FROM transactions t
    JOIN projects p ON t.project_id = p.id
    JOIN jack_types jt ON t.jack_type_id = jt.id
    ORDER BY t.date ASC
  `).all();
  res.json(transactions);
});

app.post("/api/transactions", (req, res) => {
  const { project_id, jack_type_id, quantity, date, type } = req.body;
  const result = db.prepare("INSERT INTO transactions (project_id, jack_type_id, quantity, date, type) VALUES (?, ?, ?, ?, ?)").run(project_id, jack_type_id, quantity, date, type);
  res.json({ id: result.lastInsertRowid });
});

app.delete("/api/transactions/:id", (req, res) => {
  db.prepare("DELETE FROM transactions WHERE id = ?").run(req.params.id);
  res.status(204).send();
});

app.put("/api/transactions/:id", (req, res) => {
  const { project_id, jack_type_id, quantity, date, type } = req.body;
  db.prepare("UPDATE transactions SET project_id = ?, jack_type_id = ?, quantity = ?, date = ?, type = ? WHERE id = ?").run(project_id, jack_type_id, quantity, date, type, req.params.id);
  res.json({ success: true });
});

app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare("SELECT * FROM users WHERE username = ? AND password = ?").get(username, password);
  if (user) {
    res.json({ username: user.username, role: user.role });
  } else {
    res.status(401).json({ error: "Invalid credentials" });
  }
});

// User Management (Admin only)
app.get("/api/users", (req, res) => {
  const users = db.prepare("SELECT id, username, role FROM users").all();
  res.json(users);
});

app.post("/api/users", (req, res) => {
  const { username, password, role } = req.body;
  try {
    const result = db.prepare("INSERT INTO users (username, password, role) VALUES (?, ?, ?)").run(username, password, role);
    res.json({ id: result.lastInsertRowid });
  } catch (e) {
    res.status(400).json({ error: "Username already exists" });
  }
});

app.delete("/api/users/:id", (req, res) => {
  db.prepare("DELETE FROM users WHERE id = ?").run(req.params.id);
  res.status(204).send();
});

// Vite middleware for development
if (process.env.NODE_ENV !== "production") {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
} else {
  app.use(express.static(path.join(__dirname, "dist")));
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "dist", "index.html"));
  });
}

const PORT = 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
