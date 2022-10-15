import e from 'express'
import express from 'express'
import { v4 as uuidv4 } from 'uuid'

/**
 * Interface's
 */
interface OfferInterface {
  type: string | any,
  sdp: string | any
}

interface IceCandidateInterface {
  candidate: string | any,
  sdpMid: string | any,
  sdpMLineIndex: number | any
}

interface BrowserNetQueueInterface {
  id: string,
  offer: OfferInterface,
  iceCandidate: IceCandidateInterface[],
  deps: string[],
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
  if (!request.query?.payload) {
    response.writeHead(400, SSE_RESPONSE_HEADER)
    response.end()
  }
  const parsedPayload: Pick<BrowserNetQueueInterface, 'id' | 'offer' | 'iceCandidate' | 'deps'> = JSON.parse(request.query?.payload as string)
  const data: BrowserNetQueueInterface = {
    id: parsedPayload.id,
    offer: parsedPayload.offer,
    iceCandidate: parsedPayload.iceCandidate,
    deps: parsedPayload.deps,
    response
  }

  //Write SSE header
  response.writeHead(200, SSE_RESPONSE_HEADER)

  //Write Body
  if (QUEUE.length === 0) {
    QUEUE.push(data)
    response.write(formattedPayload({ id: '', iceCandidate: [], offer: { sdp: '', type: '' } }))
  } else {
    let removeFromQueue = -1

    for (let i = 0; i < QUEUE.length; i++) {
      if (data.deps.includes(QUEUE[i].id) || data.id === QUEUE[i].id) {
        continue;
      } else {
        QUEUE[i].response.write(formattedPayload(data))
        data.response.write(formattedPayload(QUEUE[i]))
        removeFromQueue = i
        break;
      }
    }

    if (removeFromQueue >= 0) {
      QUEUE = QUEUE.filter((_, index) => index !== removeFromQueue)
    } else {
      QUEUE.push(data)
      response.write(formattedPayload({ id: '', iceCandidate: [], offer: { sdp: '', type: '' } }))
    }
  }

  //Close sse connection
  request.on('close', () => {
    QUEUE = QUEUE.filter((each) => each.id !== data.id)
  })
}

/**
* 
* @param data 
* @returns 
*/
const formattedPayload = (data: Pick<BrowserNetQueueInterface, "id" | "offer" | "iceCandidate">) => {
  return `data: ${JSON.stringify({
    id: data.id,
    offer: data.offer,
    iceCandidate: data.iceCandidate,
  })}\n\n`
}