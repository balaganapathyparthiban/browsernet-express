// global.d.ts
declare module globalThis {
    import express from 'express'
    var sse: express.Response
}