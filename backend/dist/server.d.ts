declare global {
    namespace Express {
        interface Request {
            user?: any;
        }
    }
}
import * as pkg from 'pg';
declare const pool: pkg.Pool;
declare const app: import("express-serve-static-core").Express;
export { app, pool };
//# sourceMappingURL=server.d.ts.map