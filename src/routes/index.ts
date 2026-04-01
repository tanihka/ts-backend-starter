/**
 * routes/index.ts — Root API router.
 *
 * This is the single mount point in app.ts (/api/v1).
 * As you add features, import and mount their routers here.
 *
 * Keeping all routing in one file (until it grows large) means you can see
 * the full API surface at a glance.
 */
import { Router } from 'express';

const router = Router();

// ── Health check ─────────────────────────────────────────────────────────────
// Does NOT require auth. Used by load balancers and uptime monitors.
router.get('/health', (_req, res) => {
  res.json({
    success: true,
    message: 'Server is healthy',
    timestamp: new Date().toISOString(),
  });
});

// ── Feature routers (mount as you build each feature) ────────────────────────
// import { authRouter }  from '../features/auth/auth.routes';
// import { consumerRouter }  from '../features/users/consumer.routes';
// import { providerRouter } from '../features/nannies/provider.routes';
//
// router.use('/auth',    authRouter);
// router.use('/consumers',   consumerRouter);
// router.use('/providers', providerRouter);

export default router;
