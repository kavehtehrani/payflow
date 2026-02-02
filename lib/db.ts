import Database from "better-sqlite3";
import path from "path";

const DB_PATH = process.env.DATABASE_URL?.replace("file:", "") || path.join(process.cwd(), "payflow.db");

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    initSchema(db);
  }
  return db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      raw_file_name TEXT,
      raw_file_type TEXT,
      parsed_data TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      invoice_id TEXT NOT NULL,
      tx_hash TEXT,
      from_chain TEXT,
      to_chain TEXT,
      from_token TEXT,
      to_token TEXT,
      amount TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      route_data TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (invoice_id) REFERENCES invoices(id)
    );

    CREATE INDEX IF NOT EXISTS idx_invoices_user ON invoices(user_id);
    CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_id);
  `);
}

// Invoice CRUD
export function createInvoice(invoice: {
  id: string;
  userId: string;
  rawFileName?: string;
  rawFileType?: string;
  parsedData?: object | null;
  status?: string;
}) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO invoices (id, user_id, raw_file_name, raw_file_type, parsed_data, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    invoice.id,
    invoice.userId,
    invoice.rawFileName || null,
    invoice.rawFileType || null,
    invoice.parsedData ? JSON.stringify(invoice.parsedData) : null,
    invoice.status || "draft"
  );
}

export function updateInvoice(id: string, data: { parsedData?: object; status?: string }) {
  const db = getDb();
  const sets: string[] = [];
  const values: unknown[] = [];

  if (data.parsedData !== undefined) {
    sets.push("parsed_data = ?");
    values.push(JSON.stringify(data.parsedData));
  }
  if (data.status !== undefined) {
    sets.push("status = ?");
    values.push(data.status);
  }

  if (sets.length === 0) return;

  values.push(id);
  db.prepare(`UPDATE invoices SET ${sets.join(", ")} WHERE id = ?`).run(...values);
}

export function getInvoicesByUser(userId: string) {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM invoices WHERE user_id = ? ORDER BY created_at DESC").all(userId) as {
    id: string;
    user_id: string;
    raw_file_name: string | null;
    raw_file_type: string | null;
    parsed_data: string | null;
    status: string;
    created_at: string;
  }[];

  return rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    rawFileName: row.raw_file_name,
    rawFileType: row.raw_file_type,
    parsedData: row.parsed_data ? JSON.parse(row.parsed_data) : null,
    status: row.status,
    createdAt: row.created_at,
  }));
}

export function getInvoiceById(id: string) {
  const db = getDb();
  const row = db.prepare("SELECT * FROM invoices WHERE id = ?").get(id) as {
    id: string;
    user_id: string;
    raw_file_name: string | null;
    raw_file_type: string | null;
    parsed_data: string | null;
    status: string;
    created_at: string;
  } | undefined;

  if (!row) return null;

  return {
    id: row.id,
    userId: row.user_id,
    rawFileName: row.raw_file_name,
    rawFileType: row.raw_file_type,
    parsedData: row.parsed_data ? JSON.parse(row.parsed_data) : null,
    status: row.status,
    createdAt: row.created_at,
  };
}

// Payment CRUD
export function createPayment(payment: {
  id: string;
  invoiceId: string;
  fromChain?: string;
  toChain?: string;
  fromToken?: string;
  toToken?: string;
  amount?: string;
  status?: string;
}) {
  const db = getDb();
  db.prepare(`
    INSERT INTO payments (id, invoice_id, from_chain, to_chain, from_token, to_token, amount, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    payment.id,
    payment.invoiceId,
    payment.fromChain || null,
    payment.toChain || null,
    payment.fromToken || null,
    payment.toToken || null,
    payment.amount || null,
    payment.status || "pending"
  );
}

export function updatePayment(id: string, data: { txHash?: string; status?: string; routeData?: object }) {
  const db = getDb();
  const sets: string[] = [];
  const values: unknown[] = [];

  if (data.txHash !== undefined) {
    sets.push("tx_hash = ?");
    values.push(data.txHash);
  }
  if (data.status !== undefined) {
    sets.push("status = ?");
    values.push(data.status);
  }
  if (data.routeData !== undefined) {
    sets.push("route_data = ?");
    values.push(JSON.stringify(data.routeData));
  }

  if (sets.length === 0) return;

  values.push(id);
  db.prepare(`UPDATE payments SET ${sets.join(", ")} WHERE id = ?`).run(...values);
}

export function getPaymentsByInvoice(invoiceId: string) {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM payments WHERE invoice_id = ? ORDER BY created_at DESC").all(invoiceId) as {
    id: string;
    invoice_id: string;
    tx_hash: string | null;
    from_chain: string | null;
    to_chain: string | null;
    from_token: string | null;
    to_token: string | null;
    amount: string | null;
    status: string;
    route_data: string | null;
    created_at: string;
  }[];

  return rows.map((row) => ({
    id: row.id,
    invoiceId: row.invoice_id,
    txHash: row.tx_hash,
    fromChain: row.from_chain,
    toChain: row.to_chain,
    fromToken: row.from_token,
    toToken: row.to_token,
    amount: row.amount,
    status: row.status,
    routeData: row.route_data ? JSON.parse(row.route_data) : null,
    createdAt: row.created_at,
  }));
}

export function getPaymentsByUser(userId: string) {
  const db = getDb();
  const rows = db.prepare(`
    SELECT p.* FROM payments p
    JOIN invoices i ON p.invoice_id = i.id
    WHERE i.user_id = ?
    ORDER BY p.created_at DESC
  `).all(userId) as {
    id: string;
    invoice_id: string;
    tx_hash: string | null;
    from_chain: string | null;
    to_chain: string | null;
    from_token: string | null;
    to_token: string | null;
    amount: string | null;
    status: string;
    route_data: string | null;
    created_at: string;
  }[];

  return rows.map((row) => ({
    id: row.id,
    invoiceId: row.invoice_id,
    txHash: row.tx_hash,
    fromChain: row.from_chain,
    toChain: row.to_chain,
    fromToken: row.from_token,
    toToken: row.to_token,
    amount: row.amount,
    status: row.status,
    routeData: row.route_data ? JSON.parse(row.route_data) : null,
    createdAt: row.created_at,
  }));
}
