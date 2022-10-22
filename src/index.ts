import express from 'express'

/**
 * Interface's
 */
interface Offer {
  type: string | any,
  sdp: string | any
}

interface IceCandidate {
  candidate: string | any,
  sdpMid: string | any,
  sdpMLineIndex: number | any
}

interface BrowserNetQueue {
  id: string,
  connectionID?: string,
  iceCandidate?: IceCandidate[],
  offer?: Offer,
  response: express.Response
}

interface Data {
  type: string,
  payload: {
    [key: string]: any
  }
}

/**
 * Constant's
 */
let CONNECTIONS: { [key: string]: BrowserNetQueue } = {}
const SSE_REQUEST_PATH = 'GET:/browsernet/sse'
const SESSION_REQUEST_PATH = 'GET:/browsernet/session'
const TYPE_NEW_CONNECTION = 'NEW_CONNECTION'
const TYPE_NO_OFFER = 'NO_OFFER'
const TYPE_OFFER = 'OFFER'
const TYPE_ICE_CANDIDATE = 'ICE_CANDIDATE'
const TYPE_SHARE_ICE_CANDIDATE = 'SHARE_ICE_CANDIDATE'
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
  //Get Data
  const data: Data = JSON.parse(request?.query?.data as string)
  if (!data || data?.type !== TYPE_NEW_CONNECTION || !data?.payload?.id) {
    response.writeHead(400, SSE_RESPONSE_HEADER)
    response.end()
  }

  const payload: Pick<BrowserNetQueue, 'id' | 'response'> = {
    id: data?.payload?.id,
    response,
  }

  //Write SSE header
  response.writeHead(200, SSE_RESPONSE_HEADER)

  //Write Body
  if (Object.keys(CONNECTIONS).length === 0) {
    CONNECTIONS[payload?.id] = payload

    response.write(
      formatData(
        {
          type: TYPE_NO_OFFER,
          payload: {}
        }
      )
    )
  } else {
    for (let key in CONNECTIONS) {
      if (data?.payload?.connections?.includes(CONNECTIONS[key]?.id) || payload?.id === CONNECTIONS[key]?.id || !CONNECTIONS[key]?.offer || CONNECTIONS[key]?.iceCandidate?.length === 0) {
        continue;
      } else {
        CONNECTIONS[key].connectionID = payload?.id
        CONNECTIONS[payload.id] = {
          ...payload,
          connectionID: CONNECTIONS[key]?.id
        }

        response.write(
          formatData({
            type: TYPE_OFFER,
            payload: {
              id: CONNECTIONS[key]?.id,
              offer: CONNECTIONS[key]?.offer,
              iceCandidate: CONNECTIONS[key]?.iceCandidate
            }
          })
        )
        break;
      }
    }
  }

  //Close sse connection
  request.on('close', () => {
    console.log(payload?.id, CONNECTIONS[payload?.id]?.connectionID!)
    delete CONNECTIONS[CONNECTIONS[payload?.id]?.connectionID!]
    delete CONNECTIONS[payload?.id]
    console.log(CONNECTIONS)
  })
}

/**
 * 
 * @param request 
 * @param response 
 */
const handleSession = (request: express.Request, response: express.Response) => {
  //Get Data
  const data: Data = JSON.parse(request?.query?.data as string)
  if (!data || !data?.type || !data?.payload) {
    return response.send({ type: 'FAILED_INVALID_DATA', payload: {} })
  }

  switch (data?.type) {
    case TYPE_OFFER: {
      if (!data?.payload?.id || !data?.payload?.offer) {
        response.send({ type: 'FAILED_INCORRECT_PAYLOAD', payload: {} })
        break
      }

      CONNECTIONS[data?.payload?.id] = {
        ...CONNECTIONS[data?.payload?.id],
        offer: data?.payload?.offer,
      }

      response.send({ type: 'OFFER_ADDED', payload: {} })
      break
    }
    case TYPE_ANWSER: {
      if (!data?.payload?.id || !data?.payload?.answer) {
        response.send({ type: 'FAILED_INCORRECT_PAYLOAD', payload: {} })
        break
      }

      const connectionID = CONNECTIONS[data?.payload?.id]?.connectionID!
      CONNECTIONS[connectionID]?.response?.write(
        formatData({
          type: TYPE_ANWSER,
          payload: {
            id: data?.payload?.id,
            answer: data?.payload?.answer,
          }
        })
      )

      response.send({ type: 'ANSWER_SENT_SUCCESSFULLY', payload: {} })
      break
    }
    case TYPE_ICE_CANDIDATE: {
      if (!data?.payload?.id || !data?.payload?.iceCandidate) {
        response.send({ type: 'FAILED_INCORRECT_PAYLOAD', payload: {} })
        break
      }

      CONNECTIONS[data?.payload?.id].iceCandidate = [...(CONNECTIONS[data?.payload?.id]?.iceCandidate! || []), data?.payload?.iceCandidate]

      const connectionID = CONNECTIONS[data?.payload?.id]?.connectionID!
      console.log(CONNECTIONS[data?.payload?.id]?.iceCandidate?.length)
      CONNECTIONS[connectionID]?.response?.write(
        formatData({
          type: TYPE_ICE_CANDIDATE,
          payload: {
            id: data?.payload?.id,
            iceCandidate: data?.payload?.iceCandidate
          }
        })
      )

      response.send({ type: 'ICE_CANDIDATE_ADDED', payload: {} })
      break
    }
    case TYPE_SHARE_ICE_CANDIDATE: {
      if (!data?.payload?.id) {
        response.send({ type: 'FAILED_INCORRECT_PAYLOAD', payload: {} })
        break
      }

      const connectionID = CONNECTIONS[data?.payload?.id]?.connectionID!
      CONNECTIONS[data?.payload?.id]?.iceCandidate?.forEach((iceCandidate) => {
        CONNECTIONS[connectionID]?.response?.write(
          formatData({
            type: TYPE_ICE_CANDIDATE,
            payload: {
              id: data?.payload?.id,
              iceCandidate: iceCandidate
            }
          })
        )
      })

      response.send({ type: 'ICE_CANDIDATE_SHARED', payload: {} })
      break
    }
    default: {
      response.send({ type: 'FAILED_INVALID_TYPE', payload: {} })
      break
    }
  }
}

/**
* 
* @param data 
* @returns 
*/
const formatData = (data: Data) => {
  return `data: ${JSON.stringify(data)}\n\n`
}