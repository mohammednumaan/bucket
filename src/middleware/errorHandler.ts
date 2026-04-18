import { Request, Response, NextFunction } from "express";

export function errorHandlerMiddleware(
    err: Error,
    _req: Request,
    res: Response,
    _next: NextFunction
) {
    if (process.env.NODE_ENV !== "production") {
        console.error("[Error]", err);
    }

    res.status(500).json({ error: "internal server error" });
}
