import { type FirewallGuard } from "@naskot/node-firewall-guard";
import express, { type NextFunction, type Request, type Response } from "express";

export function createPocApp(firewall: FirewallGuard) {
  const app = express();
  app.use(express.json());

  app.get("/health", (_req: Request, res: Response) => {
    res.json({ ok: true, service: "node-firewall-guard-poc" });
  });

  app.get("/protected", (req: Request, res: Response) => {
    return res.json({
      ok: true,
      ip: req.socket.remoteAddress ?? "",
      message: "resource granted (enforcement handled by iptables/nftables)",
    });
  });

  app.post("/strike", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body && typeof req.body === "object" ? req.body : {};

      const firstThreshold =
        typeof body.firstThreshold === "number" && Number.isFinite(body.firstThreshold) ? Math.floor(body.firstThreshold) : 3;
      const firstBanSec =
        typeof body.firstBanSec === "number" && Number.isFinite(body.firstBanSec) ? Math.floor(body.firstBanSec) : 120;
      const watchlistSeconds =
        typeof body.watchlistSeconds === "number" && Number.isFinite(body.watchlistSeconds)
          ? Math.floor(body.watchlistSeconds)
          : 300;

      const reason = typeof body.reason === "string" && body.reason.trim() ? body.reason.trim() : "manual-strike";

      await firewall.registerFromRequest(req, reason, {
        firstThreshold,
        firstBanSec,
        watchlistSeconds,
      });

      res.json({
        ok: true,
        reason,
        policy: { firstThreshold, firstBanSec, watchlistSeconds },
        snapshot: firewall.snapshot(),
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/state", (_req: Request, res: Response) => {
    res.json({ ok: true, snapshot: firewall.snapshot() });
  });

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const message = error instanceof Error ? error.message : "unknown error";
    res.status(500).json({ ok: false, error: message });
  });

  return app;
}
