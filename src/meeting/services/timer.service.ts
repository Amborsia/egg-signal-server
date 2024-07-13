import { Injectable } from '@nestjs/common'
import { Server } from 'socket.io'
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager'
import { Inject } from '@nestjs/common'
import { SessionService } from './session.service'

@Injectable()
export class TimerService {
  private sessionTimers: Record<string, NodeJS.Timeout> = {}

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly sessionService: SessionService,
  ) {}

  startSessionTimer(sessionId: string, server: Server) {
    const timers = [
      { time: 0.5, event: 'introduce' },
      { time: 2.5, event: 'keyword' },
      { time: 4, event: 'cupidTime' },
      { time: 6, event: 'cam' },
      { time: 6.5, event: 'drawingContest' },
      { time: 8.5, event: 'lastCupidTime' },
      { time: 9, event: 'finish' },
    ]

    if (this.sessionTimers[sessionId]) {
      clearTimeout(this.sessionTimers[sessionId])
    }

    let elapsedTime = 0
    let currentTimerIndex = 0

    const timerId = setInterval(() => {
      elapsedTime += 1
      if (
        currentTimerIndex < timers.length &&
        elapsedTime === timers[currentTimerIndex].time * 60
      ) {
        const { event } = timers[currentTimerIndex]
        let message: string | null
        let messageArray: string[] | undefined

        if (event === 'keyword') {
          const getRandomNumber = () => Math.floor(Math.random() * 20) + 1
          message = `${getRandomNumber()}`
        } else if (event === 'introduce') {
          const TeamArray = this.sessionService
            .getParticipants(sessionId)
            .map(user => user.name)
          messageArray = this.shuffleArray(TeamArray)
        } else {
          message = `${event}`
        }

        this.notifySessionParticipants(
          sessionId,
          event,
          message,
          server,
          messageArray,
        )

        currentTimerIndex++
      }

      if (currentTimerIndex >= timers.length) {
        clearInterval(timerId)
      }
    }, 1000)

    this.sessionTimers[sessionId] = timerId
  }

  notifySessionParticipants(
    sessionId: string,
    eventType: string,
    message: string,
    server: Server,
    messageArray?: string[],
  ) {
    const participants = this.sessionService.getParticipants(sessionId)
    if (eventType == 'keyword') {
      const getRandomParticipant = participants[1].name
      participants.forEach(({ socket }) => {
        server.to(socket.id).emit(eventType, { message, getRandomParticipant })
      })
    } else if (eventType == 'introduce') {
      participants.forEach(({ socket }) => {
        server.to(socket.id).emit(eventType, messageArray)
      })
    } else if (eventType == 'drawingContest') {
      const keywordsIndex = Math.random() * 1234
      participants.forEach(({ socket }) => {
        server.to(socket.id).emit(eventType, { message, keywordsIndex })
      })
    } else {
      participants.forEach(({ socket }) => {
        server.to(socket.id).emit(eventType, { message })
      })
    }
  }

  async getTimerFlagBySessionId(sessionId: string): Promise<boolean> {
    return await this.cacheManager.get<boolean>(
      `session:${sessionId}:timerFlag`,
    )
  }

  async setTimerFlagBySessionId(sessionId: string): Promise<void> {
    await this.cacheManager.set(`session:${sessionId}:timerFlag`, true)
  }

  async deleteTimerFlagBySessionId(sessionId: string): Promise<void> {
    await this.cacheManager.del(`session:${sessionId}:timerFlag`)
  }

  private shuffleArray<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[array[i], array[j]] = [array[j], array[i]]
    }
    return array
  }

  clearSessionTimer(sessionId: string) {
    if (this.sessionTimers[sessionId]) {
      clearInterval(this.sessionTimers[sessionId])
      delete this.sessionTimers[sessionId]
    }
  }
}
