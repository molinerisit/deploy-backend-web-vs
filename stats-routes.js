// backend/stats-routes.js
import express from "express";
import { sequelize } from "./models.js";
import { authMiddleware } from "./auth.js";

const auth = authMiddleware();

/**
 * Helpers y ENV (flexibles)
 * - Ajustá estos ENV si tus tablas/columnas usan otros nombres
 */
const SALES_TABLE          = process.env.SALES_TABLE          || "Venta";
const SALES_ITEM_TABLE     = process.env.SALES_ITEM_TABLE     || "DetalleVenta";
const PRODUCTS_TABLE       = process.env.PRODUCTS_TABLE       || "Producto";
const CATEGORIES_TABLE     = process.env.CATEGORIES_TABLE     || ""; // opcional

const SALES_CREATED_AT     = process.env.SALES_CREATED_AT     || "createdAt";
const SALES_AMOUNT_COL     = process.env.SALES_AMOUNT_COL     || "total";
const SALES_USER_COL       = process.env.SALES_USER_COL       || "userId";

const ITEM_QTY_COL         = process.env.ITEM_QTY_COL         || "cantidad";
const ITEM_PRICE_COL       = process.env.ITEM_PRICE_COL       || "precio";
const ITEM_PRODUCT_ID_COL  = process.env.ITEM_PRODUCT_ID_COL  || "productoId";
const ITEM_SALE_ID_COL     = process.env.ITEM_SALE_ID_COL     || "ventaId";

const PRODUCT_NAME_COL     = process.env.PRODUCT_NAME_COL     || "nombre";
const PRODUCT_CAT_ID_COL   = process.env.PRODUCT_CAT_ID_COL   || "categoriaId"; // cuando tenés tabla categorías
const PRODUCT_CAT_INLINE   = process.env.PRODUCT_CAT_INLINE   || ""; // ej. "categoria" si es string en productos

const CATEGORY_ID_COL      = process.env.CATEGORY_ID_COL      || "id";
const CATEGORY_NAME_COL    = process.env.CATEGORY_NAME_COL    || "nombre";

function parseRange(req) {
  const from = String(req.query.from || "").slice(0, 10);
  const to   = String(req.query.to   || "").slice(0, 10);
  if (!from || !to) {
    const e = new Error("from y to son requeridos (YYYY-MM-DD)");
    e.status = 400; throw e;
  }
  const fromTs = new Date(from + "T00:00:00Z");
  const toTs   = new Date(to   + "T00:00:00Z");
  toTs.setUTCDate(toTs.getUTCDate() + 1); // exclusivo
  return { from, to, fromTs, toTs };
}

export function buildStatsRouter() {
  const r = express.Router();

  /**
   * SUMMARY
   *  - salesAmount: SUM(total)
   *  - salesCount: COUNT(ventas)
   *  - avgTicket: SUM(total)/COUNT
   *  - itemsCount: SUM(cantidad) en DetalleVenta
   */
  r.get("/summary", auth, async (req, res) => {
    try {
      const { fromTs, toTs } = parseRange(req);

      // Intento con userId; si falla, reintenta sin filtro
      const baseWhere = `
        "${SALES_TABLE}"."${SALES_CREATED_AT}" >= :fromTs
        AND "${SALES_TABLE}"."${SALES_CREATED_AT}" <  :toTs
      `;
      const withUser = baseWhere + ` AND "${SALES_TABLE}"."${SALES_USER_COL}" = :uid`;

      const sumSql = (where) => `
        SELECT
          COALESCE(SUM("${SALES_TABLE}"."${SALES_AMOUNT_COL}"), 0) AS sales_amount,
          COUNT(1) AS sales_count
        FROM "${SALES_TABLE}"
        WHERE ${where}
      `;

      const itemsSql = (where) => `
        SELECT COALESCE(SUM("${SALES_ITEM_TABLE}"."${ITEM_QTY_COL}"), 0) AS items_count
        FROM "${SALES_ITEM_TABLE}"
        JOIN "${SALES_TABLE}"
          ON "${SALES_TABLE}"."id" = "${SALES_ITEM_TABLE}"."${ITEM_SALE_ID_COL}"
        WHERE ${where}
      `;

      const replacements = { fromTs, toTs, uid: req.user.id };
      let head, tail;

      try {
        [head] = await sequelize.query(sumSql(withUser), { replacements, type: sequelize.QueryTypes.SELECT });
        [tail] = await sequelize.query(itemsSql(withUser), { replacements, type: sequelize.QueryTypes.SELECT });
      } catch {
        [head] = await sequelize.query(sumSql(baseWhere), { replacements, type: sequelize.QueryTypes.SELECT });
        [tail] = await sequelize.query(itemsSql(baseWhere), { replacements, type: sequelize.QueryTypes.SELECT });
      }

      const salesAmount = Number(head?.sales_amount || 0);
      const salesCount  = Number(head?.sales_count || 0);
      const itemsCount  = Number(tail?.items_count || 0);
      const avgTicket   = salesCount ? salesAmount / salesCount : 0;

      res.json({ salesAmount, salesCount, avgTicket, itemsCount });
    } catch (err) {
      res.status(err?.status || 500).json({ error: err?.message || "Error en summary" });
    }
  });

  /**
   * TOP PRODUCTS
   *  - ranking por unidades (qty) con nombre de producto
   *  GET /stats/top-products?from=...&to=...&limit=5
   */
  r.get("/top-products", auth, async (req, res) => {
    try {
      const { fromTs, toTs } = parseRange(req);
      const limit = Math.min(50, Math.max(1, Number(req.query.limit || 5)));

      const baseWhere = `
        "${SALES_TABLE}"."${SALES_CREATED_AT}" >= :fromTs
        AND "${SALES_TABLE}"."${SALES_CREATED_AT}" <  :toTs
      `;
      const withUser = baseWhere + ` AND "${SALES_TABLE}"."${SALES_USER_COL}" = :uid`;

      const query = (where) => `
        SELECT
          "${PRODUCTS_TABLE}"."${PRODUCT_NAME_COL}" AS name,
          COALESCE(SUM("${SALES_ITEM_TABLE}"."${ITEM_QTY_COL}"), 0) AS qty
        FROM "${SALES_ITEM_TABLE}"
        JOIN "${SALES_TABLE}"
          ON "${SALES_TABLE}"."id" = "${SALES_ITEM_TABLE}"."${ITEM_SALE_ID_COL}"
        LEFT JOIN "${PRODUCTS_TABLE}"
          ON "${PRODUCTS_TABLE}"."id" = "${SALES_ITEM_TABLE}"."${ITEM_PRODUCT_ID_COL}"
        WHERE ${where}
        GROUP BY "${PRODUCTS_TABLE}"."${PRODUCT_NAME_COL}"
        ORDER BY qty DESC
        LIMIT :limit
      `;

      const replacements = { fromTs, toTs, uid: req.user.id, limit };
      let rows;
      try {
        rows = await sequelize.query(query(withUser), { replacements, type: sequelize.QueryTypes.SELECT });
      } catch {
        rows = await sequelize.query(query(baseWhere), { replacements, type: sequelize.QueryTypes.SELECT });
      }
      res.json(rows.map(r => ({ name: r.name || "—", qty: Number(r.qty || 0) })));
    } catch (err) {
      res.status(err?.status || 500).json({ error: err?.message || "Error en top-products" });
    }
  });

  /**
   * CATEGORY LEADERS
   *  - si hay tabla categorías: join por categoriaId
   *  - si no hay: usa columna inline en productos (PRODUCT_CAT_INLINE="categoria")
   */
  r.get("/category-leaders", auth, async (req, res) => {
    try {
      const { fromTs, toTs } = parseRange(req);

      const baseWhere = `
        "${SALES_TABLE}"."${SALES_CREATED_AT}" >= :fromTs
        AND "${SALES_TABLE}"."${SALES_CREATED_AT}" <  :toTs
      `;
      const withUser = baseWhere + ` AND "${SALES_TABLE}"."${SALES_USER_COL}" = :uid`;

      const haveCatTable = Boolean(CATEGORIES_TABLE);
      const haveInline   = Boolean(PRODUCT_CAT_INLINE);

      if (!haveCatTable && !haveInline) {
        // No hay forma de obtener categorías
        return res.json([]);
      }

      const queryWithCatTable = (where) => `
        SELECT
          "${CATEGORIES_TABLE}"."${CATEGORY_NAME_COL}" AS category,
          COALESCE(SUM("${SALES_ITEM_TABLE}"."${ITEM_QTY_COL}"), 0) AS qty
        FROM "${SALES_ITEM_TABLE}"
        JOIN "${SALES_TABLE}"
          ON "${SALES_TABLE}"."id" = "${SALES_ITEM_TABLE}"."${ITEM_SALE_ID_COL}"
        LEFT JOIN "${PRODUCTS_TABLE}"
          ON "${PRODUCTS_TABLE}"."id" = "${SALES_ITEM_TABLE}"."${ITEM_PRODUCT_ID_COL}"
        LEFT JOIN "${CATEGORIES_TABLE}"
          ON "${CATEGORIES_TABLE}"."${CATEGORY_ID_COL}" = "${PRODUCTS_TABLE}"."${PRODUCT_CAT_ID_COL}"
        WHERE ${where}
        GROUP BY "${CATEGORIES_TABLE}"."${CATEGORY_NAME_COL}"
        ORDER BY qty DESC
      `;

      const queryInline = (where) => `
        SELECT
          COALESCE("${PRODUCTS_TABLE}"."${PRODUCT_CAT_INLINE}", 'Sin categoría') AS category,
          COALESCE(SUM("${SALES_ITEM_TABLE}"."${ITEM_QTY_COL}"), 0) AS qty
        FROM "${SALES_ITEM_TABLE}"
        JOIN "${SALES_TABLE}"
          ON "${SALES_TABLE}"."id" = "${SALES_ITEM_TABLE}"."${ITEM_SALE_ID_COL}"
        LEFT JOIN "${PRODUCTS_TABLE}"
          ON "${PRODUCTS_TABLE}"."id" = "${SALES_ITEM_TABLE}"."${ITEM_PRODUCT_ID_COL}"
        WHERE ${where}
        GROUP BY "${PRODUCTS_TABLE}"."${PRODUCT_CAT_INLINE}"
        ORDER BY qty DESC
      `;

      const query = haveCatTable ? queryWithCatTable : queryInline;
      const replacements = { fromTs, toTs, uid: req.user.id };

      let rows;
      try {
        rows = await sequelize.query(query(withUser), { replacements, type: sequelize.QueryTypes.SELECT });
      } catch {
        rows = await sequelize.query(query(baseWhere), { replacements, type: sequelize.QueryTypes.SELECT });
      }

      res.json(rows.map(r => ({ category: r.category || "Sin categoría", qty: Number(r.qty || 0) })));
    } catch (err) {
      res.status(err?.status || 500).json({ error: err?.message || "Error en category-leaders" });
    }
  });

  /**
   * COMPARE
   * GET /stats/compare?from=YYYY-MM-DD&to=YYYY-MM-DD
   * Respuesta:
   *  { current:{amount,count,avg,items}, previous:{...}, deltas:{amountPct,countPct,avgPct,itemsPct} }
   */
  r.get("/compare", auth, async (req, res) => {
    try {
      const { from, to, fromTs, toTs } = parseRange(req);
      const ms = toTs.getTime() - fromTs.getTime();
      const prevToTs = new Date(fromTs.getTime());
      const prevFromTs = new Date(fromTs.getTime() - ms);
      // prev = rango del mismo tamaño inmediatamente anterior

      const baseWhere = (start, end) => `
        "${SALES_TABLE}"."${SALES_CREATED_AT}" >= :start
        AND "${SALES_TABLE}"."${SALES_CREATED_AT}" <  :end
      `;
      const withUser = (start, end) => baseWhere(start,end) + ` AND "${SALES_TABLE}"."${SALES_USER_COL}" = :uid`;

      const sumSql = (where) => `
        SELECT
          COALESCE(SUM("${SALES_TABLE}"."${SALES_AMOUNT_COL}"), 0) AS sales_amount,
          COUNT(1) AS sales_count
        FROM "${SALES_TABLE}" WHERE ${where}
      `;
      const itemsSql = (where) => `
        SELECT COALESCE(SUM("${SALES_ITEM_TABLE}"."${ITEM_QTY_COL}"), 0) AS items_count
        FROM "${SALES_ITEM_TABLE}"
        JOIN "${SALES_TABLE}" ON "${SALES_TABLE}"."id" = "${SALES_ITEM_TABLE}"."${ITEM_SALE_ID_COL}"
        WHERE ${where}
      `;

      const repCurr = { start: fromTs, end: toTs, uid: req.user.id };
      const repPrev = { start: prevFromTs, end: prevToTs, uid: req.user.id };

      async function block(replacements, withUserWhere, baseWhereSql) {
        try {
          const [h] = await sequelize.query(sumSql(withUserWhere), { replacements, type: sequelize.QueryTypes.SELECT });
          const [t] = await sequelize.query(itemsSql(withUserWhere), { replacements, type: sequelize.QueryTypes.SELECT });
          return { amount: Number(h?.sales_amount||0), count: Number(h?.sales_count||0), items: Number(t?.items_count||0) };
        } catch {
          const [h] = await sequelize.query(sumSql(baseWhereSql), { replacements, type: sequelize.QueryTypes.SELECT });
          const [t] = await sequelize.query(itemsSql(baseWhereSql), { replacements, type: sequelize.QueryTypes.SELECT });
          return { amount: Number(h?.sales_amount||0), count: Number(h?.sales_count||0), items: Number(t?.items_count||0) };
        }
      }

      const curr = await block(repCurr, withUser(":start",":end"), baseWhere(":start",":end"));
      const prev = await block(repPrev, withUser(":start",":end"), baseWhere(":start",":end"));

      const current = { amount: curr.amount, count: curr.count, avg: curr.count ? curr.amount/curr.count : 0, items: curr.items };
      const previous = { amount: prev.amount, count: prev.count, avg: prev.count ? prev.amount/prev.count : 0, items: prev.items };

      const pct = (a,b)=> b===0 ? (a>0?100:0) : ((a-b)/b)*100;
      const deltas = {
        amountPct: Number(pct(current.amount, previous.amount).toFixed(2)),
        countPct:  Number(pct(current.count,  previous.count ).toFixed(2)),
        avgPct:    Number(pct(current.avg,    previous.avg   ).toFixed(2)),
        itemsPct:  Number(pct(current.items,  previous.items ).toFixed(2)),
      };

      res.json({ range:{ from, to }, prevRange:{
        from: new Date(prevFromTs).toISOString().slice(0,10),
        to:   new Date(prevToTs).toISOString().slice(0,10)
      }, current, previous, deltas });
    } catch (err) {
      res.status(err?.status || 500).json({ error: err?.message || "Error en compare" });
    }
  });

  /**
   * HOURS HEATMAP
   * GET /stats/hours-heatmap?from=YYYY-MM-DD&to=YYYY-MM-DD
   * - dow: 0..6 (Postgres: 0=Domingo, 1=Lunes, ... 6=Sábado)
   * - hour: 0..23
   */
  r.get("/hours-heatmap", auth, async (req, res) => {
    try {
      const { fromTs, toTs } = parseRange(req);

      const baseWhere = `
        "${SALES_TABLE}"."${SALES_CREATED_AT}" >= :fromTs
        AND "${SALES_TABLE}"."${SALES_CREATED_AT}" <  :toTs
      `;
      const withUser = baseWhere + ` AND "${SALES_TABLE}"."${SALES_USER_COL}" = :uid`;

      const sql = (where) => `
        SELECT
          EXTRACT(DOW  FROM "${SALES_TABLE}"."${SALES_CREATED_AT}")::int AS dow,
          EXTRACT(HOUR FROM "${SALES_TABLE}"."${SALES_CREATED_AT}")::int AS hour,
          COALESCE(SUM("${SALES_TABLE}"."${SALES_AMOUNT_COL}"), 0) AS amount,
          COUNT(1) AS tickets
        FROM "${SALES_TABLE}"
        WHERE ${where}
        GROUP BY 1,2
        ORDER BY 1,2
      `;

      const replacements = { fromTs, toTs, uid: req.user.id };
      let rows;
      try {
        rows = await sequelize.query(sql(withUser), { replacements, type: sequelize.QueryTypes.SELECT });
      } catch {
        rows = await sequelize.query(sql(baseWhere), { replacements, type: sequelize.QueryTypes.SELECT });
      }

      // Normalizamos a ints y números
      const data = rows.map(r => ({
        dow: Number(r.dow), hour: Number(r.hour),
        amount: Number(r.amount || 0),
        tickets: Number(r.tickets || 0),
      }));

      res.json({ data, note: "dow 0=Domingo … 6=Sábado (PostgreSQL)" });
    } catch (err) {
      res.status(err?.status || 500).json({ error: err?.message || "Error en hours-heatmap" });
    }
  });

  /**
   * SALES SERIES (migrado desde server.js)
   *  GET /stats/sales-series?from=YYYY-MM-DD&to=YYYY-MM-DD&bucket=day|week|month
   */
  r.get("/sales-series", auth, async (req, res) => {
    try {
      const { from, to, fromTs, toTs } = parseRange(req);
      const bucket = String(req.query.bucket || "day").toLowerCase();
      if (!["day","week","month"].includes(bucket)) {
        return res.status(400).json({ error: "bucket inválido" });
      }

      const baseWhere = `
        "${SALES_TABLE}"."${SALES_CREATED_AT}" >= :fromTs
        AND "${SALES_TABLE}"."${SALES_CREATED_AT}" <  :toTs
      `;
      const withUser = baseWhere + ` AND "${SALES_TABLE}"."${SALES_USER_COL}" = :uid`;

      const sql = (where) => `
        SELECT
          date_trunc(:bucket, "${SALES_TABLE}"."${SALES_CREATED_AT}") AS ts_bucket,
          SUM(COALESCE("${SALES_TABLE}"."${SALES_AMOUNT_COL}", 0))   AS amount,
          COUNT(1)                                                   AS tickets
        FROM "${SALES_TABLE}"
        WHERE ${where}
        GROUP BY 1
        ORDER BY 1 ASC
      `;

      const replacements = { bucket, fromTs, toTs, uid: req.user.id };
      let rows;
      try {
        rows = await sequelize.query(sql(withUser), { replacements, type: sequelize.QueryTypes.SELECT });
      } catch {
        rows = await sequelize.query(sql(baseWhere), { replacements, type: sequelize.QueryTypes.SELECT });
      }

      const data = rows.map(r => ({
        ts: new Date(r.ts_bucket).toISOString(),
        amount: Number(r.amount || 0),
        tickets: Number(r.tickets || 0),
      }));

      res.json({ bucket, from, to, data });
    } catch (err) {
      res.status(err?.status || 500).json({ error: err?.message || "Error en sales-series" });
    }
  });

  return r;
}
