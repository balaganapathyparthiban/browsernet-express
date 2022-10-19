import express from 'express'

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
  offer?: OfferInterface,
  iceCandidate?: IceCandidateInterface[],
  deps: string[],
  response: express.Response
}

interface PayloadInterface {
  type: string,
  payload: {
    [key: string]: any
  }
}

/**
 * Constant's
 */
let QUEUE: BrowserNetQueueInterface[] = []
const SSE_REQUEST_PATH = 'GET:/browsernet/sse'
const SESSION_REQUEST_PATH = 'GET:/browsernet/session'
const TYPE_NO_OFFER = 'NO_OFFER'
const TYPE_OFFER = 'OFFER'
const TYPE_ICE_CANDIDATE = 'ICE_CANDIDATE'
const TYPE_ANWSER = 'ANWSER'
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
  } else if (`${request.method}:${request.path}` === SESSION_REQUEST_PATH) {
    handleSession(request, response)
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
  const parsedPayload: Pick<BrowserNetQueueInterface, 'id' | 'deps'> = JSON.parse(request.query?.payload as string)
  const data = {
    id: parsedPayload.id,
    deps: parsedPayload.deps,
    response
  }

  //Write SSE header
  response.writeHead(200, SSE_RESPONSE_HEADER)

  //Write Body
  if (QUEUE.length === 0) {
    QUEUE = QUEUE.filter(each => {
      each.response.end()
      return each.id !== data.id
    })
    QUEUE.push(data)
    response.write(
      formattedPayload(
        {
          type: TYPE_NO_OFFER,
          payload: {}
        }
      )
    )
  } else {
    let removeFromQueue = ''

    for (let i = 0; i < QUEUE.length; i++) {
      if (data.deps.includes(QUEUE[i].id) || data.id === QUEUE[i].id || !QUEUE[i].offer || QUEUE[i].iceCandidate?.length === 0) {
        continue;
      } else {
        response.write(
          formattedPayload(
            {
              type: TYPE_OFFER,
              payload: {
                id: data?.id,
                offer: QUEUE[i].offer,
                icaCandidate: QUEUE[i].iceCandidate
              }
            }
          )
        )
        removeFromQueue = QUEUE[i].id
        break;
      }
    }

    if (removeFromQueue) {
      QUEUE = QUEUE.filter((each) => each.id !== removeFromQueue)
    } else {
      QUEUE = QUEUE.filter(each => {
        each.response.end()
        return each.id !== data.id
      })
      QUEUE.push(data)
      response.write(
        formattedPayload(
          {
            type: TYPE_NO_OFFER,
            payload: {}
          }
        )
      )
    }

  }
  
  console.log('-----------')
  QUEUE.forEach(each => console.log(each.id))
  console.log('-----------')

  //Close sse connection
  request.on('close', () => {
    QUEUE = QUEUE.filter((each) => each.id !== data.id)
  })
}

/**
 * 
 * @param request 
 * @param response 
 */
const handleSession = (request: express.Request, response: express.Response) => {

}

/**
* 
* @param data 
* @returns 
*/
const formattedPayload = (data: PayloadInterface) => {
  return `data: ${JSON.stringify(data)}\n\n`
}