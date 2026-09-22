const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

const DB_FILE = process.env.DB_FILE || path.join(__dirname, '..', 'data', 'infotechzone.db');
fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });

const db = new DatabaseSync(DB_FILE);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS categories (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  icon        TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS products (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  brand           TEXT,
  category_id     TEXT NOT NULL REFERENCES categories(id),
  icon            TEXT,
  condition       TEXT NOT NULL DEFAULT 'New' CHECK (condition IN ('New','Used','Refurbished')),
  availability    TEXT NOT NULL DEFAULT 'In Stock'
                  CHECK (availability IN ('In Stock','Limited Stock','Out of Stock','Pre-order','Available on Request')),
  price           INTEGER NOT NULL DEFAULT 0,
  warranty        TEXT,
  description     TEXT,
  specs_json      TEXT NOT NULL DEFAULT '[]',   -- JSON array of [label, value] pairs
  images_json     TEXT NOT NULL DEFAULT '[]',   -- JSON array of image URLs
  featured        INTEGER NOT NULL DEFAULT 0,
  new_arrival     INTEGER NOT NULL DEFAULT 0,
  views_count     INTEGER NOT NULL DEFAULT 0,   -- denormalised counters, kept in sync by triggers below
  enquiries_count INTEGER NOT NULL DEFAULT 0,
  favourites_count INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);

CREATE TABLE IF NOT EXISTS customers (
  id                TEXT PRIMARY KEY,
  full_name         TEXT NOT NULL,
  email             TEXT NOT NULL UNIQUE,
  phone             TEXT,
  password_hash     TEXT,              -- nullable: Google-only accounts have no password
  google_id         TEXT UNIQUE,       -- nullable: set for accounts created/linked via Google Sign-In
  email_verified    INTEGER NOT NULL DEFAULT 0,
  verify_token      TEXT,
  verify_expires_at TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS admins (
  id            TEXT PRIMARY KEY,
  full_name     TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('super','manager','staff')),
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id TEXT REFERENCES customers(id) ON DELETE CASCADE, -- nullable: guests can opt in too
  endpoint    TEXT NOT NULL UNIQUE,
  p256dh      TEXT NOT NULL,
  auth        TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS favourites (
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  product_id  TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (customer_id, product_id)
);

-- Section 14: only registered (logged-in) views are tracked; anonymous browsing is not.
CREATE TABLE IF NOT EXISTS product_views (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  product_id  TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  viewed_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_views_product ON product_views(product_id);
CREATE INDEX IF NOT EXISTS idx_views_customer ON product_views(customer_id);

CREATE TABLE IF NOT EXISTS enquiries (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id  TEXT REFERENCES customers(id) ON DELETE SET NULL, -- nullable: guests can enquire too
  product_id   TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  source       TEXT NOT NULL DEFAULT 'website',   -- 'website' | 'android' | 'ios'
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_enquiries_product ON enquiries(product_id);

CREATE TABLE IF NOT EXISTS system_settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`);

// Keep denormalised counters on products in sync automatically, so
// GET /products stays a single cheap query for the catalogue screens,
// while /api/analytics can still query the raw event tables for detail.
db.exec(`
CREATE TRIGGER IF NOT EXISTS trg_fav_insert AFTER INSERT ON favourites BEGIN
  UPDATE products SET favourites_count = favourites_count + 1 WHERE id = NEW.product_id;
END;
CREATE TRIGGER IF NOT EXISTS trg_fav_delete AFTER DELETE ON favourites BEGIN
  UPDATE products SET favourites_count = favourites_count - 1 WHERE id = OLD.product_id;
END;
CREATE TRIGGER IF NOT EXISTS trg_view_insert AFTER INSERT ON product_views BEGIN
  UPDATE products SET views_count = views_count + 1 WHERE id = NEW.product_id;
END;
CREATE TRIGGER IF NOT EXISTS trg_enquiry_insert AFTER INSERT ON enquiries BEGIN
  UPDATE products SET enquiries_count = enquiries_count + 1 WHERE id = NEW.product_id;
END;
`);

// First-boot defaults — editable afterwards via the admin Settings screen.
const seedSetting = db.prepare(`INSERT OR IGNORE INTO system_settings (key, value) VALUES (?, ?)`);
seedSetting.run('whatsapp_number', process.env.DEFAULT_WHATSAPP_NUMBER || '2348001234567');
seedSetting.run('emergency_number', process.env.DEFAULT_EMERGENCY_NUMBER || '+2348001234567');

module.exports = db;
