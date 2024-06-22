import { Injectable } from '@nestjs/common'
import { OpenVidu, OpenViduRole, Session } from 'openvidu-node-client'

@Injectable()
export class OpenViduService {
  private openvidu: OpenVidu
  private sessions: Record<string, { session: Session; participants: any[] }> =
    {}

  constructor() {
    const OPENVIDU_URL = process.env.OPENVIDU_URL
    const OPENVIDU_SECRET = process.env.OPENVIDU_SECRET
    this.openvidu = new OpenVidu(OPENVIDU_URL, OPENVIDU_SECRET)
  }

  generateSessionName() {
    return `session-${Date.now()}`
  }

  async createSession(sessionName: string): Promise<Session> {
    if (!this.sessions[sessionName]) {
      try {
        const session = await this.openvidu.createSession()
        this.sessions[sessionName] = { session, participants: [] }
        console.log(`Session created: ${sessionName}, ID: ${session.sessionId}`)
        return session
      } catch (error) {
        console.error('Error creating session:', error)
        throw error
      }
    } else {
      console.log(`Session already exists: ${sessionName}`)
      return this.sessions[sessionName].session
    }
  }

  async deleteSession(sessionName: string): Promise<void> {
    if (this.sessions[sessionName]) {
      delete this.sessions[sessionName]
      console.log(`Session deleted: ${sessionName}`)
    } else {
      console.error(`Session ${sessionName} does not exist`)
    }
  }

  addParticipant(sessionName: string, participantName: string, socket: any) {
    if (this.sessions[sessionName]) {
      this.sessions[sessionName].participants.push({
        name: participantName,
        socket,
      })
    } else {
      console.error(`Session ${sessionName} does not exist`)
    }
  }

  removeParticipant(sessionName: string, socket: any) {
    if (this.sessions[sessionName]) {
      this.sessions[sessionName].participants = this.sessions[
        sessionName
      ].participants.filter(p => p.socket !== socket)
    } else {
      console.error(`Session ${sessionName} does not exist`)
    }
  }

  getParticipants(sessionName: string) {
    return this.sessions[sessionName]
      ? this.sessions[sessionName].participants
      : []
  }

  async generateTokens(sessionName: string) {
    const session = this.sessions[sessionName]?.session
    if (!session) {
      console.error(`No session found for ${sessionName}`)
      return []
    }

    const tokenPromises = this.sessions[sessionName].participants.map(
      async ({ name }) => {
        const tokenOptions = {
          role: OpenViduRole.PUBLISHER,
          data: name,
        }
        try {
          console.log(
            `Generating token for session: ${sessionName}, participant: ${name}`,
          )
          const token = await session.generateToken(tokenOptions)
          console.log(`Token generated: ${token}`)
          return token
        } catch (error) {
          console.error(
            `Error generating token for session: ${sessionName}, participant: ${name}`,
            error,
          )
          throw error
        }
      },
    )

    try {
      const tokens = await Promise.all(tokenPromises)
      return this.sessions[sessionName].participants.map(
        (participant, index) => ({
          participant: participant.name,
          token: tokens[index],
        }),
      )
    } catch (error) {
      console.error('Error generating tokens:', error)
      return []
    }
  }

  async resetParticipants(sessionName: string) {
    if (this.sessions[sessionName]) {
      const newSessionName = this.generateSessionName()
      const newSession = await this.createSession(newSessionName)
      this.sessions[newSessionName] = { session: newSession, participants: [] }
      console.log(
        `Session ${sessionName} reset and new session ${newSessionName} created with ID ${newSession.sessionId}`,
      )
    } else {
      console.error(`Session ${sessionName} does not exist`)
    }
  }

  getSession(sessionName: string) {
    return this.sessions[sessionName]?.session
  }

  async findOrCreateAvailableSession(): Promise<string> {
    console.log('Finding or creating available session')

    for (const sessionName in this.sessions) {
      if (this.sessions.hasOwnProperty(sessionName)) {
        const participants = this.sessions[sessionName].participants

        if (participants.length < 6) {
          console.log(`Returning existing session: ${sessionName}`)
          return sessionName
        }
      }
    }

    const newSessionName = this.generateSessionName()
    await this.createSession(newSessionName)
    console.log(`Creating and returning new session: ${newSessionName}`)
    return newSessionName
  }

  getSessions() {
    return this.sessions
  }
}
