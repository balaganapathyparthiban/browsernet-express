import e from 'express'
import express from 'express'
import { v4 as uuidv4 } from 'uuid'

/**
 * Interface's
 */
interface BrowserNetQueueInterface {
  id: string,
  offer: string,
  iceCandidate: string,
  response: express.Response
}

/**
 * Constant's
 */
let QUEUE: BrowserNetQueueInterface[] = []
const SSE_REQUEST_PATH = 'GET:/browsernet/sse'
const SSE_RESPONSE_HEADER = {
  'Content-Type': 'text/event-stream',
  'Connection': 'keep-alive',
  'Cache-Control': 'no-cache',
}

/**
 * 
 * @param request 
 * @param response 
 * @param next 
 */
export const browsernet = (request: express.Request, response: express.Response, next: express.NextFunction) => {
  //Based on request path and method to run sse or sdp fetch
  if (`${request.method}:${request.path}` === SSE_REQUEST_PATH) {
    initializeSSE(request, response)
  }

  //Run next function
  next()
}


/**
 * 
 * @param request 
 * @param response 
 */
const initializeSSE = (request: express.Request, response: express.Response) => {
  //Get Payload
  if(!request.query?.payload) {
    response.writeHead(400, SSE_RESPONSE_HEADER)
    response.end()
  } 
  const parsedPayload: Pick<BrowserNetQueueInterface, 'id' | 'offer' | 'iceCandidate'> = JSON.parse(request.query?.payload as string)
  const data: BrowserNetQueueInterface = { ...parsedPayload, response }

  //Write SSE header
  response.writeHead(200, SSE_RESPONSE_HEADER)

  //Wrtie data to stream 
  response.write(
    formattedPayload(QUEUE[0])
  )

  //Close sse connection
  request.on('close', () => {
  })
}

/**
* 
* @param data 
* @returns 
*/
const formattedPayload = (data: Pick<BrowserNetQueueInterface, "offer" | "iceCandidate">) => {
  return `data: ${JSON.stringify(data)}\n\n`
}