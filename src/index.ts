import express from 'express'

/**
 * 
 * @param request 
 * @param response 
 * @param next 
 */
export const browserConnect = (request: express.Request, response: express.Response, next: express.NextFunction) => {
  //Switch condition to run sse or sdp based on request path
  const key = `${request.method}:${request.path}`
  switch (key) {
    case 'GET:/browser-connect/sse':
      initializeSSE(request, response)
      next()
      break
    case 'GET:browser-connect/sdp':
      next()
      break
    default:
      next()
  }

  //Run next function
  next()
}

interface IData {
  id: string,
  sdp: string
}

/**
 * 
 * @param data 
 * @returns 
 */
const formatData = (data: IData) => {
  return `data: ${JSON.stringify(data)}\n\n`
}

/**
 * 
 * @param request 
 * @param response 
 */
const initializeSSE = (request: express.Request, response: express.Response) => {
  //Write SSE header
  response.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Connection': 'keep-alive',
    'Cache-Control': 'no-cache'
  })

  //Set SSE response to global variable
  global.sse = response

  //Close sse connection
  request.on('close', () => {
    global.sse = null
  })
}

