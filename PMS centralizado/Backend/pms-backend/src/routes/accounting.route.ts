import { Router } from "express";
import { auth, requirePermission } from "../middleware/auth.js";
import { getAccountingSettings, updateAccountingSettings, initializeAccounting } from "../controllers/accounting.settings.controller.js";
import { listAccounts, getAccount, createAccount, updateAccount, deleteAccount } from "../controllers/accounting.chart.controller.js";
import { listEntries, getEntry, createEntry, postEntry, voidEntry, getLedger } from "../controllers/accounting.journal.controller.js";
import { listPeriods, createPeriod, closePeriod, deletePeriod } from "../controllers/accounting.periods.controller.js";
import { getTrialBalance, getIncomeStatement, getBalanceSheet } from "../controllers/accounting.reports.controller.js";

const router = Router();

// Acceso al módulo
router.use(auth, requirePermission("accounting.read"));

// Configuración
router.get("/settings", getAccountingSettings);
router.put("/settings", requirePermission("accounting.settings.write"), updateAccountingSettings);
router.post("/initialize", requirePermission("accounting.settings.write"), initializeAccounting);

// Plan de cuentas
router.get("/accounts", listAccounts);
router.get("/accounts/:id", getAccount);
router.post("/accounts", requirePermission("accounting.accounts.write"), createAccount);
router.put("/accounts/:id", requirePermission("accounting.accounts.write"), updateAccount);
router.delete("/accounts/:id", requirePermission("accounting.accounts.write"), deleteAccount);

// Libro Diario
router.get("/entries", listEntries);
router.get("/entries/:id", getEntry);
router.post("/entries", requirePermission("accounting.entries.write"), createEntry);
router.post("/entries/:id/post", requirePermission("accounting.entries.approve"), postEntry);
router.post("/entries/:id/void", requirePermission("accounting.entries.void"), voidEntry);

// Libro Mayor (por cuenta)
router.get("/ledger/:accountId", getLedger);

// Períodos contables
router.get("/periods", listPeriods);
router.post("/periods", requirePermission("accounting.settings.write"), createPeriod);
router.post("/periods/:id/close", requirePermission("accounting.settings.write"), closePeriod);
router.delete("/periods/:id", requirePermission("accounting.settings.write"), deletePeriod);

// Reportes
router.get("/reports/trial-balance", getTrialBalance);
router.get("/reports/income-statement", getIncomeStatement);
router.get("/reports/balance-sheet", getBalanceSheet);

export default router;
